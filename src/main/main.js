// Lydia's Flow: the main process. It wires the pieces together:
//
//   key listener --DOWN--> pill window starts recording
//                --UP----> pill sends audio --> transcriber --> pipeline --> paste
//
// It also owns the menu bar icon, the settings and Flow Report windows, and
// the network guard that keeps every window offline.

const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, screen, session, systemPreferences, nativeImage } = require("electron");

const { installNetworkGuard } = require("../shared/networkGuard");
const { toBritish } = require("../shared/ukSpelling");
const { makeEntry, wordCount, summarise, parseLines } = require("../shared/stats");
const { Transcriber } = require("./transcriber");
const { Cleaner } = require("./cleaner");
const { processSpeech } = require("./pipeline");
const { createPaster } = require("./paste");
const { startKeyListener } = require("./keyListener");
const { loadSettings, saveSettings, KEY_CHOICES } = require("./settings");

// In development everything sits in the project folder; in the built app the
// engines, models and key listener are copied next to it (see package.json "build").
const RESOURCES = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "..");
const DIRS = { enginesDir: path.join(RESOURCES, "engines"), modelsDir: path.join(RESOURCES, "models") };
const KEY_LISTENER = path.join(RESOURCES, "bin", "key-listener");
const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");
const STATS_FILE = path.join(app.getPath("userData"), "flow-stats.jsonl");
const MIN_AUDIO_SECONDS = 0.3; // shorter than this is an accidental tap

let settings;
let transcriber;
let cleaner;
let keys;
let tray;
let pill;
let settingsWindow;
let reportWindow;
let busy = false; // one dictation at a time
let mode = null; // "dictate" or "edit" while a key is held

const paster = createPaster({ clipboard });

// ---- Windows ---------------------------------------------------------------

function loadPage(win, page) {
  win.loadFile(path.join(__dirname, "..", "renderer", page));
}

function webPreferences() {
  return { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true };
}

// The pill never takes focus: if it did, the paste would land in it instead of
// in the app you were typing in.
function createPill() {
  pill = new BrowserWindow({
    width: 240,
    height: 64,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: webPreferences(),
  });
  pill.setAlwaysOnTop(true, "screen-saver");
  pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pill.setIgnoreMouseEvents(true);
  loadPage(pill, "pill.html");
}

function showPill(state, detail = "") {
  // Bottom centre of whichever screen the mouse is on.
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [width, height] = pill.getSize();
  pill.setPosition(Math.round(workArea.x + (workArea.width - width) / 2), workArea.y + workArea.height - height - 24);
  pill.webContents.send("pill:state", { state, detail });
  if (!pill.isVisible()) pill.showInactive();
}

function hidePillSoon(ms = 900) {
  setTimeout(() => {
    if (!mode && !busy) pill.hide();
  }, ms);
}

function openWindow(existing, page, options) {
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }
  const win = new BrowserWindow({ ...options, show: false, titleBarStyle: "hiddenInset", webPreferences: webPreferences() });
  loadPage(win, page);
  win.once("ready-to-show", () => win.show());
  return win;
}

function openSettings() {
  settingsWindow = openWindow(settingsWindow, "settings.html", { width: 460, height: 780, minWidth: 420, minHeight: 500 });
}

function openReport() {
  reportWindow = openWindow(reportWindow, "report.html", { width: 560, height: 640, resizable: false });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "renderer", "trayTemplate.png"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  if (icon.isEmpty()) tray.setTitle("Flow");
  tray.setToolTip("Lydia's Flow");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Flow Report", click: openReport },
      { label: "Settings", click: openSettings },
      { type: "separator" },
      { label: "Quit Lydia's Flow", click: () => app.quit() },
    ]),
  );
}

// ---- Keys --------------------------------------------------------------------

function startKeys() {
  keys?.stop();
  keys = startKeyListener(KEY_LISTENER, [settings.dictateKey, settings.editKey]);
  keys.on("no-permission", () => {
    // Shows the macOS prompt that leads to Privacy & Security > Accessibility.
    systemPreferences.isTrustedAccessibilityClient(true);
  });
  keys.on("down", (key) => {
    if (busy || mode) return;
    if (key === settings.dictateKey) mode = "dictate";
    else if (key === settings.editKey) mode = "edit";
    else return;
    showPill(mode === "edit" ? "editing" : "listening");
    pill.webContents.send("pill:record", { start: true, microphoneId: settings.microphoneId });
  });
  keys.on("up", (key) => {
    const heldKey = mode === "dictate" ? settings.dictateKey : settings.editKey;
    if (!mode || key !== heldKey) return;
    pill.webContents.send("pill:record", { start: false });
    showPill("working");
  });
}

