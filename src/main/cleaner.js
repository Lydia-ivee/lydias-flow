// Clean-up and voice editing, on the Mac.
//
// Runs llama.cpp's server with the small Qwen model on the Mac's GPU, and talks
// to it on 127.0.0.1 using the same request format as OpenAI's chat API.

const path = require("path");
const { findFreePort, waitUntilReady, startProcess } = require("./localServer");
const { buildCleanupMessages, buildEditMessages, acceptCleanup, tidyModelOutput } = require("../shared/prompts");

class Cleaner {
  constructor({ enginesDir, modelsDir }) {
    this.binary = path.join(enginesDir, "llama", "llama-server");
    this.model = path.join(modelsDir, "qwen.gguf");
    this.child = null;
    this.port = null;
  }

  async start() {
    this.port = await findFreePort();
    this.child = startProcess(this.binary, [
      "-m", this.model,
      "--host", "127.0.0.1",
      "--port", String(this.port),
      "-c", "4096", // context size: plenty for a dictation
      "-ngl", "99", // put every layer on the GPU
      "--jinja", // use the chat template inside the model file
    ]);
    const healthy = async () => (await fetch(this.url("/health"))).ok;
    await waitUntilReady(this.child, healthy, { name: "Clean-up server" });
  }

  url(pathname) {
    return `http://127.0.0.1:${this.port}${pathname}`;
  }

  async chat(messages, maxTokens) {
    const response = await fetch(this.url("/v1/chat/completions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: 0.2, // low: we want faithful tidying, not creativity
        max_tokens: maxTokens,
        // Qwen 3.5 can "think" before answering; that only adds delay here.
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Clean-up server error ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  // Returns { text, usedModel }. Falls back to the input if the model misbehaves.
  async clean(text) {
    const output = await this.chat(buildCleanupMessages(text), Math.max(64, text.length));
    return acceptCleanup(text, output);
  }

  async edit(selectedText, instruction) {
    const output = await this.chat(buildEditMessages(selectedText, instruction), Math.max(128, selectedText.length * 2));
    return tidyModelOutput(output) || selectedText;
  }

  stop() {
    this.child?.kill();
    this.child = null;
  }
}

module.exports = { Cleaner };
