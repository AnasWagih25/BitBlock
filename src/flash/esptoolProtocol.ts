import { ESPLoader, Transport } from "esptool-js";

export async function flashESPBlock(port: any, baudRate: number, binaryData: ArrayBuffer, onProgress: (msg: string) => void) {
  try {
    if (!binaryData || binaryData.byteLength === 0) {
      onProgress("[Error] Firmware binary is empty. Compile firmware to .bin before flashing.");
      return false;
    }
    onProgress("Initializing transport...");
    // @ts-ignore
    const transport = new Transport(port);
    const options = {
        transport,
        baudrate: baudRate,
        terminal: {
            clean() {},
            writeLine(data: string) { onProgress(data); },
            write(data: string) { onProgress(data); }
        }
    };

    onProgress("Starting ESPLoader...");
    const loader = new ESPLoader(options);
    
    await loader.main();
    onProgress("Connected to ESP!");
    
    // Convert ArrayBuffer to binary string / Blob 
    const binary = new Uint8Array(binaryData);
    const fileArray = [{ data: binary, address: 0x10000 }]; // Application offset
    
    onProgress("Erasing & programming flash...");
    await loader.writeFlash({
        fileArray,
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress(_fileIndex: number, _written: number, _total: number) {
            // Need absolute values to display progress correctly since we aren't using them
            // The template string in the original was lacking ${}
            onProgress(`Writing progress...`);
        }
    });

    onProgress("[Flash] Complete! Hard resetting...");
    // esptool-js API differs across versions; try supported reset paths safely.
    if (typeof (loader as any).hardReset === "function") {
      await (loader as any).hardReset();
    } else if (typeof (loader as any).after === "function") {
      await (loader as any).after("hard_reset");
    } else {
      // Fallback: pulse DTR/RTS to trigger reset on common USB-UART bridges.
      try {
        await port.setSignals({ dataTerminalReady: false, requestToSend: true });
        await new Promise((r) => setTimeout(r, 80));
        await port.setSignals({ dataTerminalReady: true, requestToSend: false });
        await new Promise((r) => setTimeout(r, 80));
      } catch {
        onProgress("[Flash] Reset fallback skipped (signal control unavailable)");
      }
    }
    await transport.disconnect();
    
    return true;
  } catch (e: any) {
    onProgress(`[Error] Flash failed: ${e.message}`);
    return false;
  }
}
