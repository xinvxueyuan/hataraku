import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { retry } from "es-toolkit/function";

import { createTestDatabase } from "@hataraku/db/testing";

import { closeTestHttp } from "./http.ts";

export const e2eBaseURL = `http://localhost:${process.env.E2E_TEST_PORT ?? "3200"}`;

const webDir = fileURLToPath(new URL("../..", import.meta.url));
const serverDir = fileURLToPath(new URL("../../../server", import.meta.url));
const watchdogPath = fileURLToPath(new URL("watchdog.ts", import.meta.url));
const envFile = `${serverDir}/.env`;

/** One process the watchdog starts. The env map is layered over the inherited environment. */
interface WatchCommand {
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

const waitForServer = async (url: string, attempts = 300): Promise<void> => {
  await retry(
    async () => {
      const response = await fetch(url);
      await response.arrayBuffer();

      if (!response.ok) {
        throw new Error(`Server did not become healthy at ${url}`);
      }
    },
    { delay: 100, retries: attempts }
  );
};

/** True while something accepts connections on the port. */
const isListening = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://127.0.0.1:${String(port)}/`, {
      signal: AbortSignal.timeout(500),
    });

    await response.arrayBuffer();

    return true;
  } catch {
    return false;
  }
};

const portsStillListening = async (ports: number[]): Promise<number[]> => {
  const probes = await Promise.all(
    ports.map(async (port) => ({ listening: await isListening(port), port }))
  );

  return probes.filter((probe) => probe.listening).map((probe) => probe.port);
};

/**
 * Polls instead of sleeping a fixed time, because the processes close their listeners asynchronously.
 * A port that stays open is a warning, not a thrown error: the run is over and the report already
 * carries the test result; the next run would fail with APP_ALREADY_RUNNING and this line says why.
 */
const waitForPortsFree = async (
  ports: number[],
  timeoutMs: number
): Promise<void> => {
  try {
    await retry(
      async () => {
        const busy = await portsStillListening(ports);

        if (busy.length > 0) {
          throw new Error(`ports still busy: ${busy.join(", ")}`);
        }
      },
      { delay: 100, retries: Math.max(1, Math.ceil(timeoutMs / 100)) }
    );
  } catch {
    const busy = await portsStillListening(ports);

    if (busy.length > 0) {
      console.warn(
        `[e2e] port(s) ${busy.join(", ")} still accept connections after cleanup; a stale server is likely and the next run may fail with APP_ALREADY_RUNNING`
      );
    }
  }
};

/** Kills a process and everything it forked; the Windows branch is what taskkill /T is for. */
const killTree = (pid: number): void => {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      timeout: 5000,
    });

    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
};

/** Waits for the watchdog, then forces it down if the stop request was not honoured. */
const waitForWatchdog = async (
  watchdog: ChildProcess,
  timeoutMs: number
): Promise<void> => {
  if (watchdog.exitCode !== null) {
    return;
  }

  await Promise.race([once(watchdog, "exit"), sleep(timeoutMs)]);

  if (watchdog.exitCode !== null || watchdog.signalCode !== null) {
    return;
  }

  console.warn(
    `[e2e] the stack watchdog did not exit within ${String(timeoutMs)} ms; killing it`
  );

  if (watchdog.pid !== undefined) {
    killTree(watchdog.pid);
  }

  await Promise.race([
    watchdog.exitCode === null ? once(watchdog, "exit") : Promise.resolve(),
    sleep(2000),
  ]);
};

/**
 * Starts the e2e stack through a detached watchdog and returns its cleanup.
 *
 * start.ts runs inside the e2e runner's command handle, which the runner stops with SIGTERM — on
 * Windows a forceful kill that runs no handler. The watchdog is therefore the owner: it keeps the
 * two servers alive while this process is, and tears both process trees down when this process
 * disappears. The returned cleanup is idempotent and also drives the watchdog on the graceful path.
 */
export const startTestServer = async (baseURL: string) => {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const webPort = Number(new URL(baseURL).port);
  const serverPort = String(webPort + 1);
  const apiHealthURL = `http://localhost:${serverPort}/api/health`;
  const database = await createTestDatabase();
  const stopFile = path.join(tmpdir(), `hataraku-e2e-${String(webPort)}.stop`);

  rmSync(stopFile, { force: true });

  const api: WatchCommand = {
    args: ["src/index.ts"],
    cwd: serverDir,
    env: {
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: baseURL,
      DATABASE_URL: database.url,
      PORT: serverPort,
    },
  };

  const web: WatchCommand = {
    args: ["node_modules/next/dist/bin/next", "dev", "--port", String(webPort)],
    cwd: webDir,
    env: {
      // The web deployment answers /api and /rpc in process, so it opens the same test database
      // the standalone server uses; without it the browser tests would read the development
      // database. The origin is the one the browser sends, which Better Auth checks.
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
      BETTER_AUTH_URL: baseURL,
      DATABASE_URL: database.url,
      NEXT_DIST_DIR: `.next-test-${String(webPort)}`,
      SERVER_URL: `http://localhost:${serverPort}`,
    },
  };

  const watchdog = spawn(process.execPath, [watchdogPath], {
    cwd: webDir,
    detached: true,
    env: {
      ...process.env,
      E2E_WATCHDOG_CONFIG: JSON.stringify({
        api,
        apiUrl: apiHealthURL,
        parentPid: process.pid,
        stopFile,
        web,
      }),
    },
    // Inherit the command's stdout/stderr so the watchdog and both servers keep writing to the
    // runner's log file (.e2e/server.log) after start.ts itself is gone.
    stdio: ["ignore", "inherit", "inherit"],
  });

  watchdog.unref();

  if (watchdog.pid === undefined) {
    await database.remove();
    await closeTestHttp();

    throw new Error("the e2e stack watchdog could not be started");
  }

  let stopped: Promise<void> | null = null;

  const stopAll = async (): Promise<void> => {
    stopped ??= (async () => {
      try {
        // The watchdog tears down both trees on this file; it may also see this process die first.
        writeFileSync(stopFile, "");
        await waitForWatchdog(watchdog, 10_000);
      } finally {
        rmSync(stopFile, { force: true });
        await waitForPortsFree([webPort, Number(serverPort)], 10_000);
        await database.remove();
        await closeTestHttp();
      }
    })();

    await stopped;
  };

  /** Rejects if the watchdog dies before the stack is ready, so startup fails fast instead of hanging. */
  const watchdogExit = (async (): Promise<never> => {
    await once(watchdog, "exit");

    throw new Error("the e2e stack watchdog exited during startup");
  })();

  try {
    await Promise.race([waitForServer(apiHealthURL), watchdogExit]);
    await Promise.race([waitForServer(`${baseURL}/api/health`), watchdogExit]);
    await Promise.all(
      ["/", "/login", "/todos"].map(async (route) => {
        const response = await fetch(`${baseURL}${route}`);
        await response.arrayBuffer();
      })
    );
  } catch (error) {
    await stopAll();
    throw error;
  }

  return stopAll;
};
