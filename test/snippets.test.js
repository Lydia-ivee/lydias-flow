const test = require("node:test");
const assert = require("node:assert/strict");
const { normalise, similarity, matchSnippet, expandPlaceholders, cleanSnippets } = require("../src/shared/snippets");

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

test("allows one stray word before the command word (a misheard 'um')", () => {
  assert.equal(matchSnippet("Come, insert my address.", SNIPPETS).trigger, "my address");
  assert.equal(matchSnippet("Arm, snippet meeting link", SNIPPETS).trigger, "meeting link");
  // Two words before it is ordinary speech.
  assert.equal(matchSnippet("Could you insert my address", SNIPPETS), null);
});
