import { ESPLoader, Transport } from "esptool-js";

export async function flashESPBlock(port: any, baudRate: number, binaryData: ArrayBuffer, onProgress: (msg: string) => void) {
  let transport: Transport | null = null;

  try {
    if (!binaryData || binaryData.byteLength === 0) {
      onProgress("[Error] Firmware binary is empty. Compile firmware to .bin before flashing.");
      return false;
    }

    // ── 1. Ensure the port is fully closed before esptool-js takes over ──
    // esptool-js Transport.connect() calls port.open() internally,
    // so we MUST hand it a closed port.
    try {
      if (port.readable || port.writable) {
        await port.close();
      }
    } catch {
      // Ignore — may already be closed
    }

    onProgress("[Flash] Initializing transport...");
    // @ts-ignore — WebSerial SerialPort typing
    transport = new Transport(port);

    const terminal = {
      clean() {},
      writeLine(data: string) { onProgress(data); },
      write(data: string) { onProgress(data); },
    };

    const loader = new ESPLoader({
      transport,
      baudrate: baudRate,
      terminal,
    });

    onProgress("[Flash] Connecting to ESP chip...");
    await loader.main();
    onProgress("[Flash] Connected to ESP!");

    // Convert ArrayBuffer to Uint8Array for esptool-js
    const binary = new Uint8Array(binaryData);
    const fileArray = [{ data: binary, address: 0x10000 }]; // Application partition offset

    onProgress("[Flash] Erasing & programming flash...");
    await loader.writeFlash({
      fileArray,
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex: number, written: number, total: number) {
        const pct = total > 0 ? Math.round((written / total) * 100) : 0;
        onProgress(`[Flash] Writing... ${pct}% (${(written / 1024).toFixed(1)}KB / ${(total / 1024).toFixed(1)}KB)`);
      },
    });

    onProgress("[Flash] Write complete! Resetting device...");

    // Use the official esptool-js after() API for a hard reset
    try {
      await loader.after("hard_reset");
    } catch {
      // Fallback: manual DTR/RTS pulse
      try {
        await port.setSignals({ dataTerminalReady: false, requestToSend: true });
        await new Promise((r) => setTimeout(r, 100));
        await port.setSignals({ dataTerminalReady: true, requestToSend: false });
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        onProgress("[Flash] Reset fallback skipped (signal control unavailable)");
      }
    }

    // Disconnect the transport cleanly
    try {
      await transport.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    onProgress("[Flash] ✓ Done! Device is running the new firmware.");
    return true;
  } catch (e: any) {
    onProgress(`[Error] Flash failed: ${e.message}`);

    // Best-effort cleanup
    try {
      if (transport) await transport.disconnect();
    } catch {
      // ignore
    }

    return false;
  }
}
