const test = require("node:test");
const assert = require("node:assert/strict");
const { removeFillers, countFillers } = require("../src/shared/fillers");
const { buildCleanupMessages, acceptCleanup, tidyModelOutput } = require("../src/shared/prompts");

const TRANSCRIPT = "Um, so basically I want to organize the color of the center page, you know, before Friday.";

test("removeFillers strips pure noise and fixes the capital", () => {
  assert.equal(
    removeFillers(TRANSCRIPT),
    "So basically I want to organize the color of the center page, you know, before Friday.",
  );
  assert.equal(removeFillers("I think, uh, we should go. Erm, yes."), "I think, we should go. Yes.");
});

test("removeFillers does not touch words that only contain a filler", () => {
  assert.equal(removeFillers("The umbrella was under the hummingbird."), "The umbrella was under the hummingbird.");
});

test("countFillers counts phrases and words, returning numbers only", () => {
  assert.deepEqual(countFillers(TRANSCRIPT), { "you know": 1, um: 1, basically: 1 });
  assert.deepEqual(countFillers("Like, I like it, like, a lot."), { like: 3 });
  assert.deepEqual(countFillers("Nothing to see here."), {});
});

test("cleanup prompt ends with the user's text and includes one example", () => {
  const messages = buildCleanupMessages("hello there");
  assert.equal(messages[0].role, "system");
  assert.equal(messages.at(-1).content, "hello there");
  assert.equal(messages.filter((m) => m.role === "assistant").length, 1);
});

test("tidyModelOutput removes wrappers small models add", () => {
  assert.equal(tidyModelOutput('Here is the cleaned text: "See you Friday."'), "See you Friday.");
  assert.equal(tidyModelOutput("  See you Friday.  "), "See you Friday.");
});

test("acceptCleanup uses the model's answer when it is sensible", () => {
  const result = acceptCleanup("um see you friday", "See you Friday.");
  assert.deepEqual(result, { text: "See you Friday.", usedModel: true });
});

test("acceptCleanup falls back when the model answers instead of tidying", () => {
  const input = "what is the capital of France";
  const rambling = "The capital of France is Paris. It is known for the Eiffel Tower, the Louvre and its cafés.";
  assert.deepEqual(acceptCleanup(input, rambling), { text: input, usedModel: false });
});

test("acceptCleanup falls back on an empty answer", () => {
  assert.deepEqual(acceptCleanup("see you friday", "   "), { text: "see you friday", usedModel: false });
});
