// sherpa-onnx-node ships no type declarations (TS7016), so this declares only
// the parts src/main/transcriber.js uses. Extend it if the app uses more.
declare module "sherpa-onnx-node" {
  export interface OfflineRecognizerConfig {
    featConfig: { sampleRate: number; featureDim: number };
    modelConfig: {
      transducer: { encoder: string; decoder: string; joiner: string };
      tokens: string;
      numThreads: number;
      provider: string;
    };
  }

  export interface OfflineStream {
    acceptWaveform(waveform: { samples: Float32Array; sampleRate: number }): void;
  }

  export interface OfflineRecognizerResult {
    text: string;
  }

  export class OfflineRecognizer {
    static createAsync(config: OfflineRecognizerConfig): Promise<OfflineRecognizer>;
    createStream(): OfflineStream;
    decodeAsync(stream: OfflineStream): Promise<OfflineRecognizerResult>;
    getResult(stream: OfflineStream): OfflineRecognizerResult;
  }
}
