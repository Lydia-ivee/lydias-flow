// Small helpers for running a local engine server (used by the clean-up engine).

const net = require("net");
const { spawn } = require("child_process");

// Ask the OS for a free port by opening a server on port 0, then closing it.
/** @returns {Promise<number>} */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      // Always an object for a TCP server once listening; string and null are for pipes and closed servers.
      if (!address || typeof address === "string") return reject(new Error("Could not read the free port"));
      server.close(() => resolve(address.port));
    });
  });
}

// Keep trying `isReady` until it returns true, the process dies, or time runs out.
/**
 * @param {import("child_process").ChildProcess} child
 * @param {() => Promise<boolean>} isReady
 * @param {{ timeoutMs?: number, name?: string }} [options]
 * @returns {Promise<void>}
 */
async function waitUntilReady(child, isReady, { timeoutMs = 60000, name = "server" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${name} exited during start-up (code ${child.exitCode})`);
    if (await isReady().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${name} did not start within ${timeoutMs / 1000}s`);
}

/**
 * @param {string} binary
 * @param {string[]} args
 * @returns {import("child_process").ChildProcess}
 */
function startProcess(binary, args) {
  // Output is ignored: it is engine diagnostics, and it never contains what was said.
  return spawn(binary, args, { stdio: "ignore" });
}

module.exports = { findFreePort, waitUntilReady, startProcess };
