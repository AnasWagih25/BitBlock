const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json({ limit: "5mb" }));

// CORS — allow browser-based requests (local dev + production)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health check
app.get("/", (_req, res) => res.json({ status: "ok", service: "bitblock-compiler" }));

/**
 * POST /compile
 * Body: { code: string, fqbn: string, format?: "bin"|"hex" }
 * Returns: { artifactBase64: string, fileName: string, format: string }
 */
app.post("/compile", (req, res) => {
  const { code, fqbn, format, headers } = req.body;

  if (!code || !fqbn) {
    return res.status(400).json({ error: "Missing 'code' or 'fqbn'" });
  }

  const buildId = uuidv4();
  const sketchDir = `/tmp/${buildId}`;
  const sketchFile = path.join(sketchDir, `${buildId}.ino`);
  const outputDir = `/tmp/${buildId}_out`;

  try {
    // 1. Write sketch to temp directory
    fs.mkdirSync(sketchDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(sketchFile, code, "utf-8");

    // Write additional header files if provided
    if (headers && typeof headers === 'object') {
      for (const [filename, content] of Object.entries(headers)) {
        // Prevent path traversal
        const safeFilename = path.basename(filename);
        if (safeFilename.endsWith('.h')) {
          fs.writeFileSync(path.join(sketchDir, safeFilename), content, "utf-8");
          console.log(`[Compile] Included header: ${safeFilename} (${content.length} bytes)`);
        }
      }
    }

    // 2. Determine additional URLs needed for the FQBN
    let extraUrls = "";
    if (fqbn.startsWith("esp32:")) {
      extraUrls = "--additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json";
    } else if (fqbn.startsWith("esp8266:")) {
      extraUrls = "--additional-urls https://arduino.esp8266.com/stable/package_esp8266com_index.json";
    }

    // 3. Compile
    const cmd = `arduino-cli compile --fqbn ${fqbn} ${extraUrls} --output-dir ${outputDir} ${sketchDir} 2>&1`;
    console.log(`[Compile] ${cmd}`);

    let compileOutput;
    try {
      compileOutput = execSync(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }).toString();
    } catch (compileErr) {
      const stderr = compileErr.stderr ? compileErr.stderr.toString() : "";
      const stdout = compileErr.stdout ? compileErr.stdout.toString() : "";
      const errorMsg = stderr || stdout || compileErr.message;

      // Parse common Arduino compile errors into human-readable messages
      const lines = errorMsg.split("\n");
      const errorLines = lines.filter(
        (l) => l.includes("error:") || l.includes("Error") || l.includes("undefined reference")
      );

      return res.status(422).json({
        error: "Compilation failed",
        details: errorLines.length > 0 ? errorLines.join("\n") : errorMsg.slice(0, 2000),
      });
    }

    console.log(`[Compile] Output:\n${compileOutput.slice(0, 500)}`);

    // 4. Find the output binary
    const outputFiles = fs.readdirSync(outputDir);
    console.log(`[Compile] Output files: ${outputFiles.join(", ")}`);

    // Determine expected extension
    const wantedFormat = format || (fqbn.startsWith("arduino:avr") ? "hex" : "bin");
    const ext = wantedFormat === "hex" ? ".hex" : ".bin";

    // Find the application binary (not bootloader/partitions)
    let targetFile = outputFiles.find(
      (f) =>
        f.endsWith(ext) &&
        !f.includes("bootloader") &&
        !f.includes("boot_app0") &&
        !f.includes("partition")
    );

    // Fallback: try .elf if no .bin/.hex found
    if (!targetFile) {
      targetFile = outputFiles.find((f) => f.endsWith(".elf"));
      if (targetFile) {
        console.log(`[Compile] Warning: No ${ext} found, falling back to .elf`);
      }
    }

    if (!targetFile) {
      return res.status(500).json({
        error: `No output file with extension ${ext} found`,
        files: outputFiles,
      });
    }

    // 5. Read binary and encode as base64
    const binaryPath = path.join(outputDir, targetFile);
    const binaryData = fs.readFileSync(binaryPath);
    const artifactBase64 = binaryData.toString("base64");

    console.log(`[Compile] Success: ${targetFile} (${binaryData.length} bytes)`);

    res.json({
      artifactBase64,
      fileName: targetFile,
      format: wantedFormat,
      sizeBytes: binaryData.length,
    });
  } catch (e) {
    console.error("[Compile] Unexpected error:", e);
    res.status(500).json({ error: e.message });
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(sketchDir, { recursive: true, force: true });
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {}
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`BitBlock Compiler Service listening on port ${PORT}`));
