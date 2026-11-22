const test = require("node:test");
const assert = require("node:assert/strict");
const { createPaster } = require("../src/main/paste");
const { parseLine } = require("../src/main/keyListener");
const { withDefaults, DEFAULTS } = require("../src/main/settings");

// A pretend clipboard and keyboard. Pressing "c" copies whatever `selection` is.
function fakeMac({ clipboardText = "my old copy", selection = "" } = {}) {
  const mac = { clipboard: clipboardText, pasted: [] };
  mac.api = {
    clipboard: { readText: () => mac.clipboard, writeText: (t) => (mac.clipboard = t) },
    press: async (letter) => {
      if (letter === "v") mac.pasted.push(mac.clipboard);
      if (letter === "c" && selection) mac.clipboard = selection;
    },
    sleep: async () => {},
  };
  return mac;
}

test("pasteText types the text and gives the clipboard back", async () => {
  const mac = fakeMac();
  await createPaster(mac.api).pasteText("See you Friday.");
  assert.deepEqual(mac.pasted, ["See you Friday."]);
  assert.equal(mac.clipboard, "my old copy");
});

test("copySelection returns the selected text and restores the clipboard", async () => {
  const mac = fakeMac({ selection: "a long rambling paragraph" });
  assert.equal(await createPaster(mac.api).copySelection(), "a long rambling paragraph");
  assert.equal(mac.clipboard, "my old copy");
});

test("copySelection returns empty when nothing is selected", async () => {
  const mac = fakeMac({ selection: "" });
  assert.equal(await createPaster(mac.api).copySelection(), "");
  assert.equal(mac.clipboard, "my old copy");
});

test("key listener lines become events", () => {
  assert.deepEqual(parseLine("DOWN fn"), { type: "down", key: "fn" });
  assert.deepEqual(parseLine("UP rightOption\n"), { type: "up", key: "rightOption" });
  assert.deepEqual(parseLine("READY"), { type: "ready" });
  assert.deepEqual(parseLine("NO_PERMISSION"), { type: "no-permission" });
  assert.equal(parseLine("garbage"), null);
});

test("settings fall back to defaults for anything missing or invalid", () => {
  assert.deepEqual(withDefaults(), DEFAULTS);
  const odd = withDefaults({ dictateKey: "capsLock", cleanup: "yes", britishEnglish: false });
  assert.equal(odd.dictateKey, "fn");
  assert.equal(odd.cleanup, true);
  assert.equal(odd.britishEnglish, false);
});

test("settings never give both actions the same key", () => {
  const clash = withDefaults({ dictateKey: "rightOption", editKey: "rightOption" });
  assert.notEqual(clash.dictateKey, clash.editKey);
});

test("settings keep valid snippets and start with one example", () => {
  assert.equal(withDefaults().snippets.length, 1);
  const saved = withDefaults({ snippets: [{ trigger: "my sign-off", text: "Best,\nLydia" }, { trigger: "", text: "x" }] });
  assert.deepEqual(saved.snippets, [{ trigger: "my sign-off", text: "Best,\nLydia" }]);
  assert.deepEqual(withDefaults({ snippets: [] }).snippets, []); // deleting them all sticks
});
