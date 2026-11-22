const test = require("node:test");
const assert = require("node:assert/strict");
const { words, wordErrorRate, countPhrases, percentile, mean } = require("../evals/metrics");

test("words ignores case and punctuation but keeps contractions", () => {
  assert.deepEqual(words("Let’s meet on Friday, OK?"), ["let's", "meet", "on", "friday", "ok"]);
  assert.deepEqual(words("'quoted' text"), ["quoted", "text"]);
});

test("word error rate is 0 for a perfect match", () => {
  assert.equal(wordErrorRate("See you Friday.", "see you friday"), 0);
});

test("word error rate counts substitutions, deletions and insertions", () => {
  assert.equal(wordErrorRate("see you on friday", "see you on monday"), 0.25); // 1 swap / 4
  assert.equal(wordErrorRate("see you on friday", "see you friday"), 0.25); // 1 missing / 4
  assert.equal(wordErrorRate("see you friday", "see you on friday"), 1 / 3); // 1 extra / 3
});

test("word error rate handles empty text", () => {
  assert.equal(wordErrorRate("", ""), 0);
  assert.equal(wordErrorRate("", "something"), 1);
  assert.equal(wordErrorRate("something", ""), 1);
});

test("countPhrases matches whole words and phrases only", () => {
  const text = "Um, you know, the umbrella is, um, basically mine.";
  assert.equal(countPhrases(text, ["um"]), 2); // not "umbrella"
  assert.equal(countPhrases(text, ["you know", "basically"]), 2);
});

test("percentile and mean", () => {
  const values = [100, 200, 300, 400, 1000];
  assert.equal(percentile(values, 50), 300);
  assert.equal(percentile(values, 95), 1000);
  assert.equal(mean(values), 400);
  assert.equal(percentile([], 50), 0);
});
