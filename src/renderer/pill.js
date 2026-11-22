// The floating pill: shows what's happening, and does the recording.

const pill = document.getElementById("pill");
const label = document.getElementById("label");
const bars = [...document.querySelectorAll(".bars span")];

const LABELS = {
  listening: "Listening",
  editing: "Say your edit",
  working: "Tidying up",
  done: "Typed",
  error: "Error",
};

window.flow.onState(({ state, detail }) => {
  pill.dataset.state = state;
  pill.classList.remove("live");
  label.textContent = detail || LABELS[state] || "";
  if (state !== "listening" && state !== "editing") bars.forEach((bar) => (bar.style.height = ""));
});

// Live text: show the end of what has been heard so far, cut at a word.
const MAX_LIVE_CHARS = 46;
function tail(text) {
  if (text.length <= MAX_LIVE_CHARS) return text;
  const cut = text.slice(-MAX_LIVE_CHARS);
  return `…${cut.slice(cut.indexOf(" ") + 1)}`;
}

window.flow.onLiveText((text) => {
  if (pill.dataset.state !== "listening" && pill.dataset.state !== "editing") return; // too late
  pill.classList.add("live");
  label.textContent = tail(text);
});

// Each bar gets a slightly different share of the level, so it looks like a wave.
const SHAPE = [0.55, 0.85, 1, 0.8, 0.5];
function showLevel(level) {
  const loudness = Math.min(1, level * 12);
  bars.forEach((bar, i) => (bar.style.height = `${4 + loudness * 16 * SHAPE[i]}px`));
}

// Opening the mic takes a moment. A quick tap can release the key before it is
// open, so "stop" always waits for "start" to finish: the mic is never left on.
let starting = null;
window.flow.onRecord(async ({ start, microphoneId, live }) => {
  if (start && !starting) {
    // With live text on, every block of audio also goes to the main process.
    const sendChunk = live ? (block) => window.flow.sendChunk(block.buffer) : undefined;
    starting = recorder.start(microphoneId, showLevel, sendChunk).catch(() => {
      window.flow.micError();
      return "failed";
    });
  } else if (!start && starting) {
    const result = await starting;
    starting = null;
    if (result === "failed") return;
    const samples = await recorder.stop();
    window.flow.sendAudio(samples.buffer);
  }
});
