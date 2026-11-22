const test = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedUrl } = require("../src/shared/networkGuard");

test("network guard allows only the app talking to itself", () => {
  assert.equal(isAllowedUrl("file:///Applications/app/index.html"), true);
  assert.equal(isAllowedUrl("http://127.0.0.1:6108/v1/chat/completions"), true);
  assert.equal(isAllowedUrl("ws://127.0.0.1:6107"), true);
  assert.equal(isAllowedUrl("http://localhost:5173"), true);
  assert.equal(isAllowedUrl("http://[::1]:8080"), true);
});

test("network guard refuses everything else", () => {
  assert.equal(isAllowedUrl("https://example.com"), false);
  assert.equal(isAllowedUrl("https://api.openai.com/v1/chat"), false);
  assert.equal(isAllowedUrl("wss://evil.example/socket"), false);
  // Tricks that look local but are not.
  assert.equal(isAllowedUrl("http://127.0.0.1.example.com"), false);
  assert.equal(isAllowedUrl("http://localhost@example.com"), false);
  assert.equal(isAllowedUrl("ftp://127.0.0.1"), false);
  assert.equal(isAllowedUrl("not a url"), false);
});
