// Shared helpers for `npm run setup`.
//
// Every file is pinned to an exact URL and SHA-256 fingerprint. If what arrives
// does not match the fingerprint, it is deleted and setup stops: a changed or
// tampered file never gets run.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

async function download(url, dest, expectedSha256) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const partial = `${dest}.partial`;

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);

  const total = Number(response.headers.get("content-length")) || 0;
  const hash = crypto.createHash("sha256");
  const out = fs.createWriteStream(partial);
  let received = 0;
  let lastShown = -1;

  for await (const chunk of response.body) {
    hash.update(chunk);
    received += chunk.length;
    if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
    const percent = total ? Math.floor((received / total) * 100) : 0;
    if (percent >= lastShown + 10) {
      lastShown = percent;
      process.stdout.write(`  ${path.basename(dest)}: ${percent}%\n`);
    }
  }
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));

  const actual = hash.digest("hex");
  if (actual !== expectedSha256) {
    fs.rmSync(partial, { force: true });
    throw new Error(`Fingerprint mismatch for ${url}\n  expected ${expectedSha256}\n  got      ${actual}`);
  }
  fs.renameSync(partial, dest);
}

function sha256OfFile(file) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(file, "r");
  const buffer = Buffer.alloc(8 * 1024 * 1024);
  let bytes;
  while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
    hash.update(buffer.subarray(0, bytes));
  }
  fs.closeSync(fd);
  return hash.digest("hex");
}

// macOS tar handles .tar.gz and .tar.bz2; unzip ships with macOS too.
function extract(archive, intoDir) {
  fs.mkdirSync(intoDir, { recursive: true });
  if (archive.endsWith(".zip")) execFileSync("unzip", ["-q", "-o", archive, "-d", intoDir]);
  else execFileSync("tar", ["-xf", archive, "-C", intoDir]);
}

// Apple Silicon refuses to run unsigned code. An "ad-hoc" signature is a local
// self-signature that satisfies that check without an Apple developer account.
function adHocSign(file) {
  execFileSync("codesign", ["--force", "--sign", "-", file], { stdio: "ignore" });
}

// A file being executable is not proof it runs (lesson learned from a broken
// bundled ffmpeg), so start it once and check it exits cleanly.
function checkRuns(file, args) {
  const result = spawnSync(file, args, { stdio: "ignore", timeout: 15000 });
  if (result.status !== 0) {
    throw new Error(`${path.basename(file)} did not run (status ${result.status}, signal ${result.signal})`);
  }
}

module.exports = { download, sha256OfFile, extract, adHocSign, checkRuns };
