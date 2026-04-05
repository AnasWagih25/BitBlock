import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

export function defineCommunicationBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // WiFi Connect
  Blockly.Blocks["comm_wifi_connect"] = {
    init() {
      this.appendValueInput("SSID").appendField("Connect to WiFi SSID");
      this.appendValueInput("PASS").appendField("Password");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#3182CE");
    }
  };

  if (generator) {
    generator.forBlock["comm_wifi_connect"] = function(block: any, generator: any) {
      let ssid = generator.valueToCode(block, 'SSID', generator.ORDER_ATOMIC) || '""';
      let pass = generator.valueToCode(block, 'PASS', generator.ORDER_ATOMIC) || '""';
      
      // String Wrapping handling
      if (ssid.startsWith("'") && ssid.endsWith("'")) ssid = compiler.wrapString(ssid.slice(1, -1));
      if (pass.startsWith("'") && pass.endsWith("'")) pass = compiler.wrapString(pass.slice(1, -1));

      // @ts-ignore
      const board = getBoardConfig(compiler.boardId);
      
      if (!board.wifi) {
        return `// Board ${board.name} does not natively support WiFi\n`;
      }

      if (board.platform === "esp8266") {
        compiler.addInclude(`#include <ESP8266WiFi.h>`);
      } else if (board.platform === "esp32") {
        compiler.addInclude(`#include <WiFi.h>`);
      } else {
        compiler.addInclude(`#include <WiFiS3.h>`); // e.g. for Uno R4 WiFi
      }

      return `WiFi.begin(${ssid}, ${pass});\nwhile (WiFi.status() != WL_CONNECTED) {\n  delay(500);\n  Serial.print(".");\n}\nSerial.println("WiFi connected");\n`;
    };
  }
}

export function getCommunicationCategory() {
  return {
    kind: "category", name: "Communication",
    contents: [
      { kind: "block", type: "comm_wifi_connect" },
    ]
  };
}
