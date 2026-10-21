const { spawn } = require("node:child_process");
const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => { console.log('handler ran'); process.exit(0); }); setInterval(() => {}, 1000);"], { stdio: ["ignore", "pipe", "pipe"] });
setTimeout(() => {
  child.kill("SIGTERM");
  setTimeout(() => {
    console.log("exitCode=" + child.exitCode + " signalCode=" + child.signalCode);
    process.exit(0);
  }, 1500);
}, 800);
