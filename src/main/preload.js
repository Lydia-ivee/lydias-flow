// The only bridge between the windows and the main process. Windows run
// sandboxed and get exactly these functions, nothing else.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flow", {
  // Pill window
  onState: (callback) => ipcRenderer.on("pill:state", (_e, state) => callback(state)),
  onRecord: (callback) => ipcRenderer.on("pill:record", (_e, command) => callback(command)),
  sendAudio: (samples) => ipcRenderer.send("pill:audio", samples),
  micError: () => ipcRenderer.send("pill:mic-error"),

  // Settings window
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  openReport: () => ipcRenderer.send("open:report"),
  openAccessibility: () => ipcRenderer.send("open:accessibility"),

  // Flow Report window
  getReport: () => ipcRenderer.invoke("report:get"),
});
