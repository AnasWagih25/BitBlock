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

    // Determine if this is an ESP target needing multi-part flash
    const isESP = fqbn.startsWith("esp32") || fqbn.startsWith("esp8266");
    let parts = [];
    let artifactBase64 = "";
    let sizeBytes = 0;
    let targetFile = "";

    if (isESP) {
      // For ESP targets, we bundle bootloader, partitions, boot_app0, and app
      for (const file of outputFiles) {
        if (!file.endsWith(".bin")) continue;

        const data = fs.readFileSync(path.join(outputDir, file));
        const base64 = data.toString("base64");
        
        let offset = 0;
        if (file.includes("bootloader")) {
          // ESP32-C3 and S3 bootloaders start at 0x0, others usually at 0x1000
          offset = (fqbn.includes("esp32c3") || fqbn.includes("esp32s3") || fqbn.includes("esp32c6") || fqbn.includes("esp32h2")) ? 0x0000 : 0x1000;
          parts.push({ offset, dataBase64: base64, name: "bootloader" });
        } else if (file.includes("partitions")) {
          offset = 0x8000;
          parts.push({ offset, dataBase64: base64, name: "partitions" });
        } else if (file.includes("boot_app0")) {
          offset = 0xe000;
          parts.push({ offset, dataBase64: base64, name: "boot_app0" });
        } else {
          // Main application binary
          offset = 0x10000;
          parts.push({ offset, dataBase64: base64, name: "app" });
          artifactBase64 = base64; // Keep main app as legacy fallback
          targetFile = file;
        }
      }
      
      sizeBytes = parts.reduce((acc, p) => acc + Buffer.from(p.dataBase64, 'base64').length, 0);
      console.log(`[Compile] Bundled ESP multi-part firmware (${parts.length} parts, ${sizeBytes} bytes total)`);

    } else {
      // Standard single-file packaging (AVR, RP2040, etc.)
      targetFile = outputFiles.find((f) => f.endsWith(ext));
      if (!targetFile) targetFile = outputFiles.find((f) => f.endsWith(".elf"));
      
      if (!targetFile) {
        return res.status(500).json({ error: `No output file with extension ${ext} found`, files: outputFiles });
      }

      const binaryData = fs.readFileSync(path.join(outputDir, targetFile));
      artifactBase64 = binaryData.toString("base64");
      sizeBytes = binaryData.length;
      console.log(`[Compile] Success: ${targetFile} (${sizeBytes} bytes)`);
    }

    res.json({
      artifactBase64,
      parts: isESP ? parts : undefined,
      fileName: targetFile || "firmware",
      format: wantedFormat,
      sizeBytes,
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
