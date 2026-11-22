// Downloads the two local engines into ./engines:
//
//   engines/sherpa  speech-to-text server (sherpa-onnx) + its ONNX Runtime library
//   engines/llama   llama.cpp server, runs the clean-up model on the Mac's GPU
//
// Run once with `npm run setup`. Safe to re-run: finished steps are skipped.

const fs = require("fs");
const path = require("path");
const { download, extract, adHocSign, checkRuns } = require("./lib/download");

const ROOT = path.join(__dirname, "..");
const ENGINES = path.join(ROOT, "engines");
const DOWNLOADS = path.join(ENGINES, ".downloads");

const SHERPA = {
  url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-osx-universal2-shared-no-tts.tar.bz2",
  sha256: "636b439c75031d892636dfdd2000a0233e4a30a08b030697e91f8aa389431b83",
  server: "sherpa-onnx-v1.13.8-osx-universal2-shared-no-tts/bin/sherpa-onnx-offline-websocket-server",
};

// sherpa-onnx's macOS download bundles a "universal" ONNX Runtime whose Apple
// Silicon half runs these models about 3x slower than the Apple-Silicon-only
// build of the same version. This app only targets Apple Silicon, so it uses
// the fast build directly. (Found and documented by the OpenWhispr project.)
const ONNX_RUNTIME = {
  url: "https://github.com/csukuangfj/onnxruntime-libs/releases/download/v1.28.2/onnxruntime-osx-arm64-1.28.2.zip",
  sha256: "d9e5c0c79929e201f5b8eb095e6809a91ce78be9866a1bca0dfab7e20b40ae40",
  library: "onnxruntime-osx-arm64-1.28.2/lib/libonnxruntime.dylib",
};

const LLAMA = {
  url: "https://github.com/ggml-org/llama.cpp/releases/download/b9763/llama-b9763-bin-macos-arm64.tar.gz",
  sha256: "7706d1a7630218a3665d8c2d680bb54ab7f101896e9c45caaf5676ef4ce2e2d0",
  folder: "llama-b9763",
};

async function installSherpa() {
  const dir = path.join(ENGINES, "sherpa");
  const server = path.join(dir, "sherpa-onnx-offline-websocket-server");
  if (fs.existsSync(server)) return console.log("sherpa-onnx: already installed");

  console.log("sherpa-onnx: downloading");
  const archive = path.join(DOWNLOADS, "sherpa.tar.bz2");
  const runtimeZip = path.join(DOWNLOADS, "onnxruntime.zip");
  await download(SHERPA.url, archive, SHERPA.sha256);
  await download(ONNX_RUNTIME.url, runtimeZip, ONNX_RUNTIME.sha256);

  const unpacked = path.join(DOWNLOADS, "unpacked");
  extract(archive, unpacked);
  extract(runtimeZip, unpacked);

  fs.mkdirSync(dir, { recursive: true });
  // The server looks for libonnxruntime.dylib in its own folder (@loader_path).
  fs.copyFileSync(path.join(unpacked, ONNX_RUNTIME.library), path.join(dir, "libonnxruntime.dylib"));
  fs.copyFileSync(path.join(unpacked, SHERPA.server), server);
  fs.chmodSync(server, 0o755);
  adHocSign(path.join(dir, "libonnxruntime.dylib"));
  adHocSign(server);
  checkRuns(server, ["--help"]);
  console.log("sherpa-onnx: ready");
}

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
  await installSherpa();
  await installLlama();
  fs.rmSync(DOWNLOADS, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
});
