const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalise,
  similarity,
  matchSnippet,
  splitOnSnippets,
  joinParts,
  expandPlaceholders,
  cleanSnippets,
} = require("../src/shared/snippets");

const SNIPPETS = [
  { trigger: "my sign-off", text: "Best wishes,\nLydia" },
  { trigger: "meeting link", text: "https://example.com/meet" },
  { trigger: "my address", text: "1 Example Street, London" },
];

test("normalise drops case, punctuation, hyphens and noise words", () => {
  assert.equal(normalise("Um, Insert my sign-off."), "insert my sign off");
  assert.equal(normalise("I'll"), "ill");
});

test("matches a snippet said exactly", () => {
  assert.equal(matchSnippet("Insert my sign-off.", SNIPPETS).text, "Best wishes,\nLydia");
  assert.equal(matchSnippet("Snippet meeting link", SNIPPETS).text, "https://example.com/meet");
});

test("matches when speech recognition mishears a little", () => {
  assert.equal(matchSnippet("Insert my sign of.", SNIPPETS).trigger, "my sign-off");
  assert.equal(matchSnippet("Um, insert my adress", SNIPPETS).trigger, "my address");
});

test("never fires without the command word", () => {
  assert.equal(matchSnippet("my sign-off", SNIPPETS), null);
  assert.equal(matchSnippet("Please send the meeting link to Sam.", SNIPPETS), null);
});

test("never fires when the rest is ordinary dictation", () => {
  assert.equal(matchSnippet("Insert a table of results here.", SNIPPETS), null);
  assert.equal(matchSnippet("Insert", SNIPPETS), null);
});

test("picks the closest of two similar triggers", () => {
  const similar = [
    { trigger: "my address", text: "home" },
    { trigger: "my work address", text: "work" },
  ];
  assert.equal(matchSnippet("insert my work address", similar).text, "work");
  assert.equal(matchSnippet("insert my address", similar).text, "home");
});

test("similarity is 1 for identical text and lower as text differs", () => {
  assert.equal(similarity("abc", "abc"), 1);
  assert.ok(similarity("my sign of", "my sign off") > 0.9);
  assert.ok(similarity("meeting link", "my address") < 0.5);
});

test("placeholders fill in the date, time and clipboard", () => {
  const now = new Date("2026-11-23T09:05:00");
  const text = expandPlaceholders("Update for {date} at {time}: {clipboard} {unknown}", { now, clipboard: "copied" });
  assert.equal(text, "Update for Monday 23 November 2026 at 09:05: copied {unknown}");
});

test("cleanSnippets drops broken entries and trims long ones", () => {
  const cleaned = cleanSnippets([
    { trigger: "  ok  ", text: "fine" },
    { trigger: "", text: "no trigger" },
    { trigger: "no text", text: "" },
    { trigger: 42, text: "wrong type" },
    null,
  ]);
  assert.deepEqual(cleaned, [{ trigger: "ok", text: "fine" }]);
  assert.deepEqual(cleanSnippets("not a list"), []);
});

const SIGN_OFF = SNIPPETS[0];
const ADDRESS = SNIPPETS[2];

test("finds a snippet at the end of a sentence", () => {
  assert.deepEqual(splitOnSnippets("Thanks for your time today, insert my sign-off.", SNIPPETS), [
    { text: "Thanks for your time today" },
    { snippet: SIGN_OFF },
  ]);
});

test("finds a snippet in the middle, keeping the words either side", () => {
  assert.deepEqual(splitOnSnippets("Send it to me at insert my address, by Friday please.", SNIPPETS), [
    { text: "Send it to me at" },
    { snippet: ADDRESS },
    { text: "by Friday please." },
  ]);
});

test("finds two snippets in one go", () => {
  const parts = splitOnSnippets("Insert my address. Thanks, insert my sign-off", SNIPPETS);
  assert.deepEqual(parts, [{ snippet: ADDRESS }, { text: "Thanks" }, { snippet: SIGN_OFF }]);
});

test("mid-sentence 'insert' that matches no trigger changes nothing", () => {
  const text = "We should insert a table of results here, then my sign-off.";
  assert.deepEqual(splitOnSnippets(text, SNIPPETS), [{ text }]);
});

test("skips a spoken 'um' between the command word and the trigger", () => {
  assert.equal(matchSnippet("Insert, um, my sign-off", SNIPPETS), SIGN_OFF);
});

test("joinParts puts multi-line snippets on their own line", () => {
  assert.equal(
    joinParts([{ text: "Thanks for today." }, { text: "Best wishes,\nLydia", multiline: true }]),
    "Thanks for today.\nBest wishes,\nLydia",
  );
  assert.equal(
    joinParts([{ text: "Send it to" }, { text: "1 Example Street" }, { text: "by Friday." }]),
    "Send it to 1 Example Street by Friday.",
  );
  assert.equal(joinParts([{ text: "A" }, { text: "B\nC", multiline: true }, { text: "D" }]), "A\nB\nC\nD");
});
