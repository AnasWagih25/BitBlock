import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

export function defineCameraStorageTimeBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;
  const asCppString = (expr: string) => {
    if (expr.startsWith("'") && expr.endsWith("'")) {
      return compiler.wrapString(expr.slice(1, -1));
    }
    return expr;
  };


  // -- CAMERA (ESP32-CAM) --
  Blockly.Blocks["camera_init_ai_thinker"] = {
    init() { this.appendDummyInput().appendField("ESP32-CAM (AI Thinker) Init Config"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2B6CB0"); }
  };
  Blockly.Blocks["camera_set_resolution"] = {
    init() {
      this.appendDummyInput()
          .appendField("Camera Set Resolution")
          .appendField(new Blockly.FieldDropdown([
            ["QQVGA (160x120)", "FRAMESIZE_QQVGA"],
            ["QVGA (320x240)", "FRAMESIZE_QVGA"],
            ["VGA (640x480)", "FRAMESIZE_VGA"],
            ["SVGA (800x600)", "FRAMESIZE_SVGA"],
            ["XGA (1024x768)", "FRAMESIZE_XGA"],
            ["UXGA (1600x1200)", "FRAMESIZE_UXGA"],
          ]), "RES");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#2B6CB0");
    }
  };

  // -- TIMING & YIELDING (4) --
  Blockly.Blocks["time_delay_ms"] = {
    init() { this.appendValueInput("MS").setCheck("Number").appendField("Delay milliseconds (ms)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#A0AEC0"); }
  };
  Blockly.Blocks["time_delay_us"] = {
    init() { this.appendValueInput("US").setCheck("Number").appendField("Delay microseconds (us)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#A0AEC0"); }
  };
  Blockly.Blocks["time_get_millis"] = {
    init() { this.appendDummyInput().appendField("Get millis() uptime"); this.setOutput(true, "Number"); this.setColour("#A0AEC0"); }
  };
  Blockly.Blocks["time_get_micros"] = {
    init() { this.appendDummyInput().appendField("Get micros() uptime"); this.setOutput(true, "Number"); this.setColour("#A0AEC0"); }
  };

  // -- SD CARD (8) --
  Blockly.Blocks["sd_init"] = {
    init() { this.appendValueInput("CS").setCheck("Number").appendField("Init SD Card CS pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_read_file"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Read File String"); this.setOutput(true, "String"); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_write_file"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Overwrite File"); this.appendValueInput("CONTENT").setCheck("String").appendField("Content"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_append_file"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Append File"); this.appendValueInput("CONTENT").setCheck("String").appendField("Content"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_delete_file"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Delete File"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_exists"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Check if Exists"); this.setOutput(true, "Boolean"); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_mkdir"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Make Directory"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["sd_rmdir"] = {
    init() { this.appendValueInput("PATH").setCheck("String").appendField("SD Remove Directory"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };

  // -- EEPROM (4) --
  Blockly.Blocks["eeprom_init"] = {
    init() { this.appendValueInput("SIZE").setCheck("Number").appendField("EEPROM Init block size"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4A5568"); }
  };
  Blockly.Blocks["eeprom_write_byte"] = {
    init() { this.appendValueInput("ADDR").setCheck("Number").appendField("EEPROM Write Byte to"); this.appendValueInput("VAL").setCheck("Number").appendField("val(0-255)"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4A5568"); }
  };
  Blockly.Blocks["eeprom_read_byte"] = {
    init() { this.appendValueInput("ADDR").setCheck("Number").appendField("EEPROM Read Byte from"); this.setOutput(true, "Number"); this.setColour("#4A5568"); }
  };
  Blockly.Blocks["eeprom_commit"] = {
    init() { this.appendDummyInput().appendField("EEPROM Commit (ESP requirement)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4A5568"); }
  };

  // -- RTC DS3231 (4) --
  Blockly.Blocks["rtc_init"] = {
    init() { this.appendDummyInput().appendField("RTC DS3231 Boot (I2C)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2D3748"); }
  };
  Blockly.Blocks["rtc_get_hour"] = {
    init() { this.appendDummyInput().appendField("RTC Get Hour"); this.setOutput(true, "Number"); this.setColour("#2D3748"); }
  };
  Blockly.Blocks["rtc_get_minute"] = {
    init() { this.appendDummyInput().appendField("RTC Get Minute"); this.setOutput(true, "Number"); this.setColour("#2D3748"); }
  };
  Blockly.Blocks["rtc_get_second"] = {
    init() { this.appendDummyInput().appendField("RTC Get Second"); this.setOutput(true, "Number"); this.setColour("#2D3748"); }
  };

  if (generator) {

    // Camera
    generator.forBlock["camera_init_ai_thinker"] = function() {
      compiler.addInclude(`#include "esp_camera.h"`);
      compiler.addGlobal(`
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
`);
      compiler.addSetup(`
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG; // for streaming
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if(config.pixel_format == PIXFORMAT_JPEG){
    if(psramFound()){
      config.jpeg_quality = 10;
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  } else {
    config.frame_size = FRAMESIZE_240X240;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  if(config.pixel_format == PIXFORMAT_JPEG){
    s->set_framesize(s, FRAMESIZE_QVGA);
  }
`);
      return "";
    };

    generator.forBlock["camera_set_resolution"] = function(block: any) {
      const res = block.getFieldValue('RES');
      return `  sensor_t * s = esp_camera_sensor_get();
  if (s) { s->set_framesize(s, ${res}); }
`;
    };

    // Timing
    generator.forBlock["time_delay_ms"] = function(block: any, generator: any) {
      const ms = generator.valueToCode(block, 'MS', generator.ORDER_ATOMIC) || '1000';
      return `delay(${ms});\n`;
    };
    generator.forBlock["time_delay_us"] = function(block: any, generator: any) {
      const us = generator.valueToCode(block, 'US', generator.ORDER_ATOMIC) || '1000';
      return `delayMicroseconds(${us});\n`;
    };
    generator.forBlock["time_get_millis"] = function() { return [`millis()`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["time_get_micros"] = function() { return [`micros()`, generator.ORDER_FUNCTION_CALL]; };

    // SD Card
    generator.forBlock["sd_init"] = function(block: any, generator: any) {
      const cs = generator.valueToCode(block, 'CS', generator.ORDER_ATOMIC) || '4';
      compiler.addInclude(`#include <SD.h>\n#include <SPI.h>`);
      compiler.addSetup(`if (!SD.begin(${cs})) { Serial.println("SD boot failed"); }`);
      return "";
    };
    generator.forBlock["sd_read_file"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      compiler.addGlobal(`
String sdReadFileBlock(String path) {
  File f = SD.open(path);
  if(!f) return "";
  String out = "";
  while(f.available()) out += (char)f.read();
  f.close(); return out;
}`);
      return [`sdReadFileBlock(${p})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["sd_write_file"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      let c = generator.valueToCode(block, 'CONTENT', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      c = asCppString(c);
      compiler.addGlobal(`
void sdWriteBlock(String path, String c) {
  SD.remove(path); // enforce overwrite semantics
  File f = SD.open(path, FILE_WRITE);
  if (f) { f.print(c); f.close(); }
}`);
      return `sdWriteBlock(${p}, ${c});\n`;
    };
    generator.forBlock["sd_append_file"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      let c = generator.valueToCode(block, 'CONTENT', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      c = asCppString(c);
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform === "esp32" || bd.platform === "esp8266") {
        compiler.addGlobal(`
void sdAppendBlock(String path, String c) {
  File f = SD.open(path, FILE_APPEND);
  if (f) { f.print(c); f.close(); }
}`);
      } else {
        compiler.addGlobal(`
void sdAppendBlock(String path, String c) {
  File f = SD.open(path, FILE_WRITE);
  if (f) { f.print(c); f.close(); }
}`);
      }
      return `sdAppendBlock(${p}, ${c});\n`;
    };
    generator.forBlock["sd_delete_file"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      return `SD.remove(${p});\n`;
    };
    generator.forBlock["sd_exists"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      return [`SD.exists(${p})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["sd_mkdir"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      return `SD.mkdir(${p});\n`;
    };
    generator.forBlock["sd_rmdir"] = function(block: any, generator: any) {
      let p = generator.valueToCode(block, 'PATH', generator.ORDER_ATOMIC) || '""';
      p = asCppString(p);
      return `SD.rmdir(${p});\n`;
    };

    // EEPROM
    generator.forBlock["eeprom_init"] = function(block: any, generator: any) {
      const size = generator.valueToCode(block, 'SIZE', generator.ORDER_ATOMIC) || '512';
      compiler.addInclude(`#include <EEPROM.h>`);
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform === "esp32" || bd.platform === "esp8266") {
        compiler.addSetup(`EEPROM.begin(${size});`);
      }
      return "";
    };
    generator.forBlock["eeprom_write_byte"] = function(block: any, generator: any) {
      const addr = generator.valueToCode(block, 'ADDR', generator.ORDER_ATOMIC) || '0';
      const val = generator.valueToCode(block, 'VAL', generator.ORDER_ATOMIC) || '0';
      return `EEPROM.write(${addr}, (uint8_t)(${val}));\n`;
    };
    generator.forBlock["eeprom_read_byte"] = function(block: any, generator: any) {
      const addr = generator.valueToCode(block, 'ADDR', generator.ORDER_ATOMIC) || '0';
      return [`EEPROM.read(${addr})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["eeprom_commit"] = function() {
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform === "esp32" || bd.platform === "esp8266") {
        return `EEPROM.commit();\n`;
      }
      return `// Commit NA\n`;
    };

    // RTC DS3231
    generator.forBlock["rtc_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include <RTClib.h>`);
      compiler.addGlobal(`RTC_DS3231 rtc;`);
      compiler.addSetup(`if (!rtc.begin()) { Serial.println("RTC miss"); }`);
      return "";
    };
    generator.forBlock["rtc_get_hour"] = function() { return [`rtc.now().hour()`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["rtc_get_minute"] = function() { return [`rtc.now().minute()`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["rtc_get_second"] = function() { return [`rtc.now().second()`, generator.ORDER_FUNCTION_CALL]; };
  }
}

export function getCameraStorageTimeCategory() {
  return {
    kind: "category", name: "Memory & Timing",
    contents: [
      { kind: "label", text: "Runtime Delays" },
      { kind: "block", type: "time_delay_ms" },
      { kind: "block", type: "time_delay_us" },
      { kind: "block", type: "time_get_millis" },
      { kind: "block", type: "time_get_micros" },
      { kind: "label", text: "SD Card" },
      { kind: "block", type: "sd_init" },
      { kind: "block", type: "sd_read_file" },
      { kind: "block", type: "sd_write_file" },
      { kind: "block", type: "sd_append_file" },
      { kind: "block", type: "sd_delete_file" },
      { kind: "block", type: "sd_exists" },
      { kind: "block", type: "sd_mkdir" },
      { kind: "block", type: "sd_rmdir" },
      { kind: "label", text: "EEPROM Setup" },
      { kind: "block", type: "eeprom_init" },
      { kind: "block", type: "eeprom_write_byte" },
      { kind: "block", type: "eeprom_read_byte" },
      { kind: "block", type: "eeprom_commit" },
      { kind: "label", text: "RTC Logic" },
      { kind: "block", type: "rtc_init" },
      { kind: "block", type: "rtc_get_hour" },
      { kind: "block", type: "rtc_get_minute" },
      { kind: "block", type: "rtc_get_second" },
    ]
  };
}

export function getCameraCategory() {
  return {
    kind: "category", name: "Camera (ESP32-CAM)",
    contents: [
      { kind: "block", type: "camera_init_ai_thinker" },
      { kind: "block", type: "camera_set_resolution" },
    ]
  };
}
