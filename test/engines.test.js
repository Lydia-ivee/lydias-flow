// End-to-end test of the real local engines: a spoken clip goes in, tidied
// British text comes out. Skipped on a fresh clone until `npm run setup` has
// downloaded the engines and models, so `npm test` always works.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { Transcriber } = require("../src/main/transcriber");
const { Cleaner } = require("../src/main/cleaner");
const { processDictation } = require("../src/main/pipeline");
const { speak } = require("../evals/speech");

const ROOT = path.join(__dirname, "..");
const dirs = { enginesDir: path.join(ROOT, "engines"), modelsDir: path.join(ROOT, "models") };
const ready =
  process.platform === "darwin" &&
  fs.existsSync(path.join(dirs.enginesDir, "llama", "llama-server")) &&
  fs.existsSync(path.join(dirs.modelsDir, "parakeet", "tokens.txt")) &&
  fs.existsSync(path.join(dirs.modelsDir, "qwen.gguf"));

test("speech in, tidy British text out, all on this Mac", { skip: !ready && "run npm run setup first", timeout: 180000 }, async () => {
  const transcriber = new Transcriber(dirs);
  const cleaner = new Cleaner(dirs);
  await Promise.all([transcriber.start(), cleaner.start()]);
  try {
    const samples = speak("Um, so basically I want to organize the color of the center page, you know, before Friday.");

    let started = Date.now();
    const raw = await transcriber.transcribe(samples);
    const transcribeMs = Date.now() - started;
    assert.match(raw, /organize the color of the center page/i);

    started = Date.now();
    const result = await processDictation(raw, { cleanup: true, britishEnglish: true }, cleaner);
    const cleanupMs = Date.now() - started;

    assert.match(result.text, /organise the colour of the centre page/i);
    assert.doesNotMatch(result.text, /\bum\b/i);
    assert.ok(result.fillers.um >= 1);
    console.log(`  transcribe ${transcribeMs} ms, clean-up ${cleanupMs} ms: "${result.text}"`);
  } finally {
    transcriber.stop();
    cleaner.stop();
  }
});
