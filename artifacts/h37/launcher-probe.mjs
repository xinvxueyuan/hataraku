// Mimic how the e2e runner spawns the app command, then stop it the same way.
import { spawn } from "node:child_process";
import { openSync, closeSync, writeFileSync } from "node:fs";

const logPath = "C:/dev/dsh/projects/hataraku/artifacts/h37/launcher-probe.log";
writeFileSync(logPath, "");
const fd = openSync(logPath, "a");
const child = spawn(process.execPath, ["tests/support/start.ts"], {
  cwd: "C:/dev/dsh/projects/hataraku/apps/web",
  detached: false,
  env: { ...process.env, E2E_TEST_PORT: "3230" },
  stdio: ["ignore", fd, fd],
});
closeSync(fd);
console.log("spawned pid=" + child.pid);

const waitHealth = async () => {
  for (let i = 0; i < 240; i += 1) {
    try {
      const response = await fetch("http://localhost:3230/api/health");
      await response.arrayBuffer();
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
};

const portState = async () => {
  const out = [];
  for (const port of [3230, 3231]) {
    const response = await fetch("http://localhost:" + port + "/api/health").catch(() => null);
    out.push(port + "=" + (response === null ? "free" : String(response.status)));
  }
  return out.join(" ");
};

if (!(await waitHealth())) {
  console.log("not ready");
  process.exit(2);
}
console.log("ready: " + (await portState()));
child.kill("SIGTERM");
console.log("killed with SIGTERM; exitCode=" + child.exitCode + " signalCode=" + child.signalCode);
await new Promise((resolve) => setTimeout(resolve, 4000));
console.log("4s after kill: " + (await portState()));
process.exit(0);
