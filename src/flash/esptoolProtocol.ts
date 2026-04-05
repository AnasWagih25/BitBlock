import { ESPLoader, Transport } from "esptool-js";

export async function flashESPBlock(port: any, baudRate: number, binaryData: ArrayBuffer, onProgress: (msg: string) => void) {
  try {
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
        reportProgress(fileIndex: number, written: number, total: number) {
            onProgress(`Writing progress: Math.round((written / total) * 100)%`);
        }
    });

    onProgress("[Flash] Complete! Hard resetting...");
    await loader.hardReset();
    await transport.disconnect();
    
    return true;
  } catch (e: any) {
    onProgress(`[Error] Flash failed: ${e.message}`);
    return false;
  }
}
