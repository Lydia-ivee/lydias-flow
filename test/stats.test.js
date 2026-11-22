const test = require("node:test");
const assert = require("node:assert/strict");
const { makeEntry, wordCount, summarise, parseLines } = require("../src/shared/stats");

test("wordCount counts words, including contractions", () => {
  assert.equal(wordCount("I'll see you Friday, okay?"), 5);
  assert.equal(wordCount(""), 0);
});

test("summarise works out speed, time saved and top fillers", () => {
  const now = new Date("2026-11-22T18:00:00Z");
  const entries = [
    // 120 words spoken in one minute
    makeEntry({ at: new Date("2026-11-22T09:00:00Z"), audioMs: 60000, words: 120, fillers: { um: 3, "you know": 1 } }),
    makeEntry({ at: new Date("2026-11-21T09:00:00Z"), audioMs: 30000, words: 60, fillers: { um: 1, basically: 2 } }),
    // Too old for a 7-day report
    makeEntry({ at: new Date("2026-11-01T09:00:00Z"), audioMs: 60000, words: 999, fillers: { like: 50 } }),
  ];
  const report = summarise(entries, { now });

  assert.equal(report.dictations, 2);
  assert.equal(report.words, 180);
  assert.equal(report.speakingWpm, 120); // 180 words in 1.5 minutes
  // Typing 180 words at 40 wpm = 4.5 min; speaking took 1.5 min.
  assert.equal(report.minutesSaved, 3);
  assert.deepEqual(report.topFillers[0], { word: "um", count: 4 });
  assert.equal(report.perDay.length, 7);
  assert.equal(report.perDay.at(-1).words, 120);
});

test("summarise copes with no dictations", () => {
  const report = summarise([], { now: new Date("2026-11-22T18:00:00Z") });
  assert.equal(report.words, 0);
  assert.equal(report.speakingWpm, 0);
  assert.equal(report.minutesSaved, 0);
});

test("parseLines skips a damaged line instead of failing", () => {
  const text = '{"words":3}\nnot json\n{"words":4}\n';
  assert.deepEqual(parseLines(text), [{ words: 3 }, { words: 4 }]);
});

test("stats entries never contain the dictated text", () => {
  const entry = makeEntry({ audioMs: 1000, words: 2, fillers: {}, mode: "dictate" });
  assert.deepEqual(Object.keys(entry).sort(), ["at", "audioMs", "fillers", "mode", "words"]);
});
