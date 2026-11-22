// Makes real spoken clips with macOS's built-in `say` command, so the speech
// engine can be tested and measured without a microphone or a person.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Returns 16 kHz mono float32 samples, the format the app's recorder produces.
// voice: a macOS voice name (see `say -v '?'`); rate: words per minute.
function speak(sentence, { voice, rate } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-say-"));
  const file = path.join(dir, "clip.wav");
  const args = ["-o", file, "--file-format=WAVE", "--data-format=LEF32@16000"];
  if (voice) args.push("-v", voice);
  if (rate) args.push("-r", String(rate));
  execFileSync("say", [...args, sentence]);

  const wav = fs.readFileSync(file);
  fs.rmSync(dir, { recursive: true, force: true });
  const dataStart = wav.indexOf("data") + 8; // samples follow the 'data' chunk header
  const bytes = wav.subarray(dataStart);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
}

module.exports = { speak };
