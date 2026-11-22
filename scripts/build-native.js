// Compiles the small Swift key listener into ./bin/key-listener.
// Needs Apple's command line tools (`xcode-select --install`).

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const source = path.join(ROOT, "native", "key-listener.swift");
const output = path.join(ROOT, "bin", "key-listener");

fs.mkdirSync(path.dirname(output), { recursive: true });
execFileSync("swiftc", ["-O", source, "-o", output], { stdio: "inherit" });
// Ad-hoc signature, so Apple Silicon will run it.
execFileSync("codesign", ["--force", "--sign", "-", output], { stdio: "ignore" });
console.log(`key listener: built ${path.relative(ROOT, output)}`);
