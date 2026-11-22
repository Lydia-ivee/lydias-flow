const test = require("node:test");
const assert = require("node:assert/strict");
const { processDictation } = require("../src/main/pipeline");

const RAW = "Um, so basically I want to organize the color of the center page, you know, before Friday.";

// A stand-in for the AI model, so the recipe can be tested in milliseconds.
const fakeCleaner = (reply) => ({ clean: async (text) => ({ text: reply ?? text, usedModel: true }) });

test("rules only: noise removed, British spelling applied", async () => {
  const result = await processDictation(RAW, { cleanup: false, britishEnglish: true });
  assert.equal(result.text, "So basically I want to organise the colour of the centre page, you know, before Friday.");
  assert.equal(result.usedModel, false);
});

test("British spelling runs after the model, so it wins", async () => {
  const americanReply = "I want to organize the color of the center page before Friday.";
  const result = await processDictation(RAW, { cleanup: true, britishEnglish: true }, fakeCleaner(americanReply));
  assert.equal(result.text, "I want to organise the colour of the centre page before Friday.");
  assert.equal(result.usedModel, true);
});

test("filler counts come from the raw transcript", async () => {
  const result = await processDictation(RAW, { cleanup: true, britishEnglish: false }, fakeCleaner("Tidy."));
  assert.deepEqual(result.fillers, { "you know": 1, um: 1, basically: 1 });
});

test("a failing model still types the rule-cleaned words", async () => {
  const broken = { clean: async () => { throw new Error("server down"); } };
  const result = await processDictation(RAW, { cleanup: true, britishEnglish: false }, broken);
  assert.equal(result.text, "So basically I want to organize the color of the center page, you know, before Friday.");
});
