import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const app = express();

app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function sanitizeName(name) {
  return String(name || "sketch").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function pickArtifact(files, formatHint) {
  const preferred = formatHint
    ? files.find((f) => f.toLowerCase().endsWith(`.${formatHint.toLowerCase()}`))
    : null;
  if (preferred) return preferred;
  return (
    files.find((f) => f.endsWith(".bin")) ||
    files.find((f) => f.endsWith(".hex")) ||
    files.find((f) => f.endsWith(".uf2")) ||
    null
  );
}

app.post("/compile", async (req, res) => {
  const { code, fqbn, boardId, format } = req.body || {};
  if (!code || !fqbn) {
    return res.status(400).json({ error: "Missing required fields: code, fqbn" });
  }

  const sketchBase = sanitizeName(boardId || "bitblock");
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bitblock-compile-"));
  const sketchDir = path.join(tmpDir, sketchBase);
  const sketchFile = path.join(sketchDir, `${sketchBase}.ino`);

  try {
    await fs.mkdir(sketchDir, { recursive: true });
    await fs.writeFile(sketchFile, code, "utf8");

    const { stdout, stderr } = await execFileAsync("arduino-cli", [
      "compile",
      "--fqbn",
      fqbn,
      "--export-binaries",
      sketchDir,
    ]);

    const allFiles = await fs.readdir(sketchDir);
    const artifactFile = pickArtifact(allFiles, format);
    if (!artifactFile) {
      return res.status(500).json({
        error: "Compilation finished but no artifact (.bin/.hex/.uf2) was found.",
        logs: `${stdout}\n${stderr}`.trim(),
      });
    }

    const artifactPath = path.join(sketchDir, artifactFile);
    const artifact = await fs.readFile(artifactPath);

    return res.json({
      ok: true,
      boardId,
      fqbn,
      format: path.extname(artifactFile).replace(".", ""),
      fileName: artifactFile,
      sizeBytes: artifact.byteLength,
      artifactBase64: artifact.toString("base64"),
      logs: `${stdout}\n${stderr}`.trim(),
    });
  } catch (error) {
    const message = error?.stderr || error?.message || "Compilation failed";
    return res.status(500).json({ error: String(message) });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Compiler service listening on ${port}`);
});
