// Test helper: makes a real spoken clip with macOS's built-in `say` command,
// so the speech engine can be tested without a microphone or a human.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Returns 16 kHz mono float32 samples, the format the app's recorder produces.
function speak(sentence) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "flow-say-")), "clip.wav");
  execFileSync("say", ["-o", file, "--file-format=WAVE", "--data-format=LEF32@16000", sentence]);
  const wav = fs.readFileSync(file);
  const dataStart = wav.indexOf("data") + 8; // samples follow the 'data' chunk header
  const bytes = wav.subarray(dataStart);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
}

module.exports = { speak };
