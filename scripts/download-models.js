// Downloads the two AI models into ./models (about 1.9 GB in total):
//
//   models/parakeet  NVIDIA Parakeet 0.6B, English speech-to-text (~0.5 GB)
//   models/qwen.gguf Qwen 3.5 2B, small language model for clean-up (~1.4 GB)
//
// Run once with `npm run setup`. Safe to re-run: finished models are skipped.

const fs = require("fs");
const path = require("path");
const { download, extract, sha256OfFile } = require("./lib/download");

const ROOT = path.join(__dirname, "..");
const MODELS = path.join(ROOT, "models");
const DOWNLOADS = path.join(MODELS, ".downloads");

const PARAKEET = {
  url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-unified-en-0.6b-int8-non-streaming.tar.bz2",
  sha256: "99f63605b3a85a54c250c0869670a687b7d6598a47bf2421515e1f839a76e150",
  folder: "sherpa-onnx-nemo-parakeet-unified-en-0.6b-int8-non-streaming",
  files: ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"],
};

// Pinned to one Hugging Face commit, so the file can never change under us.
const QWEN = {
  url: "https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF/resolve/7d26695454df6de5fbcce2e58681e62dae06ce43/Qwen_Qwen3.5-2B-Q4_K_M.gguf",
  sha256: "57a1085840f497d764a7fc5d346922dbde961efb54cc792ea81d694fd846a1d8",
};

async function installParakeet() {
  const dir = path.join(MODELS, "parakeet");
  if (PARAKEET.files.every((f) => fs.existsSync(path.join(dir, f)))) {
    return console.log("Parakeet: already installed");
  }
  console.log("Parakeet: downloading (~0.5 GB)");
  const archive = path.join(DOWNLOADS, "parakeet.tar.bz2");
  await download(PARAKEET.url, archive, PARAKEET.sha256);
  const unpacked = path.join(DOWNLOADS, "unpacked");
  extract(archive, unpacked);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of PARAKEET.files) {
    fs.renameSync(path.join(unpacked, PARAKEET.folder, file), path.join(dir, file));
  }
  console.log("Parakeet: ready");
}

async function installQwen() {
  const file = path.join(MODELS, "qwen.gguf");
  if (fs.existsSync(file) && sha256OfFile(file) === QWEN.sha256) {
    return console.log("Qwen: already installed");
  }
  console.log("Qwen: downloading (~1.4 GB)");
  await download(QWEN.url, file, QWEN.sha256);
  console.log("Qwen: ready");
}

async function main() {
  await installParakeet();
  await installQwen();
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
});
