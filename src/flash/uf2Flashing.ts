// UF2 flashing doesn't typically require WebSerial, it requires mounting as a drag-and-drop drive.

export async function flashUF2(onProgress: (msg: string) => void) {
  onProgress("UF2 devices bypass WebSerial.");
  onProgress("Please double-tap the RESET button on your Pico / Nano ESP32.");
  onProgress("A drive named 'RPI-RP2' or similar will appear.");
  onProgress("Drag and drop the downloaded `.uf2` file into that drive.");
  onProgress("[Flash] Download triggered.");
  
  // Create a mock download trigger
  const link = document.createElement("a");
  link.download = "firmware.uf2";
  link.href = "data:application/octet-stream;base64,"; // MOCK
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
