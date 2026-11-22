// Live text: shows your words in the pill while you are still speaking.
//
// There is no separate streaming model. Every 0.4s, the same Parakeet model
// that produces the final text re-reads the last 8 seconds of audio. On an M2
// that puts the first words on screen ~0.45s after you start talking, with the
// same accuracy as the final text (measured: a 54 MB streaming model took
// ~1.5s and got about 1 word in 5 wrong).
//
// Three rules keep it cheap and safe:
//   1. Only the last WINDOW_SECONDS are re-read, so the cost per read stays
//      flat however long you talk.
//   2. If the previous read is still running, the next beat is skipped, never
//      queued, so reads cannot pile up.
//   3. stop() waits for any read in flight, so the final transcription never
//      competes with a preview, and a late preview is never shown.
//
// The preview is only ever shown; the text that gets typed always comes from
// a full read of the whole recording after you let go.

const SAMPLE_RATE = 16000;
const INTERVAL_MS = 400;
const WINDOW_SECONDS = 8;

class LivePreview {
  /**
   * @param {object} options
   * @param {(samples: Float32Array) => Promise<string>} options.transcribe
   * @param {(text: string) => void} options.onText called with each new preview
   * @param {number} [options.intervalMs]
   * @param {number} [options.windowSeconds]
   * @param {typeof setInterval} [options.setTimer] injectable for tests
   * @param {typeof clearInterval} [options.clearTimer]
   */
  constructor({
    transcribe,
    onText,
    intervalMs = INTERVAL_MS,
    windowSeconds = WINDOW_SECONDS,
    setTimer = setInterval,
    clearTimer = clearInterval,
  }) {
    this.transcribe = transcribe;
    this.onText = onText;
    this.intervalMs = intervalMs;
    this.windowSamples = windowSeconds * SAMPLE_RATE;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;

    /** @type {Float32Array[]} */
    this.chunks = [];
    this.totalSamples = 0;
    /** @type {ReturnType<typeof setInterval> | null} */
    this.timer = null;
    /** @type {Promise<void> | null} */
    this.inFlight = null;
    this.active = false;
    this.lastText = "";
    this.lastReadAt = 0; // sample count at the last read, to skip reads with no new audio
    this.stats = { reads: 0, skipped: 0 };
  }

  start() {
    this.chunks = [];
    this.totalSamples = 0;
    this.lastText = "";
    this.lastReadAt = 0;
    this.stats = { reads: 0, skipped: 0 };
    this.active = true;
    this.timer = this.setTimer(() => this.tick(), this.intervalMs);
  }

  /** @param {Float32Array} chunk the next block of 16 kHz mono audio */
  push(chunk) {
    if (!this.active) return;
    this.chunks.push(chunk);
    this.totalSamples += chunk.length;
  }

  // The last `windowSamples` of audio as one array.
  /** @returns {Float32Array} */
  window() {
    const length = Math.min(this.totalSamples, this.windowSamples);
    const out = new Float32Array(length);
    let filled = 0;
    for (let i = this.chunks.length - 1; i >= 0 && filled < length; i -= 1) {
      const chunk = this.chunks[i];
      const take = Math.min(chunk.length, length - filled);
      out.set(chunk.subarray(chunk.length - take), length - filled - take);
      filled += take;
    }
    // Chunks wholly outside the window are no longer needed for the preview.
    this.dropOldChunks();
    return out;
  }

  dropOldChunks() {
    let kept = 0;
    let firstKept = this.chunks.length;
    for (let i = this.chunks.length - 1; i >= 0; i -= 1) {
      firstKept = i;
      kept += this.chunks[i].length;
      if (kept >= this.windowSamples) break;
    }
    if (firstKept > 0) this.chunks = this.chunks.slice(firstKept);
  }

  /** @returns {boolean} true if a read was started */
  tick() {
    if (!this.active || this.totalSamples === this.lastReadAt) return false;
    if (this.inFlight) {
      this.stats.skipped += 1; // rule 2: skip, never queue
      return false;
    }
    this.lastReadAt = this.totalSamples;
    this.stats.reads += 1;
    const samples = this.window();
    this.inFlight = this.transcribe(samples)
      .then((text) => {
        // rule 3: a read that finishes after stop() is never shown
        if (this.active && text && text !== this.lastText) {
          this.lastText = text;
          this.onText(text);
        }
      })
      .catch(() => {
        // A failed preview is harmless: the final text comes from a separate read.
      })
      .finally(() => {
        this.inFlight = null;
      });
    return true;
  }

  // Stops previewing and waits for any read in flight to finish.
  /** @returns {Promise<void>} */
  async stop() {
    this.active = false;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (this.inFlight) await this.inFlight;
    this.chunks = [];
    this.totalSamples = 0;
  }
}

module.exports = { LivePreview, INTERVAL_MS, WINDOW_SECONDS };
