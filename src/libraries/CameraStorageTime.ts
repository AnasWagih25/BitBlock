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
