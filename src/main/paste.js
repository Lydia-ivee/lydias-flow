// Typing into whatever app you're using, via the clipboard.
//
// macOS has no "insert text at the cursor" API for other apps, so this does
// what a person would: put the text on the clipboard and press Cmd+V. Your
// clipboard is saved first and put back afterwards, so dictating never wipes
// something you had copied. Pressing keys in other apps needs the
// Accessibility permission.
//
// The clipboard, key presses and waiting are passed in, so the logic can be
// tested without touching the real clipboard.

const { execFile } = require("child_process");

/**
 * @param {string} letter
 * @returns {Promise<void>}
 */
function pressKeys(letter) {
  const script = `tell application "System Events" to keystroke "${letter}" using command down`;
  return new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script], (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The bits of Electron's clipboard this uses, so tests can pass a stand-in.
 * @typedef {{ readText(): string, writeText(text: string): void }} TextClipboard
 */

/**
 * @param {{ clipboard: TextClipboard, press?: (letter: string) => Promise<void>, sleep?: (ms: number) => Promise<void> }} options
 */
function createPaster({ clipboard, press = pressKeys, sleep = wait }) {
  // Give the target app time to read the clipboard before we restore it.
  const READ_DELAY_MS = 250;

  /**
   * @param {string} text
   * @returns {Promise<void>}
   */
  async function pasteText(text) {
    const saved = clipboard.readText();
    clipboard.writeText(text);
    try {
      await press("v");
      await sleep(READ_DELAY_MS);
    } finally {
      clipboard.writeText(saved);
    }
  }

  // Copies the current selection and returns it ("" if nothing is selected).
  /** @returns {Promise<string>} */
  async function copySelection() {
    const saved = clipboard.readText();
    const marker = `__flow_${Date.now()}__`; // tells "nothing copied" apart from old text
    clipboard.writeText(marker);
    try {
      await press("c");
      for (let i = 0; i < 10; i += 1) {
        await sleep(40);
        const now = clipboard.readText();
        if (now !== marker) return now;
      }
      return "";
    } finally {
      clipboard.writeText(saved);
    }
  }

  return { pasteText, copySelection };
}

module.exports = { createPaster };
