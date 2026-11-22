// Speech-to-text, on the Mac.
//
// Runs the sherpa-onnx speech server with NVIDIA's Parakeet model, and talks to
// it over a WebSocket on 127.0.0.1. The server keeps the model loaded, so each
// dictation only pays for recognition (~0.2s on an M2), not for loading.

const path = require("path");
const WebSocket = require("ws");
const { findFreePort, waitUntilReady, canConnect, startProcess } = require("./localServer");

class Transcriber {
  constructor({ enginesDir, modelsDir }) {
    this.binary = path.join(enginesDir, "sherpa", "sherpa-onnx-offline-websocket-server");
    this.modelDir = path.join(modelsDir, "parakeet");
    this.child = null;
    this.port = null;
  }

  async start() {
    this.port = await findFreePort();
    const model = (file) => path.join(this.modelDir, file);
    this.child = startProcess(this.binary, [
      `--tokens=${model("tokens.txt")}`,
      `--encoder=${model("encoder.int8.onnx")}`,
      `--decoder=${model("decoder.int8.onnx")}`,
      `--joiner=${model("joiner.int8.onnx")}`,
      `--port=${this.port}`,
      "--num-threads=4",
    ]);
    await waitUntilReady(this.child, () => canConnect(this.port), { name: "Speech server" });
  }

  // samples: Float32Array of mono audio at `sampleRate` (16 kHz from the recorder).
  transcribe(samples, sampleRate = 16000) {
    return new Promise((resolve, reject) => {
      // The server's message format: [int32 sample rate][int32 byte count][float32 samples].
      const audio = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
      const message = Buffer.alloc(8 + audio.length);
      message.writeInt32LE(sampleRate, 0);
      message.writeInt32LE(audio.length, 4);
      audio.copy(message, 8);

      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
      let reply = "";
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error("Speech server took too long"));
      }, 30000);

      ws.on("open", () => ws.send(message));
      ws.on("message", (data) => {
        reply += data.toString();
        ws.send("Done"); // tells the server we have no more audio
      });
      ws.on("close", () => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(reply).text.trim());
        } catch {
          reject(new Error("Speech server sent an unreadable reply"));
        }
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  stop() {
    this.child?.kill();
    this.child = null;
  }
}

module.exports = { Transcriber };
