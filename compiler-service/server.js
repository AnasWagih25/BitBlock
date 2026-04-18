import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const app = express();

app.use(express.json({ limit: "5mb" }));
app.use((req, _res, next) => {
  req.requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const started = Date.now();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      severity: "INFO",
      message: "request_start",
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    }),
  );
  req.on("close", () => {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "request_end",
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        durationMs: Date.now() - started,
      }),
    );
  });
  next();
});
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

function pickArtifact(files, formatHint, sketchBase) {
  const lowerFiles = files.map((f) => f.toLowerCase());
  const targetExt = formatHint?.toLowerCase();

  // Prefer the actual sketch artifact first (e.g. esp32-wroom.ino.bin, arduino-uno-r3.ino.hex).
  if (targetExt) {
    const exactSketch = files.find((f, i) =>
      lowerFiles[i].includes(`${sketchBase.toLowerCase()}.ino.${targetExt}`),
    );
    if (exactSketch) return exactSketch;
    const anySketch = files.find((f, i) =>
      lowerFiles[i].includes(`.ino.${targetExt}`),
    );
    if (anySketch) return anySketch;
  }

  // Then prefer extension matches, excluding known non-app support binaries.
  const excludedBinNames = ["bootloader", "boot_app0", "partitions", "partition", "ota_data"];
  if (targetExt) {
    const preferredByExt = files.find((f, i) => {
      const lf = lowerFiles[i];
      if (!lf.endsWith(`.${targetExt}`)) return false;
      if (targetExt !== "bin") return true;
      return !excludedBinNames.some((name) => lf.includes(name));
    });
    if (preferredByExt) return preferredByExt;
  }

  // Fallbacks if format hint is missing.
  return (
    files.find((f, i) => lowerFiles[i].endsWith(".hex")) ||
    files.find((f, i) => lowerFiles[i].endsWith(".uf2")) ||
    files.find((f, i) => lowerFiles[i].endsWith(".bin") && !excludedBinNames.some((name) => lowerFiles[i].includes(name))) ||
    files.find((f, i) => lowerFiles[i].endsWith(".bin")) ||
    null
  );
}

async function listFilesRecursive(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(fullPath)));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

app.post("/compile", async (req, res) => {
  const { code, fqbn, boardId, format } = req.body || {};
  const requestId = req.requestId || "n/a";
  if (!code || !fqbn) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "compile_invalid_request",
        requestId,
        boardId,
        fqbn,
      }),
    );
    return res.status(400).json({ error: "Missing required fields: code, fqbn" });
  }

  const sketchBase = sanitizeName(boardId || "bitblock");
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bitblock-compile-"));
  const sketchDir = path.join(tmpDir, sketchBase);
  const sketchFile = path.join(sketchDir, `${sketchBase}.ino`);

  try {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "compile_started",
        requestId,
        boardId,
        fqbn,
        format,
        codeBytes: Buffer.byteLength(code, "utf8"),
      }),
    );
    await fs.mkdir(sketchDir, { recursive: true });
    await fs.writeFile(sketchFile, code, "utf8");

    const { stdout, stderr } = await execFileAsync("arduino-cli", [
      "compile",
      "--fqbn",
      fqbn,
      "--export-binaries",
      sketchDir,
    ]);

    const allFilesAbs = await listFilesRecursive(sketchDir);
    const artifactPath = pickArtifact(allFilesAbs, format, sketchBase);
    if (!artifactPath) {
      return res.status(500).json({
        error: "Compilation finished but no artifact (.bin/.hex/.uf2) was found.",
        filesFound: allFilesAbs.map((p) => p.replace(`${sketchDir}${path.sep}`, "")),
        logs: `${stdout}\n${stderr}`.trim(),
      });
    }

    const artifact = await fs.readFile(artifactPath);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: "compile_succeeded",
        requestId,
        boardId,
        fqbn,
        artifactPath,
        artifactBytes: artifact.byteLength,
      }),
    );

    return res.json({
      ok: true,
      requestId,
      boardId,
      fqbn,
      format: path.extname(artifactPath).replace(".", ""),
      fileName: path.basename(artifactPath),
      sizeBytes: artifact.byteLength,
      artifactBase64: artifact.toString("base64"),
      logs: `${stdout}\n${stderr}`.trim(),
    });
  } catch (error) {
    const message = error?.stderr || error?.message || "Compilation failed";
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "compile_failed",
        requestId,
        boardId,
        fqbn,
        errorMessage: String(message),
        stack: error?.stack || null,
        stdout: error?.stdout || null,
        stderr: error?.stderr || null,
      }),
    );
    return res.status(500).json({ error: String(message), requestId });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Compiler service listening on ${port}`);
});
