// Starts the Swift key listener (native/key-listener.swift) and turns its
// output lines into events: "down" and "up" with the key name, "ready", and
// "no-permission".

const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const readline = require("readline");

/**
 * The listener's events, plus `stop()` to end the listener process.
 * @typedef {EventEmitter & { stop(): void }} KeyEvents
 */

/**
 * @typedef {{ type: "down" | "up", key: string } | { type: "ready" | "no-permission", key?: undefined }} KeyEvent
 */

/**
 * @param {string} line
 * @returns {KeyEvent | null}
 */
function parseLine(line) {
  const [kind, key] = line.trim().split(/\s+/);
  if (kind === "DOWN" && key) return { type: "down", key };
  if (kind === "UP" && key) return { type: "up", key };
  if (kind === "READY") return { type: "ready" };
  if (kind === "NO_PERMISSION") return { type: "no-permission" };
  return null; // ignore anything unexpected
}

/**
 * @param {string} binary
 * @param {string[]} keys
 * @returns {KeyEvents}
 */
function startKeyListener(binary, keys) {
  const events = new EventEmitter();
  // stdin stays open as a pipe: when this app quits, it closes and the listener exits too.
  const child = spawn(binary, keys, { stdio: ["pipe", "pipe", "ignore"] });
  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    const event = parseLine(line);
    if (event) events.emit(event.type, event.key);
  });
  child.on("exit", (code) => events.emit("exit", code));
  // Object.assign adds `stop` to the same emitter, and lets TypeScript see it.
  return Object.assign(events, { stop: () => child.kill() });
}

module.exports = { parseLine, startKeyListener };
