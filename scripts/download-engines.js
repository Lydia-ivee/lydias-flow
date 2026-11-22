// Downloads the clean-up engine into ./engines:
//
//   engines/llama   llama.cpp server, runs the clean-up model on the Mac's GPU
//
// (Speech-to-text needs no download here: it runs inside the app through the
// sherpa-onnx-node package, installed by npm.)
//
// Run once with `npm run setup`. Safe to re-run: finished steps are skipped.

const fs = require("fs");
const path = require("path");
const { download, extract, checkRuns } = require("./lib/download");

const ROOT = path.join(__dirname, "..");
const ENGINES = path.join(ROOT, "engines");
const DOWNLOADS = path.join(ENGINES, ".downloads");

const LLAMA = {
  url: "https://github.com/ggml-org/llama.cpp/releases/download/b9763/llama-b9763-bin-macos-arm64.tar.gz",
  sha256: "7706d1a7630218a3665d8c2d680bb54ab7f101896e9c45caaf5676ef4ce2e2d0",
  folder: "llama-b9763",
};

async function installLlama() {
  const dir = path.join(ENGINES, "llama");
  const server = path.join(dir, "llama-server");
  if (fs.existsSync(server)) return console.log("llama.cpp: already installed");

  console.log("llama.cpp: downloading");
  const archive = path.join(DOWNLOADS, "llama.tar.gz");
  await download(LLAMA.url, archive, LLAMA.sha256);
  const unpacked = path.join(DOWNLOADS, "unpacked");
  extract(archive, unpacked);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(path.join(unpacked, LLAMA.folder), dir);
  checkRuns(server, ["--version"]);
  console.log("llama.cpp: ready");
}

async function main() {
  await installLlama();
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
});
