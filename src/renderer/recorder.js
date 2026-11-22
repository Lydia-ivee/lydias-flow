// Records the microphone as 16 kHz mono samples, the format the speech model
// wants, so no conversion step (and no ffmpeg) is needed afterwards.
//
// The microphone is opened when the key goes down and closed when it comes
// up, so macOS's orange "mic in use" dot only shows while you are talking.

// eslint-disable-next-line no-unused-vars
const recorder = (() => {
  let stream = null;
  let context = null;
  let processor = null;
  let chunks = [];

  async function start(microphoneId, onLevel) {
    chunks = [];
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: microphoneId && microphoneId !== "default" ? { exact: microphoneId } : undefined,
        channelCount: 1,
        noiseSuppression: true,
        autoGainControl: true,
        echoCancellation: false,
      },
    });
    // Asking for 16 kHz makes the browser resample for us.
    context = new AudioContext({ sampleRate: 16000 });
    const source = context.createMediaStreamSource(stream);
    // ScriptProcessor is old but simple: it hands us each block of samples.
    processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      const block = new Float32Array(event.inputBuffer.getChannelData(0));
      chunks.push(block);
      onLevel(rms(block));
    };
    source.connect(processor);
    processor.connect(context.destination);
  }

  // Loudness of a block, 0 (silence) to about 1.
  function rms(block) {
    let sum = 0;
    for (let i = 0; i < block.length; i += 1) sum += block[i] * block[i];
    return Math.sqrt(sum / block.length);
  }

  async function stop() {
    processor?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    await context?.close();
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const samples = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    stream = context = processor = null;
    chunks = [];
    return samples;
  }

  return { start, stop };
})();
