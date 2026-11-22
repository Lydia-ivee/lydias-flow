// User settings, stored as a small JSON file in the app's data folder.

const fs = require("fs");
const { cleanSnippets } = require("../shared/snippets");

const KEY_CHOICES = ["fn", "rightOption", "rightCommand", "rightShift", "rightControl"];

const DEFAULTS = {
  microphoneId: "default", // "default" follows the Mac's chosen input
  dictateKey: "fn",
  editKey: "rightOption",
  cleanup: true, // tidy text with the local AI model
  britishEnglish: true,
  // Say "insert today's date". One example to start with; edit them in Settings.
  snippets: [{ trigger: "today's date", text: "{date}" }],
};

// Merge saved values over the defaults, ignoring anything unknown or invalid,
// so a hand-edited or old settings file can never break the app.
function withDefaults(saved = {}) {
  const settings = { ...DEFAULTS, snippets: DEFAULTS.snippets.map((s) => ({ ...s })) };
  if (saved.snippets !== undefined) settings.snippets = cleanSnippets(saved.snippets);
  if (typeof saved.microphoneId === "string") settings.microphoneId = saved.microphoneId;
  if (KEY_CHOICES.includes(saved.dictateKey)) settings.dictateKey = saved.dictateKey;
  if (KEY_CHOICES.includes(saved.editKey)) settings.editKey = saved.editKey;
  if (typeof saved.cleanup === "boolean") settings.cleanup = saved.cleanup;
  if (typeof saved.britishEnglish === "boolean") settings.britishEnglish = saved.britishEnglish;
  // The two actions cannot share a key.
  if (settings.editKey === settings.dictateKey) settings.editKey = KEY_CHOICES.find((k) => k !== settings.dictateKey);
  return settings;
}

function loadSettings(file) {
  try {
    return withDefaults(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch {
    return withDefaults();
  }
}

function saveSettings(file, settings) {
  const clean = withDefaults(settings);
  fs.writeFileSync(file, JSON.stringify(clean, null, 2));
  return clean;
}

module.exports = { DEFAULTS, KEY_CHOICES, withDefaults, loadSettings, saveSettings };
