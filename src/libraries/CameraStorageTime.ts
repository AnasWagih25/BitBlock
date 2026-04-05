import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

export function defineCameraStorageTimeBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // ESP32 Camera Init
  Blockly.Blocks["camera_esp32_init"] = {
    init() {
      this.appendDummyInput().appendField("Initialize ESP32 Camera");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#718096");
    }
  };

  if (generator) {
    generator.forBlock["camera_esp32_init"] = function() {
      // @ts-ignore
      const board = getBoardConfig(compiler.boardId);
      
      if (!board.camera) {
        return `// Board ${board.name} does not support esp32-camera natively\n`;
      }

      compiler.addInclude(`#include "esp_camera.h"`);
      compiler.addSetup(`
    camera_config_t config;
    // ... basic pins mapping depending on board model (AI Thinker vs S3)...
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = 5;
    config.pin_d1 = 18;
    config.pin_d2 = 19;
    config.pin_d3 = 21;
    config.pin_d4 = 36;
    config.pin_d5 = 39;
    config.pin_d6 = 34;
    config.pin_d7 = 35;
    config.pin_xclk = 0;
    config.pin_pclk = 22;
    config.pin_vsync = 25;
    config.pin_href = 23;
    config.pin_sscb_sda = 26;
    config.pin_sscb_scl = 27;
    config.pin_pwdn = 32;
    config.pin_reset = -1;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    
    if(psramFound()){
      config.frame_size = FRAMESIZE_UXGA;
      config.jpeg_quality = 10;
      config.fb_count = 2;
    } else {
      config.frame_size = FRAMESIZE_SVGA;
      config.jpeg_quality = 12;
      config.fb_count = 1;
    }
    
    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
      Serial.printf("Camera init failed with error 0x%x", err);
      return;
    }`);
      
      return `// Camera initialized\n`;
    };
  }
}

export function getCameraStorageTimeCategory() {
  return {
    kind: "category", name: "Camera/Storage",
    contents: [
      { kind: "block", type: "camera_esp32_init" },
    ]
  };
}
