// Settings window: every change is saved straight away.

const KEY_NAMES = {
  fn: "fn / 🌐",
  rightOption: "Right Option ⌥",
  rightCommand: "Right Command ⌘",
  rightShift: "Right Shift ⇧",
  rightControl: "Right Control ⌃",
};

const fields = ["dictateKey", "editKey", "microphoneId", "cleanup", "britishEnglish"];
const el = Object.fromEntries(fields.map((id) => [id, document.getElementById(id)]));

function fillSelect(select, options, selected) {
  select.replaceChildren(
    ...options.map(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      option.selected = value === selected;
      return option;
    }),
  );
}

async function microphones() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default");
  return [["default", "Mac default"], ...inputs.map((d) => [d.deviceId, d.label || "Microphone"])];
}

function render(settings, keyChoices, mics) {
  const keyOptions = keyChoices.map((k) => [k, KEY_NAMES[k] || k]);
  fillSelect(el.dictateKey, keyOptions, settings.dictateKey);
  fillSelect(el.editKey, keyOptions, settings.editKey);
  fillSelect(el.microphoneId, mics, settings.microphoneId);
  el.cleanup.checked = settings.cleanup;
  el.britishEnglish.checked = settings.britishEnglish;
}

// ---- Snippets --------------------------------------------------------------
// The list lives here while you edit. Only complete snippets (trigger and
// text both filled in) are saved, so a half-typed row is never lost or saved.

let snippets = [];
const snippetList = document.getElementById("snippetList");

function saveSnippets() {
  const complete = snippets.filter((s) => s.trigger.trim() && s.text.trim());
  window.flow.saveSettings({ snippets: complete });
}

function drawSnippets() {
  snippetList.replaceChildren(
    ...snippets.map((snippet, index) => {
      const row = document.createElement("div");
      row.className = "snippet";

      const trigger = document.createElement("input");
      trigger.placeholder = "Trigger, e.g. my sign-off";
      trigger.value = snippet.trigger;
      trigger.addEventListener("input", () => (snippet.trigger = trigger.value));
      trigger.addEventListener("change", saveSnippets);

      const remove = document.createElement("button");
      remove.className = "delete";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        snippets.splice(index, 1);
        drawSnippets();
        saveSnippets();
      });

      const text = document.createElement("textarea");
      text.placeholder = "Text to type";
      text.value = snippet.text;
      text.addEventListener("input", () => (snippet.text = text.value));
      text.addEventListener("change", saveSnippets);

      row.append(trigger, remove, text);
      return row;
    }),
  );
}

document.getElementById("addSnippet").addEventListener("click", () => {
  snippets.push({ trigger: "", text: "" });
  drawSnippets();
  snippetList.lastElementChild.querySelector("input").focus();
});

// ---- Start-up ----------------------------------------------------------------

async function init() {
  const { settings, keyChoices } = await window.flow.getSettings();
  const mics = await microphones();
  render(settings, keyChoices, mics);
  snippets = settings.snippets.map((s) => ({ ...s }));
  drawSnippets();

  for (const id of fields) {
    el[id].addEventListener("change", async () => {
      const next = {
        dictateKey: el.dictateKey.value,
        editKey: el.editKey.value,
        microphoneId: el.microphoneId.value,
        cleanup: el.cleanup.checked,
        britishEnglish: el.britishEnglish.checked,
      };
      // Main may adjust the values (e.g. two actions on one key), so redraw from its answer.
      render(await window.flow.saveSettings(next), keyChoices, mics);
    });
  }

  document.getElementById("report").addEventListener("click", () => window.flow.openReport());
  document.getElementById("accessibility").addEventListener("click", (event) => {
    event.preventDefault();
    window.flow.openAccessibility();
  });
}

init();
