import { compiler } from "../compiler/assembler";
import { javascriptGenerator } from "blockly/javascript";
import { getBoardConfig } from "../boards/registry";

export function defineAdvancedCommunicationBlocks(Blockly: any) {
  const generator = javascriptGenerator as any;
  const asCppString = (expr: string) => {
    if (expr.startsWith("'") && expr.endsWith("'")) {
      return compiler.wrapString(expr.slice(1, -1));
    }
    return expr;
  };

  // ─── LoRa (SX1278) ────────────────────────────────────────────────────────
  Blockly.Blocks["lora_init"] = {
    init: function () {
      this.appendDummyInput().appendField("LoRa Init (SPI)");
      this.appendDummyInput()
        .appendField("CS")
        .appendField(new Blockly.FieldTextInput("10"), "CS")
        .appendField("RST")
        .appendField(new Blockly.FieldTextInput("9"), "RST")
        .appendField("INT")
        .appendField(new Blockly.FieldTextInput("2"), "INT");
      this.appendDummyInput()
        .appendField("Freq")
        .appendField(new Blockly.FieldDropdown([["433 MHz", "433E6"], ["868 MHz", "868E6"], ["915 MHz", "915E6"]]), "FREQ");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#3182CE");
      this.setTooltip("Initialize LoRa SX1278 Transceiver via SPI");
    },
  };
  if (generator) {
    generator.forBlock["lora_init"] = function (block: any) {
      const cs = block.getFieldValue("CS");
      const rst = block.getFieldValue("RST");
      const irq = block.getFieldValue("INT");
      const freq = block.getFieldValue("FREQ");
      compiler.addInclude("#include <SPI.h>\n#include <LoRa.h>");
      compiler.addSetup(`SPI.begin();`);
      compiler.addSetup(`LoRa.setPins(${cs}, ${rst}, ${irq});`);
      compiler.addSetup(`if (!LoRa.begin(${freq})) { Serial.println("LoRa init failed!"); }`);
      return "";
    };
  }

  Blockly.Blocks["lora_send"] = {
    init: function () {
      this.appendValueInput("PAYLOAD").setCheck("String").appendField("LoRa Send Packet");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#3182CE");
    },
  };
  if (generator) {
    generator.forBlock["lora_send"] = function (block: any) {
      let payload = generator.valueToCode(block, "PAYLOAD", 0) || '""';
      payload = asCppString(payload);
      return `LoRa.beginPacket();\nLoRa.print(${payload});\nLoRa.endPacket();\n`;
    };
  }

  Blockly.Blocks["lora_receive"] = {
    init: function () {
      this.appendDummyInput().appendField("LoRa Check for Packet");
      this.setOutput(true, "Boolean");
      this.setColour("#3182CE");
    },
  };
  if (generator) {
    generator.forBlock["lora_receive"] = function () {
      compiler.addInclude("#include <LoRa.h>");
      return ["(LoRa.parsePacket() > 0)", 0];
    };
  }

  Blockly.Blocks["lora_read_string"] = {
    init: function () {
      this.appendDummyInput().appendField("LoRa Read String");
      this.setOutput(true, "String");
      this.setColour("#3182CE");
    },
  };
  if (generator) {
    generator.forBlock["lora_read_string"] = function () {
      compiler.addInclude("#include <LoRa.h>");
      return ["LoRa.readString()", 0];
    };
  }

  Blockly.Blocks["lora_rssi"] = {
    init: function () {
      this.appendDummyInput().appendField("LoRa Packet RSSI");
      this.setOutput(true, "Number");
      this.setColour("#3182CE");
    },
  };
  if (generator) {
    generator.forBlock["lora_rssi"] = function () {
      return ["LoRa.packetRssi()", 0];
    };
  }

  // ─── CAN Bus (MCP2515) ───────────────────────────────────────────────────
  Blockly.Blocks["can_init"] = {
    init: function () {
      this.appendDummyInput().appendField("CAN Bus Init (MCP2515)");
      this.appendDummyInput().appendField("CS Pin").appendField(new Blockly.FieldTextInput("10"), "CS");
      this.appendDummyInput()
        .appendField("Speed")
        .appendField(new Blockly.FieldDropdown([["500 KBPS", "CAN_500KBPS"], ["250 KBPS", "CAN_250KBPS"], ["1 MBPS", "CAN_1000KBPS"]]), "SPEED");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#38B2AC");
      this.setTooltip("Initialize CAN Controller");
    },
  };
  if (generator) {
    generator.forBlock["can_init"] = function (block: any) {
      const cs = block.getFieldValue("CS");
      const speed = block.getFieldValue("SPEED");
      compiler.addInclude("#include <SPI.h>\n#include <mcp2515.h>");
      compiler.addGlobal(`MCP2515 mcp2515(${cs});`);
      compiler.addSetup(`mcp2515.reset();`);
      compiler.addSetup(`mcp2515.setBitrate(${speed}, MCP_8MHZ);`);
      compiler.addSetup(`mcp2515.setNormalMode();`);
      return "";
    };
  }

  Blockly.Blocks["can_send"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("CAN Send ID")
        .appendField(new Blockly.FieldTextInput("0x0F6"), "ID")
        .appendField("DLC")
        .appendField(new Blockly.FieldTextInput("8"), "DLC");
      this.appendValueInput("DATA0").setCheck("Number").appendField("B0");
      this.appendValueInput("DATA1").setCheck("Number").appendField("B1");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#38B2AC");
    },
  };
  if (generator) {
    generator.forBlock["can_send"] = function (block: any) {
      const id = block.getFieldValue("ID");
      const dlc = block.getFieldValue("DLC");
      const b0 = generator.valueToCode(block, "DATA0", 0) || "0";
      const b1 = generator.valueToCode(block, "DATA1", 0) || "0";
      return `struct can_frame canMsg;\ncanMsg.can_id = ${id};\ncanMsg.can_dlc = ${dlc};\nfor (byte i = 0; i < 8; i++) canMsg.data[i] = 0;\ncanMsg.data[0] = ${b0};\ncanMsg.data[1] = ${b1};\nmcp2515.sendMessage(&canMsg);\n`;
    };
  }

  // ─── GSM SIM800L ─────────────────────────────────────────────────────────
  Blockly.Blocks["gsm_init"] = {
    init: function () {
      this.appendDummyInput().appendField("GSM Init (SIM800L)");
      this.appendDummyInput().appendField("RX").appendField(new Blockly.FieldTextInput("16"), "RX").appendField("TX").appendField(new Blockly.FieldTextInput("17"), "TX");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    },
  };
  if (generator) {
    generator.forBlock["gsm_init"] = function (block: any) {
      const rx = block.getFieldValue("RX");
      const tx = block.getFieldValue("TX");
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform === "esp32") {
        compiler.addGlobal(`HardwareSerial gsmSerial(1);`);
        compiler.addSetup(`gsmSerial.begin(9600, SERIAL_8N1, ${rx}, ${tx});`);
      } else {
        compiler.addInclude(`#include <SoftwareSerial.h>`);
        compiler.addGlobal(`SoftwareSerial gsmSerial(${rx}, ${tx});`);
        compiler.addSetup(`gsmSerial.begin(9600);`);
      }
      return `gsmSerial.println("AT");\ndelay(500);\n`;
    };
  }

  Blockly.Blocks["gsm_send_sms"] = {
    init: function () {
      this.appendDummyInput().appendField("GSM Send SMS");
      this.appendValueInput("NUMBER").setCheck("String").appendField("To Number");
      this.appendValueInput("TEXT").setCheck("String").appendField("Message");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    },
  };
  if (generator) {
    generator.forBlock["gsm_send_sms"] = function (block: any) {
      let num = generator.valueToCode(block, "NUMBER", 0) || '""';
      let msg = generator.valueToCode(block, "TEXT", 0) || '""';
      num = asCppString(num);
      msg = asCppString(msg);
      return `gsmSerial.println("AT+CMGF=1");\ndelay(200);\ngsmSerial.print("AT+CMGS=\\"");\ngsmSerial.print(${num});\ngsmSerial.println("\\"");\ndelay(200);\ngsmSerial.print(${msg});\ngsmSerial.write(26);\ndelay(500);\n`;
    };
  }

  Blockly.Blocks["gsm_make_call"] = {
    init: function () {
      this.appendValueInput("NUMBER").setCheck("String").appendField("GSM Make Call to");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    },
  };
  if (generator) {
    generator.forBlock["gsm_make_call"] = function (block: any) {
      let num = generator.valueToCode(block, "NUMBER", 0) || '""';
      num = asCppString(num);
      return `gsmSerial.print("ATD");\ngsmSerial.print(${num});\ngsmSerial.println(";");\n`;
    };
  }

  Blockly.Blocks["gsm_hangup"] = {
    init: function () {
      this.appendDummyInput().appendField("GSM Hang Up Call");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    },
  };
  if (generator) {
    generator.forBlock["gsm_hangup"] = function () {
      return `gsmSerial.println("ATH");\n`;
    };
  }

  // ─── RS485 Modbus RTU ────────────────────────────────────────────────────
  Blockly.Blocks["rs485_init"] = {
    init: function () {
      this.appendDummyInput().appendField("RS485 Init");
      this.appendDummyInput().appendField("RX").appendField(new Blockly.FieldTextInput("16"), "RX").appendField("TX").appendField(new Blockly.FieldTextInput("17"), "TX");
      this.appendDummyInput().appendField("DE/RE Pin").appendField(new Blockly.FieldTextInput("4"), "DE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#E53E3E");
    },
  };
  if (generator) {
    generator.forBlock["rs485_init"] = function (block: any) {
      const rx = block.getFieldValue("RX");
      const tx = block.getFieldValue("TX");
      const de = block.getFieldValue("DE");
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform === "esp32") {
        compiler.addGlobal(`HardwareSerial rs485(2);\nconst int RS485_DE = ${de};`);
        compiler.addSetup(`pinMode(RS485_DE, OUTPUT);\ndigitalWrite(RS485_DE, LOW);\nrs485.begin(9600, SERIAL_8N1, ${rx}, ${tx});`);
      } else {
        compiler.addInclude(`#include <SoftwareSerial.h>`);
        compiler.addGlobal(`SoftwareSerial rs485(${rx}, ${tx});\nconst int RS485_DE = ${de};`);
        compiler.addSetup(`pinMode(RS485_DE, OUTPUT);\ndigitalWrite(RS485_DE, LOW);\nrs485.begin(9600);`);
      }
      return "";
    };
  }

  Blockly.Blocks["rs485_send"] = {
    init: function () {
      this.appendValueInput("DATA").setCheck("String").appendField("RS485 Write String");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#E53E3E");
    },
  };
  if (generator) {
    generator.forBlock["rs485_send"] = function (block: any) {
      let data = generator.valueToCode(block, "DATA", 0) || '""';
      data = asCppString(data);
      return `digitalWrite(RS485_DE, HIGH);\ndelay(10);\nrs485.print(${data});\nrs485.flush();\ndigitalWrite(RS485_DE, LOW);\n`;
    };
  }

  Blockly.Blocks["rs485_read"] = {
    init: function () {
      this.appendDummyInput().appendField("RS485 Read String");
      this.setOutput(true, "String");
      this.setColour("#E53E3E");
    },
  };
  if (generator) {
    generator.forBlock["rs485_read"] = function () {
      return ["rs485.readString()", 0];
    };
  }
}

export function getAdvancedCommunicationCategory() {
  return {
    kind: "category",
    name: "Advanced Communication",
    contents: [
      { kind: "label", text: "LoRa (SX1278)" },
      { kind: "block", type: "lora_init" },
      { kind: "block", type: "lora_send" },
      { kind: "block", type: "lora_receive" },
      { kind: "block", type: "lora_read_string" },
      { kind: "block", type: "lora_rssi" },
      { kind: "label", text: "CAN Bus (MCP2515)" },
      { kind: "block", type: "can_init" },
      { kind: "block", type: "can_send" },
      { kind: "label", text: "GSM (SIM800L)" },
      { kind: "block", type: "gsm_init" },
      { kind: "block", type: "gsm_send_sms" },
      { kind: "block", type: "gsm_make_call" },
      { kind: "block", type: "gsm_hangup" },
      { kind: "label", text: "RS485 Modbus" },
      { kind: "block", type: "rs485_init" },
      { kind: "block", type: "rs485_send" },
      { kind: "block", type: "rs485_read" },
    ],
  };
}
