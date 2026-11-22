const test = require("node:test");
const assert = require("node:assert/strict");
const { LivePreview } = require("../src/main/livePreview");

// A stand-in speech model whose answers the test releases by hand, so timing
// rules (skip, cancel, late answers) can be checked exactly.
function fakeModel() {
  /** @type {{ samples: Float32Array, answer: (text: string) => void, fail: () => void }[]} */
  const calls = [];
  const transcribe = (/** @type {Float32Array} */ samples) =>
    new Promise((resolve, reject) => {
      calls.push({ samples, answer: resolve, fail: () => reject(new Error("model error")) });
    });
  return { calls, transcribe };
}

function makePreview(options = {}) {
  const model = fakeModel();
  /** @type {string[]} */
  const shown = [];
  const preview = new LivePreview({
    transcribe: model.transcribe,
    onText: (text) => shown.push(text),
    // No real timer: the test calls tick() itself.
    setTimer: /** @type {any} */ (() => 1),
    clearTimer: () => {},
    ...options,
  });
  preview.start();
  return { preview, model, shown };
}

const seconds = (s, value = 0.1) => new Float32Array(Math.round(s * 16000)).fill(value);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("reads the audio so far and shows the result", async () => {
  const { preview, model, shown } = makePreview();
  preview.push(seconds(1));
  assert.equal(preview.tick(), true);
  assert.equal(model.calls[0].samples.length, 16000);
  model.calls[0].answer("See you");
  await flush();
  assert.deepEqual(shown, ["See you"]);
});

test("skips a beat while the previous read is still running", async () => {
  const { preview, model } = makePreview();
  preview.push(seconds(1));
  preview.tick();
  preview.push(seconds(0.4));
  assert.equal(preview.tick(), false); // still busy: skipped, not queued
  assert.equal(model.calls.length, 1);
  assert.equal(preview.stats.skipped, 1);
  model.calls[0].answer("See");
  await flush();
  assert.equal(preview.tick(), true); // free again
  assert.equal(model.calls.length, 2);
});

test("does not re-read when no new audio has arrived", async () => {
  const { preview, model } = makePreview();
  preview.push(seconds(1));
  preview.tick();
  model.calls[0].answer("See");
  await flush();
  assert.equal(preview.tick(), false);
  assert.equal(model.calls.length, 1);
});

test("only re-reads the most recent window of audio", async () => {
  const { preview, model } = makePreview({ windowSeconds: 2 });
  for (let i = 0; i < 10; i += 1) preview.push(seconds(1, i)); // ten 1-second chunks, values 0..9
  preview.tick();
  const read = model.calls[0].samples;
  assert.equal(read.length, 2 * 16000);
  assert.equal(read[0], 8); // starts at the 9th second
  assert.equal(read.at(-1), 9);
  assert.ok(preview.chunks.length <= 3, "old audio is let go");
});

test("stop() waits for the read in flight and never shows its late result", async () => {
  const { preview, model, shown } = makePreview();
  preview.push(seconds(1));
  preview.tick();
  const stopped = preview.stop();
  model.calls[0].answer("too late");
  await stopped;
  assert.deepEqual(shown, []);
  preview.push(seconds(1)); // ignored after stop
  assert.equal(preview.totalSamples, 0);
});

test("a failed read is harmless and the next beat carries on", async () => {
  const { preview, model, shown } = makePreview();
  preview.push(seconds(1));
  preview.tick();
  model.calls[0].fail();
  await flush();
  preview.push(seconds(0.4));
  assert.equal(preview.tick(), true);
  model.calls[1].answer("Recovered");
  await flush();
  assert.deepEqual(shown, ["Recovered"]);
});

test("the same text is not shown twice", async () => {
  const { preview, model, shown } = makePreview();
  preview.push(seconds(1));
  preview.tick();
  model.calls[0].answer("Same");
  await flush();
  preview.push(seconds(0.4));
  preview.tick();
  model.calls[1].answer("Same");
  await flush();
  assert.deepEqual(shown, ["Same"]);
});

test("start() after stop() begins a clean session", async () => {
  const { preview, model, shown } = makePreview();
  preview.push(seconds(1));
  preview.tick();
  model.calls[0].answer("First");
  await flush();
  await preview.stop();
  preview.start();
  preview.push(seconds(0.5));
  preview.tick();
  assert.equal(model.calls[1].samples.length, 8000); // none of the first session's audio
  model.calls[1].answer("First"); // same words as last session are still shown afresh
  await flush();
  assert.deepEqual(shown, ["First", "First"]);
});

test("fast start: reads every beat until words appear, then only every 0.4s of new audio", async () => {
  const { preview, model } = makePreview();
  preview.push(seconds(0.2));
  assert.equal(preview.tick(), true); // no words yet: read on every beat
  model.calls[0].answer(""); // silence so far
  await flush();
  preview.push(seconds(0.2));
  assert.equal(preview.tick(), true); // still no words: read again
  model.calls[1].answer("Hello");
  await flush();
  preview.push(seconds(0.2));
  assert.equal(preview.tick(), false); // words showing: 0.2s of new audio is not enough
  preview.push(seconds(0.2));
  assert.equal(preview.tick(), true); // 0.4s of new audio: due
  assert.equal(preview.stats.skipped, 0); // waiting for audio is not a skipped beat
});
