// Speech-to-text, inside the app.
//
// Uses sherpa-onnx's Node.js package to run NVIDIA's Parakeet model directly
// in this process: no server, no network port, nothing another device could
// connect to. Loading the model takes ~3s once at start-up; after that each
// dictation takes ~0.2s on an M2. Both steps run off the main thread
// (createAsync / decodeAsync), so the app never freezes while it works.

const path = require("path");
const sherpa = require("sherpa-onnx-node");

const TRAILING_SILENCE_SECONDS = 0.5;

class Transcriber {
  constructor({ modelsDir }) {
    this.modelDir = path.join(modelsDir, "parakeet");
    this.recognizer = null;
  }

  async start() {
    const model = (file) => path.join(this.modelDir, file);
    this.recognizer = await sherpa.OfflineRecognizer.createAsync({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: model("encoder.int8.onnx"),
          decoder: model("decoder.int8.onnx"),
          joiner: model("joiner.int8.onnx"),
        },
        tokens: model("tokens.txt"),
        numThreads: 4,
        provider: "cpu",
      },
    });
  }

  // samples: Float32Array of mono audio at 16 kHz (what the recorder produces).
  async transcribe(samples, sampleRate = 16000) {
    // Add half a second of silence at the end. People let go of the key the
    // moment they finish speaking, and without trailing silence the model
    // drops the last word ("insert today's d"). Found by the eval suite.
    const padded = new Float32Array(samples.length + Math.round(sampleRate * TRAILING_SILENCE_SECONDS));
    padded.set(samples);

    const stream = this.recognizer.createStream();
    stream.acceptWaveform({ samples: padded, sampleRate });
    await this.recognizer.decodeAsync(stream);
    return this.recognizer.getResult(stream).text.trim();
  }

  stop() {
    this.recognizer = null; // released with the process
  }
}

module.exports = { Transcriber };
