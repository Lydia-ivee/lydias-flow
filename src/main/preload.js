// The only bridge between the windows and the main process. Windows run
// sandboxed and get exactly these functions, nothing else.

const { contextBridge, ipcRenderer } = require("electron");

/** @typedef {import("../shared/types").Settings} Settings */

contextBridge.exposeInMainWorld("flow", {
  // Pill window
  /** @param {(state: { state: string, detail: string }) => void} callback */
  onState: (callback) => ipcRenderer.on("pill:state", (_e, state) => callback(state)),
  /** @param {(command: { start: boolean, microphoneId?: string, live?: boolean }) => void} callback */
  onRecord: (callback) => ipcRenderer.on("pill:record", (_e, command) => callback(command)),
  /** @param {ArrayBuffer} samples the recorder's Float32Array buffer */
  sendAudio: (samples) => ipcRenderer.send("pill:audio", samples),
  /** @param {ArrayBuffer} samples one block of audio while recording, for the live preview */
  sendChunk: (samples) => ipcRenderer.send("pill:audio-chunk", samples),
  /** @param {(text: string) => void} callback */
  onLiveText: (callback) => ipcRenderer.on("pill:live", (_e, text) => callback(text)),
  micError: () => ipcRenderer.send("pill:mic-error"),

  // Settings window
  getSettings: () => ipcRenderer.invoke("settings:get"),
  /** @param {Partial<Settings>} settings */
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  openReport: () => ipcRenderer.send("open:report"),
  openAccessibility: () => ipcRenderer.send("open:accessibility"),

  // Flow Report window
  getReport: () => ipcRenderer.invoke("report:get"),
});
