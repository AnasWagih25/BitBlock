// UF2 flashing doesn't typically require WebSerial, it requires mounting as a drag-and-drop drive.

export async function flashUF2(firmwareBinary: ArrayBuffer, onProgress: (msg: string) => void) {
  onProgress("UF2 devices bypass WebSerial.");
  onProgress("Please double-tap the RESET button on your Pico / Nano ESP32.");
  onProgress("A drive named 'RPI-RP2' or similar will appear.");
  onProgress("Drag and drop the downloaded `.uf2` file into that drive.");
  onProgress("[Flash] Download triggered.");
  
  // Convert binary to Blob and trigger real download
  const blob = new Blob([firmwareBinary], { type: "application/octet-stream" });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = "firmware.uf2";
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
