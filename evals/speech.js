// Makes real spoken clips with macOS's built-in `say` command, so the speech
// engine can be tested and measured without a microphone or a person.
//
// Clips are cached on disk and reused. Some macOS voices do not produce the
// exact same audio every time (found by comparing two eval runs: the "Aman"
// voice varied between processes), and a fair before/after comparison needs
// the same audio both times. Delete evals/.audio-cache to regenerate.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const CACHE_DIR = path.join(__dirname, ".audio-cache");

// Returns 16 kHz mono float32 samples, the format the app's recorder produces.
// voice: a macOS voice name (see `say -v '?'`); rate: words per minute.
function speak(sentence, { voice, rate } = {}) {
  const cacheFile = path.join(CACHE_DIR, `${crypto.createHash("sha256").update(`${voice}|${rate}|${sentence}`).digest("hex")}.f32`);
  if (fs.existsSync(cacheFile)) {
    const bytes = fs.readFileSync(cacheFile);
    return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  }
  const samples = synthesise(sentence, { voice, rate });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, Buffer.from(samples.buffer));
  return samples;
}

function synthesise(sentence, { voice, rate }) {
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
