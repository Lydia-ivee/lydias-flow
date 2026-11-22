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

// ---- Snippets inside dictation (processSpeech) ----
const { processSpeech } = require("../src/main/pipeline");

const settingsWithSnippets = {
  cleanup: false,
  britishEnglish: true,
  snippets: [
    { trigger: "my sign-off", text: "Best wishes,\nLydia" },
    { trigger: "my address", text: "1 Example Street" },
  ],
};

test("a snippet at the end of a sentence goes on its own line", async () => {
  const result = await processSpeech("Thanks for the colorful slides, insert my sign-off.", settingsWithSnippets);
  assert.equal(result.text, "Thanks for the colourful slides\nBest wishes,\nLydia");
  assert.deepEqual(result.snippets, ["my sign-off"]);
});

test("a one-line snippet sits inside the sentence", async () => {
  const result = await processSpeech("Send it to insert my address by Friday.", settingsWithSnippets);
  assert.equal(result.text, "Send it to 1 Example Street by Friday.");
});

test("spoken parts are tidied; snippet text is never changed", async () => {
  const settings = { ...settingsWithSnippets, cleanup: true, snippets: [{ trigger: "color code", text: "color: #8b7cff" }] };
  const tidy = { clean: async (text) => ({ text: `${text}.`, usedModel: true }) };
  const result = await processSpeech("Um, here is the insert color code", settings, tidy);
  // "colour" rules apply to what you said, never to your saved snippet.
  assert.equal(result.text, "Here is the. color: #8b7cff");
});

test("dictation with no snippet behaves exactly as before", async () => {
  const result = await processSpeech("Um, we should insert a table here.", settingsWithSnippets);
  assert.equal(result.text, "We should insert a table here.");
  assert.deepEqual(result.snippets, []);
});

test("a proper noun after a mid-sentence snippet keeps its capital", async () => {
  const result = await processSpeech("Send it to insert my address London.", settingsWithSnippets);
  assert.equal(result.text, "Send it to 1 Example Street London.");
});
