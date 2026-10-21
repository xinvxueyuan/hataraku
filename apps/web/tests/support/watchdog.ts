/**
 * Owns the processes behind the e2e stack so none of them outlive the run.
 *
 * The e2e runner stops the app command with SIGTERM. On Windows that is TerminateProcess: Node
 * delivers no signal to the process, so the command cannot run any cleanup of its own. Next dev
 * forks a server that keeps 3200 open, and the API server keeps 3201 — the next run then fails
 * with APP_ALREADY_RUNNING instead of a test result.
 *
 * So the command is not the owner. It spawns this watchdog, which is detached and therefore
 * survives the command's termination. The watchdog starts the stack, watches the parent, and kills
 * both server trees when the parent disappears or a stop file appears. It starts the API server
 * first and waits for its health endpoint, because the web server proxies to it.
 *
 * Configuration arrives as JSON in E2E_WATCHDOG_CONFIG: it is small, and it does not put a process
 * list worth of arguments on the command line.
 */
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import { retry } from "es-toolkit/function";
import { z } from "zod";

/** One process to start: working directory, arguments and the environment layered over the inherited one. */
const commandSchema = z.object({
  args: z.array(z.string()),
  cwd: z.string().min(1),
  env: z.record(z.string(), z.string()),
});

const configSchema = z.object({
  api: commandSchema,
  apiUrl: z.url(),
  parentPid: z.int().positive(),
  stopFile: z.string().min(1),
  web: commandSchema,
});

type WatchCommand = z.infer<typeof commandSchema>;

const POLL_MS = 100;
const STARTUP_TIMEOUT_MS = 120_000;
const KILL_GRACE_MS = 5000;

/** A watchdog outliving the run would still hold a stop file and a parent pid; cap it. */
const MAX_LIFETIME_MS = 30 * 60 * 1000;

const fail = (message: string): never => {
  console.error(`[e2e-watchdog] ${message}`);

  process.exit(2);
};

const readConfig = (): ReturnType<typeof configSchema.parse> => {
  const raw = process.env.E2E_WATCHDOG_CONFIG ?? "";

  if (raw === "") {
    return fail("E2E_WATCHDOG_CONFIG is not set");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("E2E_WATCHDOG_CONFIG is not valid JSON");
  }

  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    return fail(
      `E2E_WATCHDOG_CONFIG has the wrong shape: ${result.error.message}`
    );
  }

  return result.data;
};

const config = readConfig();

/** The next server and the API server, keyed by pid; an entry leaves when the process exits. */
const children = new Map<number, ChildProcess>();

const start = (command: WatchCommand): void => {
  const child = spawn(process.execPath, command.args, {
    cwd: command.cwd,
    env: { ...process.env, ...command.env },
    // The watchdog inherited the runner's log handles; pass them on so server output is not lost.
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true,
  });

  const pid = child.pid ?? fail(`could not start ${command.args.join(" ")}`);

  children.set(pid, child);
  child.once("exit", () => {
    children.delete(pid);
  });
};

/** Kills a process and everything it forked. */
const killTree = (pid: number): void => {
  if (process.platform === "win32") {
    // /T is the point: a single-process kill leaves Next's server worker behind.
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      timeout: KILL_GRACE_MS,
    });

    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
};

const killAll = (): void => {
  for (const pid of children.keys()) {
    killTree(pid);
  }
};

const parentAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    // EPERM means the process exists but this user may not signal it.
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
};

const apiAnswers = async (): Promise<boolean> => {
  try {
    const response = await fetch(config.apiUrl);

    await response.arrayBuffer();

    return response.ok;
  } catch {
    return false;
  }
};

/** Resolves when the API server answers, and rejects when it does not within the startup budget. */
const waitForApi = async (): Promise<void> => {
  await retry(
    async () => {
      if (!parentAlive(config.parentPid)) {
        throw new Error("parent is gone");
      }

      if (!(await apiAnswers())) {
        throw new Error("API is not healthy yet");
      }
    },
    {
      delay: POLL_MS,
      retries: Math.ceil(STARTUP_TIMEOUT_MS / POLL_MS),
    }
  );
};

/** Resolves once every child has exited, or after the grace period. */
const waitForChildren = async (): Promise<void> => {
  try {
    await retry(
      async () => {
        await sleep(50);

        if (children.size > 0) {
          throw new Error("children are still running");
        }
      },
      { retries: Math.ceil(KILL_GRACE_MS / 50) }
    );
  } catch {
    // the grace period passed; the caller force-kills again
  }
};

let stopping: Promise<void> | null = null;

/** Idempotent: the stop file, the parent's death and a signal can arrive in any order. */
const shutdown = async (): Promise<void> => {
  if (stopping !== null) {
    await stopping;

    return;
  }

  stopping = (async () => {
    killAll();
    await waitForChildren();

    if (children.size > 0) {
      killAll();
      await sleep(200);
    }

    rmSync(config.stopFile, { force: true });
  })();

  await stopping;
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await shutdown();
      process.exit(0);
    })();
  });
}

start(config.api);

try {
  await waitForApi();
} catch {
  await shutdown();

  fail("the API server did not become healthy");
}

start(config.web);

const startedAt = Date.now();

const shouldStop = (): boolean =>
  existsSync(config.stopFile) ||
  !parentAlive(config.parentPid) ||
  Date.now() - startedAt > MAX_LIFETIME_MS ||
  children.size === 0;

try {
  await retry(
    async () => {
      if (shouldStop()) {
        return;
      }

      await sleep(POLL_MS);

      throw new Error("stack still running");
    },
    { retries: Math.ceil(MAX_LIFETIME_MS / POLL_MS) }
  );
} catch {
  // only reachable if the cap itself is exceeded
}

await shutdown();
