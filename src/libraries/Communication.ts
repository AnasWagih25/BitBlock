import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

export function defineCommunicationBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;
  const asCppString = (expr: string) => {
    if (expr.startsWith("'") && expr.endsWith("'")) {
      return compiler.wrapString(expr.slice(1, -1));
    }
    return expr;
  };
  const asMqttCstr = (expr: string) => {
    const trimmed = expr.trim();
    // If already a C string literal, avoid heap allocations from String(...)
    if (/^"([^"\\]|\\.)*"$/.test(trimmed)) {
      return trimmed;
    }
    return `String(${expr}).c_str()`;
  };

  // -- WIFI (5) --
  Blockly.Blocks["wifi_connect"] = {
    init() { this.appendDummyInput().appendField("Connect to WiFi"); this.appendValueInput("SSID").setCheck("String").appendField("SSID"); this.appendValueInput("PASS").setCheck("String").appendField("Password"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["wifi_disconnect"] = {
    init() { this.appendDummyInput().appendField("WiFi Disconnect"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["wifi_get_ip"] = {
    init() { this.appendDummyInput().appendField("WiFi Get Local IP String"); this.setOutput(true, "String"); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["wifi_get_mac"] = {
    init() { this.appendDummyInput().appendField("WiFi Get MAC Address String"); this.setOutput(true, "String"); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["wifi_get_rssi"] = {
    init() { this.appendDummyInput().appendField("WiFi Get RSSI (Signal Strength)"); this.setOutput(true, "Number"); this.setColour("#3182CE"); }
  };

  // -- HTTP (2) --
  Blockly.Blocks["http_get_request"] = {
    init() { this.appendValueInput("URL").setCheck("String").appendField("HTTP GET request"); this.setOutput(true, "String"); this.setColour("#2B6CB0"); }
  };
  Blockly.Blocks["http_post_request"] = {
    init() { this.appendValueInput("URL").setCheck("String").appendField("HTTP POST request"); this.appendValueInput("PAYLOAD").setCheck("String").appendField("Payload"); this.setInputsInline(true); this.setOutput(true, "String"); this.setColour("#2B6CB0"); }
  };

  // -- MQTT (7) --
  Blockly.Blocks["mqtt_init"] = {
    init() { this.appendDummyInput().appendField("Init MQTT Client"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["mqtt_set_server"] = {
    init() { this.appendValueInput("SERVER").setCheck("String").appendField("MQTT Set Broker IP/URL"); this.appendValueInput("PORT").setCheck("Number").appendField("Port"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["mqtt_connect"] = {
    init() { this.appendValueInput("ID").setCheck("String").appendField("MQTT Connect logic (ID)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["mqtt_publish"] = {
    init() { this.appendValueInput("TOPIC").setCheck("String").appendField("MQTT Publish Topic"); this.appendValueInput("MSG").setCheck("String").appendField("Message"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["mqtt_subscribe"] = {
    init() { this.appendValueInput("TOPIC").setCheck("String").appendField("MQTT Subscribe to"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["mqtt_loop"] = {
    init() { this.appendDummyInput().appendField("MQTT Action .loop()"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C5282"); }
  };
  Blockly.Blocks["mqtt_is_connected"] = {
    init() { this.appendDummyInput().appendField("MQTT Connected state"); this.setOutput(true, "Boolean"); this.setColour("#2C5282"); }
  };

  // -- BLUETOOTH CLASSIC (4) --
  Blockly.Blocks["bt_classic_init"] = {
    init() { this.appendValueInput("NAME").setCheck("String").appendField("Init Bluetooth Serial Output name"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4299E1"); }
  };
  Blockly.Blocks["bt_classic_print"] = {
    init() { this.appendValueInput("MSG").setCheck("String").appendField("Bluetooth Print line"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4299E1"); }
  };
  Blockly.Blocks["bt_classic_read"] = {
    init() { this.appendDummyInput().appendField("Bluetooth Read Received String"); this.setOutput(true, "String"); this.setColour("#4299E1"); }
  };
  Blockly.Blocks["bt_classic_available"] = {
    init() { this.appendDummyInput().appendField("Bluetooth Bytes Available"); this.setOutput(true, "Number"); this.setColour("#4299E1"); }
  };

  // -- BLE (5) --
  Blockly.Blocks["ble_init"] = {
    init() { this.appendValueInput("NAME").setCheck("String").appendField("Init Basic BLE Device name"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["ble_start_advertising"] = {
    init() { this.appendDummyInput().appendField("BLE Start Advertising"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["ble_create_service"] = {
    init() { this.appendValueInput("UUID").setCheck("String").appendField("BLE Create Service UUID"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["ble_create_characteristic"] = {
    init() { this.appendValueInput("UUID").setCheck("String").appendField("BLE Creat Char UUID"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["ble_notify"] = {
    init() { this.appendValueInput("MSG").setCheck("String").appendField("BLE Notify String"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };

  // -- BAUDRATE / SERIAL (5) --
  Blockly.Blocks["serial_init_baud"] = {
    init() { this.appendValueInput("BAUD").setCheck("Number").appendField("Init Core Serial at baud"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["comm_serial_print"] = {
    init() { this.appendValueInput("MSG").appendField("Serial Print"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["serial_println"] = {
    init() { this.appendValueInput("MSG").appendField("Serial Println"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#718096"); }
  };
  Blockly.Blocks["serial_read_string"] = {
    init() { this.appendDummyInput().appendField("Serial Read String"); this.setOutput(true, "String"); this.setColour("#718096"); }
  };
  Blockly.Blocks["serial_available"] = {
    init() { this.appendDummyInput().appendField("Serial Available (>0)"); this.setOutput(true, "Boolean"); this.setColour("#718096"); }
  };

  // -- BAREBUS (2) --
  Blockly.Blocks["i2c_scan_bus"] = {
    init() { this.appendDummyInput().appendField("I2C Scan Bus Action"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4A5568"); }
  };
  Blockly.Blocks["spi_init"] = {
    init() { this.appendDummyInput().appendField("SPI Boot Bus Action"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4A5568"); }
  };


  if (generator) {
    // WiFi
    generator.forBlock["wifi_connect"] = function(block: any, generator: any) {
      let ssid = generator.valueToCode(block, 'SSID', generator.ORDER_ATOMIC) || '""';
      let pass = generator.valueToCode(block, 'PASS', generator.ORDER_ATOMIC) || '""';
      ssid = asCppString(ssid);
      pass = asCppString(pass);
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (!bd.wifi) {
        return `Serial.println("WiFi not supported on selected board");\n`;
      }
      if (bd.platform === "esp8266") compiler.addInclude(`#include <ESP8266WiFi.h>`);
      else if (bd.platform === "esp32") compiler.addInclude(`#include <WiFi.h>`);
      else compiler.addInclude(`#include <WiFiS3.h>`);
      return `WiFi.begin(${ssid}, ${pass});\nwhile (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }\nSerial.println("\\nWiFi connected");\n`;
    };
    generator.forBlock["wifi_disconnect"] = function() { return `WiFi.disconnect();\n`; };
    generator.forBlock["wifi_get_ip"] = function() { return [`String(WiFi.localIP())`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["wifi_get_mac"] = function() { return [`WiFi.macAddress()`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["wifi_get_rssi"] = function() { return [`WiFi.RSSI()`, generator.ORDER_FUNCTION_CALL]; };

    // HTTP
    generator.forBlock["http_get_request"] = function(block: any, generator: any) {
      let u = generator.valueToCode(block, 'URL', generator.ORDER_ATOMIC) || '""';
      u = asCppString(u);
      compiler.addInclude(`#include <HTTPClient.h>\n#include <WiFiClient.h>`);
      compiler.addGlobal(`
String __httpGET(String u) {
  HTTPClient h; WiFiClient c; h.begin(c, u);
  int code = h.GET(); String res = "";
  if (code > 0) res = h.getString();
  h.end(); return res;
}`);
      return [`__httpGET(${u})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["http_post_request"] = function(block: any, generator: any) {
      let u = generator.valueToCode(block, 'URL', generator.ORDER_ATOMIC) || '""';
      let p = generator.valueToCode(block, 'PAYLOAD', generator.ORDER_ATOMIC) || '""';
      u = asCppString(u);
      p = asCppString(p);
      compiler.addInclude(`#include <HTTPClient.h>\n#include <WiFiClient.h>`);
      compiler.addGlobal(`
String __httpPOST(String u, String p) {
  HTTPClient h; WiFiClient c; h.begin(c, u);
  h.addHeader("Content-Type", "application/json");
  int code = h.POST(p); String res = "";
  if (code > 0) res = h.getString();
  h.end(); return res;
}`);
      return [`__httpPOST(${u}, ${p})`, generator.ORDER_FUNCTION_CALL];
    };

    // MQTT
    generator.forBlock["mqtt_init"] = function() {
      compiler.addInclude(`#include <PubSubClient.h>`);
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform === "esp8266") compiler.addInclude(`#include <ESP8266WiFi.h>`);
      else if (bd.platform === "esp32") compiler.addInclude(`#include <WiFi.h>`);
      else compiler.addInclude(`#include <WiFiS3.h>`);
      compiler.addGlobal(`WiFiClient espClient;\nPubSubClient mqttClient(espClient);\nString mqttHost = "";\nString mqttClientId = "bitblock_client";`);
      compiler.addGlobal(`
void mqttConnectBlock(String id) {
  if (mqttHost.length() == 0) return;
  if (id.length() == 0) id = "bitblock_client";
  if (mqttClient.connected()) return;
  mqttClient.connect(id.c_str());
}`);
      // Keep MQTT connected, then service keepalive/packets.
      compiler.addLoop(`mqttConnectBlock(mqttClientId);`);
      compiler.addLoop(`mqttClient.loop();`);
      return "";
    };
    generator.forBlock["mqtt_set_server"] = function(block: any, generator: any) {
      let s = generator.valueToCode(block, 'SERVER', generator.ORDER_ATOMIC) || '""';
      let p = generator.valueToCode(block, 'PORT', generator.ORDER_ATOMIC) || '1883';
      s = asCppString(s);
      return `mqttHost = String(${s});\nmqttHost.trim();\nmqttClient.setServer(mqttHost.c_str(), ${p});\n`;
    };
    generator.forBlock["mqtt_connect"] = function(block: any, generator: any) {
      let id = generator.valueToCode(block, 'ID', generator.ORDER_ATOMIC) || '""';
      id = asCppString(id);
      return `mqttClientId = String(${id});\nmqttConnectBlock(mqttClientId);\n`;
    };
    generator.forBlock["mqtt_publish"] = function(block: any, generator: any) {
      let t = generator.valueToCode(block, 'TOPIC', generator.ORDER_ATOMIC) || '""';
      let m = generator.valueToCode(block, 'MSG', generator.ORDER_ATOMIC) || '""';
      t = asCppString(t);
      m = asCppString(m);
      const topicArg = asMqttCstr(t);
      const msgArg = asMqttCstr(m);
      return `mqttClient.publish(${topicArg}, ${msgArg});\n`;
    };
    generator.forBlock["mqtt_subscribe"] = function(block: any, generator: any) {
      let t = generator.valueToCode(block, 'TOPIC', generator.ORDER_ATOMIC) || '""';
      t = asCppString(t);
      const topicArg = asMqttCstr(t);
      return `mqttClient.subscribe(${topicArg});\n`;
    };
    generator.forBlock["mqtt_loop"] = function() { return `mqttClient.loop();\n`; };
    generator.forBlock["mqtt_is_connected"] = function() { return [`mqttClient.connected()`, generator.ORDER_FUNCTION_CALL]; };

    // Bluetooth
    generator.forBlock["bt_classic_init"] = function(block: any, generator: any) {
      let n = generator.valueToCode(block, 'NAME', generator.ORDER_ATOMIC) || '"ESP32_BT"';
      n = asCppString(n);
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform !== "esp32") return `Serial.println("Bluetooth Classic supported only on ESP32");\n`;
      compiler.addInclude(`#include "BluetoothSerial.h"`);
      compiler.addGlobal(`BluetoothSerial SerialBT;`);
      compiler.addSetup(`SerialBT.begin(${n});`);
      return "";
    };
    generator.forBlock["bt_classic_print"] = function(block: any, generator: any) {
      let m = generator.valueToCode(block, 'MSG', generator.ORDER_ATOMIC) || '""';
      m = asCppString(m);
      return `SerialBT.println(${m});\n`;
    };
    generator.forBlock["bt_classic_read"] = function() {
      compiler.addGlobal(`String btReadStr() { String o=""; while(SerialBT.available()) { o += (char)SerialBT.read(); } return o; }`);
      return [`btReadStr()`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["bt_classic_available"] = function() { return [`SerialBT.available()`, generator.ORDER_FUNCTION_CALL]; };

    // BLE
    generator.forBlock["ble_init"] = function(block: any, generator: any) {
      let n = generator.valueToCode(block, 'NAME', generator.ORDER_ATOMIC) || '"ESP32_BLE"';
      n = asCppString(n);
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      if (bd.platform !== "esp32") return `Serial.println("BLE supported only on ESP32");\n`;
      compiler.addInclude(`#include <BLEDevice.h>\n#include <BLEServer.h>\n#include <BLEUtils.h>`);
      compiler.addGlobal(`BLEServer* pServer = nullptr;\nBLEAdvertising* pAdvertising = nullptr;`);
      compiler.addSetup(`BLEDevice::init(String(${n}).c_str());\npServer = BLEDevice::createServer();\npAdvertising = BLEDevice::getAdvertising();`);
      return "";
    };
    generator.forBlock["ble_start_advertising"] = function() {
      return `if (pAdvertising) pAdvertising->start();\n`;
    };
    // Basic hooks for others as placeholder (pure BLE server architecture is complex)
    generator.forBlock["ble_create_service"] = function() { return `// Create BLE Service\n`; };
    generator.forBlock["ble_create_characteristic"] = function() { return `// Create BLE Char\n`; };
    generator.forBlock["ble_notify"] = function() { return `// BLE Notify\n`; };

    // Serial
    generator.forBlock["serial_init_baud"] = function(block: any, generator: any) {
      let b = generator.valueToCode(block, 'BAUD', generator.ORDER_ATOMIC) || '115200';
      compiler.addSetup(`Serial.begin(${b});`);
      return "";
    };
    generator.forBlock["comm_serial_print"] = function(block: any, generator: any) {
      let m = generator.valueToCode(block, 'MSG', generator.ORDER_ATOMIC) || '""';
      m = asCppString(m);
      return `Serial.print(${m});\n`;
    };
    generator.forBlock["serial_println"] = function(block: any, generator: any) {
      let m = generator.valueToCode(block, 'MSG', generator.ORDER_ATOMIC) || '""';
      m = asCppString(m);
      return `Serial.println(${m});\n`;
    };
    generator.forBlock["serial_read_string"] = function() { return [`Serial.readString()`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["serial_available"] = function() { return [`(Serial.available() > 0)`, generator.ORDER_FUNCTION_CALL]; };

    // Barebus
    generator.forBlock["i2c_scan_bus"] = function() {
      compiler.addInclude(`#include <Wire.h>`);
      compiler.addGlobal(`
void i2cScan() {
  Wire.begin();
  for(byte i = 8; i < 120; i++) {
    Wire.beginTransmission(i);
    if(Wire.endTransmission() == 0) { Serial.print("Found I2C device at 0x"); Serial.println(i, HEX); }
  }
}`);
      return `i2cScan();\n`;
    };
    generator.forBlock["spi_init"] = function() { compiler.addInclude(`#include <SPI.h>`); return `SPI.begin();\n`; };
  }
}

export function getCommunicationCategory() {
  return {
    kind: "category", name: "Communication & IoT",
    contents: [
      { kind: "label", text: "WiFi Subsystem" },
      { kind: "block", type: "wifi_connect" },
      { kind: "block", type: "wifi_disconnect" },
      { kind: "block", type: "wifi_get_ip" },
      { kind: "block", type: "wifi_get_mac" },
      { kind: "block", type: "wifi_get_rssi" },
      { kind: "label", text: "HTTP Web client" },
      { kind: "block", type: "http_get_request" },
      { kind: "block", type: "http_post_request" },
      { kind: "label", text: "MQTT IoT Broker" },
      { kind: "block", type: "mqtt_init" },
      { kind: "block", type: "mqtt_set_server" },
      { kind: "block", type: "mqtt_connect" },
      { kind: "block", type: "mqtt_publish" },
      { kind: "block", type: "mqtt_subscribe" },
      { kind: "block", type: "mqtt_loop" },
      { kind: "block", type: "mqtt_is_connected" },
      { kind: "label", text: "Bluetooth Classic" },
      { kind: "block", type: "bt_classic_init" },
      { kind: "block", type: "bt_classic_print" },
      { kind: "block", type: "bt_classic_read" },
      { kind: "block", type: "bt_classic_available" },
      { kind: "label", text: "Bluetooth Low Energy" },
      { kind: "block", type: "ble_init" },
      { kind: "block", type: "ble_start_advertising" },
      { kind: "block", type: "ble_create_service" },
      { kind: "block", type: "ble_create_characteristic" },
      { kind: "block", type: "ble_notify" },
      { kind: "label", text: "Serial & Buses" },
      { kind: "block", type: "serial_init_baud" },
      { kind: "block", type: "comm_serial_print" },
      { kind: "block", type: "serial_println" },
      { kind: "block", type: "serial_read_string" },
      { kind: "block", type: "serial_available" },
      { kind: "block", type: "i2c_scan_bus" },
      { kind: "block", type: "spi_init" },
    ]
  };
}