// ---- The dictation itself ------------------------------------------------------

async function handleAudio(samples) {
  const action = mode;
  mode = null;
  if (!action) return;
  if (samples.length / 16000 < MIN_AUDIO_SECONDS) return pill.hide();

  busy = true;
  try {
    const raw = await transcriber.transcribe(samples);
    if (!raw) {
      showPill("error", "Didn't catch that");
      return;
    }

    let text;
    let fillers = {};
    let snippetsUsed = [];
    if (action === "dictate") {
      // Spoken parts are tidied; any "insert <trigger>" becomes your saved text.
      ({ text, fillers, snippets: snippetsUsed } = await processSpeech(raw, settings, cleaner, {
        clipboard: clipboard.readText(),
      }));
    } else {
      // Edit mode: the key is released now, so Cmd+C arrives as plain Cmd+C.
      const selected = await paster.copySelection();
      if (!selected) {
        showPill("error", "Select some text first");
        return;
      }
      text = await cleaner.edit(selected, raw);
      if (settings.britishEnglish) text = toBritish(text);
    }

    await paster.pasteText(text);
    // With snippets, count the words you said, not the saved text, so speaking speed stays honest.
    const usedSnippets = snippetsUsed.length > 0;
    const words = wordCount(usedSnippets ? raw : text);
    recordStats({ audioMs: (samples.length / 16000) * 1000, words, fillers, mode: usedSnippets ? "snippet" : action });
    showPill("done", usedSnippets ? `Inserted “${snippetsUsed.join("”, “")}”` : "");
  } catch (err) {
    console.error("Dictation failed:", err.message);
    showPill("error", "Something went wrong");
  } finally {
    busy = false;
    hidePillSoon();
  }
}

function recordStats(entry) {
  fs.appendFileSync(STATS_FILE, `${JSON.stringify(makeEntry(entry))}\n`);
}

function readReport() {
  const text = fs.existsSync(STATS_FILE) ? fs.readFileSync(STATS_FILE, "utf8") : "";
  return summarise(parseLines(text));
}

// ---- Messages from the windows (see preload.js) ---------------------------------

ipcMain.on("pill:audio", (_event, buffer) => handleAudio(new Float32Array(buffer)));
ipcMain.on("pill:mic-error", () => {
  mode = null;
  showPill("error", "Microphone unavailable");
  hidePillSoon(1800);
});
ipcMain.handle("settings:get", () => ({ settings, keyChoices: KEY_CHOICES }));
ipcMain.handle("settings:save", (_event, next) => {
  const before = settings;
  // Merge, so a window that sends only some fields never wipes the others.
  settings = saveSettings(SETTINGS_FILE, { ...settings, ...next });
  if (settings.dictateKey !== before.dictateKey || settings.editKey !== before.editKey) startKeys();
  return settings;
});
ipcMain.handle("report:get", () => readReport());
ipcMain.on("open:report", openReport);
ipcMain.on("open:accessibility", () => systemPreferences.isTrustedAccessibilityClient(true));

// ---- Start-up -------------------------------------------------------------------

app.whenReady().then(async () => {
  installNetworkGuard(session.defaultSession, (url) => console.warn("Blocked network request:", url));
  app.dock?.hide(); // a menu bar app: no Dock icon

  settings = loadSettings(SETTINGS_FILE);
  createTray();
  createPill();

  await systemPreferences.askForMediaAccess("microphone");

  transcriber = new Transcriber(DIRS);
  cleaner = new Cleaner(DIRS);
  try {
    await Promise.all([transcriber.start(), cleaner.start()]);
  } catch (err) {
    console.error("Could not start the local engines. Did you run `npm run setup`?", err.message);
    openSettings();
  }
  startKeys();
  if (!fs.existsSync(SETTINGS_FILE)) openSettings(); // first run: show the settings once
});

app.on("window-all-closed", (event) => event.preventDefault()); // stay in the menu bar

app.on("will-quit", () => {
  keys?.stop();
  transcriber?.stop();
  cleaner?.stop();
});
