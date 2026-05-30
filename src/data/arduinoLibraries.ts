// ── Arduino Library Registry ──────────────────────────────────────────────────
// Curated list of popular Arduino/ESP32 libraries with metadata.
// Community libraries can be added via GitHub URL at runtime.

export interface ArduinoLibrary {
  id: string;
  name: string;
  include: string;           // The #include line
  description: string;
  category: LibraryCategory;
  version?: string;
  author?: string;
  url?: string;              // GitHub / reference URL
  boards: BoardCompat[];     // Which boards support it
  extraIncludes?: string[];  // Additional headers sometimes needed
  initSnippet?: string;      // Optional setup() code hint
  isCustom?: boolean;        // User-added community library
}

export type LibraryCategory =
  | "Sensors"
  | "Display"
  | "Communication"
  | "Motors & Actuators"
  | "Networking"
  | "ML / AI"
  | "Data & Storage"
  | "Audio"
  | "Timing & Interrupts"
  | "Math & Signal"
  | "Utilities"
  | "Community";

export type BoardCompat =
  | "esp32"
  | "esp8266"
  | "avr"
  | "renesas"
  | "all";

// ── Built-in Curated Libraries ────────────────────────────────────────────────

export const BUILTIN_LIBRARIES: ArduinoLibrary[] = [

  // ── Sensors ────────────────────────────────────────────────────────────────
  {
    id: "dht",
    name: "DHT Sensor Library",
    include: '#include "DHT.h"',
    description: "Temperature and humidity sensor support for DHT11, DHT22, AM2302",
    category: "Sensors",
    author: "Adafruit",
    url: "https://github.com/adafruit/DHT-sensor-library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ['#include "Adafruit_Sensor.h"'],
    initSnippet: "DHT dht(DHTPIN, DHTTYPE);\n// In setup(): dht.begin();",
  },
  {
    id: "adafruit-bme280",
    name: "Adafruit BME280",
    include: '#include "Adafruit_BME280.h"',
    description: "I2C/SPI temperature, humidity and pressure sensor (BME280)",
    category: "Sensors",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_BME280_Library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ['#include "Adafruit_Sensor.h"', "#include <Wire.h>"],
  },
  {
    id: "adafruit-bmp280",
    name: "Adafruit BMP280",
    include: '#include "Adafruit_BMP280.h"',
    description: "Barometric pressure and altitude sensor (BMP280)",
    category: "Sensors",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_BMP280_Library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <Wire.h>"],
  },
  {
    id: "adafruit-mpu6050",
    name: "Adafruit MPU6050",
    include: '#include "Adafruit_MPU6050.h"',
    description: "6-DOF IMU — 3-axis accelerometer + 3-axis gyroscope",
    category: "Sensors",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_MPU6050",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ['#include "Adafruit_Sensor.h"', "#include <Wire.h>"],
  },
  {
    id: "ultrasonic",
    name: "HC-SR04 Ultrasonic",
    include: '#include "NewPing.h"',
    description: "HC-SR04 ultrasonic distance sensor driver",
    category: "Sensors",
    author: "Tim Eckel",
    url: "https://github.com/microflo/NewPing",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "onewire",
    name: "OneWire",
    include: "#include <OneWire.h>",
    description: "1-Wire protocol for DS18B20 temperature sensors and similar devices",
    category: "Sensors",
    author: "Paul Stoffregen",
    url: "https://github.com/PaulStoffregen/OneWire",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "dallas-temperature",
    name: "DallasTemperature (DS18B20)",
    include: '#include "DallasTemperature.h"',
    description: "DS18B20 / DS18S20 temperature sensor library (requires OneWire)",
    category: "Sensors",
    author: "Miles Burton",
    url: "https://github.com/milesburton/Arduino-Temperature-Control-Library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <OneWire.h>"],
  },
  {
    id: "vl53l0x",
    name: "VL53L0X ToF Sensor",
    include: '#include "Adafruit_VL53L0X.h"',
    description: "Time-of-flight laser distance sensor — precise short range (2m)",
    category: "Sensors",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_VL53L0X",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <Wire.h>"],
  },
  {
    id: "max30105",
    name: "MAX30105 Pulse Oximeter",
    include: '#include "MAX30105.h"',
    description: "Heart rate and SpO2 sensor (MAX30105 / MAX30102)",
    category: "Sensors",
    author: "SparkFun",
    url: "https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <Wire.h>"],
  },
  {
    id: "pms5003",
    name: "PMS5003 Air Quality",
    include: '#include "PMS.h"',
    description: "Plantower PMS5003/7003 particulate matter air quality sensor",
    category: "Sensors",
    author: "Mariusz Kacki",
    url: "https://github.com/fu-hsi/pms",
    boards: ["esp32", "esp8266", "avr", "all"],
  },
  {
    id: "adafruit-ina219",
    name: "Adafruit INA219",
    include: '#include "Adafruit_INA219.h"',
    description: "Current/power monitor over I2C (INA219 / INA260)",
    category: "Sensors",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_INA219",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <Wire.h>"],
  },

  // ── Display ────────────────────────────────────────────────────────────────
  {
    id: "u8g2",
    name: "U8g2 Display Library",
    include: "#include <U8g2lib.h>",
    description: "Universal monochrome display driver for OLED/LCD (SSD1306, SH1106, etc.)",
    category: "Display",
    author: "olikraus",
    url: "https://github.com/olikraus/u8g2",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <Wire.h>"],
  },
  {
    id: "ssd1306",
    name: "Adafruit SSD1306 OLED",
    include: '#include "Adafruit_SSD1306.h"',
    description: "128x64 / 128x32 OLED display via I2C or SPI",
    category: "Display",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_SSD1306",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ['#include "Adafruit_GFX.h"', "#include <Wire.h>"],
    initSnippet: 'Adafruit_SSD1306 display(128, 64, &Wire, -1);\n// In setup(): display.begin(SSD1306_SWITCHCAPVCC, 0x3C);',
  },
  {
    id: "adafruit-gfx",
    name: "Adafruit GFX Library",
    include: '#include "Adafruit_GFX.h"',
    description: "Core graphics library for TFT, OLED, e-paper displays",
    category: "Display",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit-GFX-Library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "tft-espi",
    name: "TFT_eSPI",
    include: "#include <TFT_eSPI.h>",
    description: "High-performance TFT display driver for ESP32/ESP8266 (ILI9341, ST7789, etc.)",
    category: "Display",
    author: "Bodmer",
    url: "https://github.com/Bodmer/TFT_eSPI",
    boards: ["esp32", "esp8266"],
    initSnippet: "TFT_eSPI tft = TFT_eSPI();\n// In setup(): tft.init(); tft.setRotation(1);",
  },
  {
    id: "lvgl",
    name: "LVGL GUI Library",
    include: "#include <lvgl.h>",
    description: "Light and Versatile Graphics Library for touch-screen UIs on ESP32",
    category: "Display",
    author: "LVGL",
    url: "https://github.com/lvgl/lvgl",
    boards: ["esp32"],
  },
  {
    id: "epaper",
    name: "GxEPD2 e-Paper",
    include: "#include <GxEPD2_BW.h>",
    description: "E-paper/e-ink display driver (Waveshare, GDEW, etc.)",
    category: "Display",
    author: "ZinggJM",
    url: "https://github.com/ZinggJM/GxEPD2",
    boards: ["esp32", "esp8266", "avr", "all"],
    extraIncludes: ['#include "Adafruit_GFX.h"'],
  },
  {
    id: "max7219-led",
    name: "LedControl (MAX7219)",
    include: "#include <LedControl.h>",
    description: "LED matrix / 7-segment control via MAX7219",
    category: "Display",
    author: "Eberhard Fahle",
    url: "https://github.com/wayoda/LedControl",
    boards: ["esp32", "esp8266", "avr", "all"],
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    id: "wire",
    name: "Wire (I2C)",
    include: "#include <Wire.h>",
    description: "I2C/TWI communication library — built into Arduino core",
    category: "Communication",
    author: "Arduino",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "spi",
    name: "SPI",
    include: "#include <SPI.h>",
    description: "Serial Peripheral Interface bus — built into Arduino core",
    category: "Communication",
    author: "Arduino",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "software-serial",
    name: "SoftwareSerial",
    include: "#include <SoftwareSerial.h>",
    description: "Software-emulated UART on any GPIO pins",
    category: "Communication",
    author: "Arduino",
    boards: ["avr", "all"],
    initSnippet: "SoftwareSerial mySerial(RX_PIN, TX_PIN);",
  },
  {
    id: "hardware-serial",
    name: "HardwareSerial (ESP32)",
    include: "#include <HardwareSerial.h>",
    description: "ESP32 hardware UART2/UART1 on custom pins",
    category: "Communication",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: 'HardwareSerial mySerial(1);\n// In setup(): mySerial.begin(115200, SERIAL_8N1, RX, TX);',
  },
  {
    id: "rf24",
    name: "RF24 (nRF24L01)",
    include: "#include <RF24.h>",
    description: "2.4GHz RF transceiver — nRF24L01 wireless communication",
    category: "Communication",
    author: "TMRh20",
    url: "https://github.com/nRF24/RF24",
    boards: ["esp32", "esp8266", "avr", "all"],
    extraIncludes: ["#include <SPI.h>"],
  },
  {
    id: "lora",
    name: "LoRa (SX1276/SX1278)",
    include: "#include <LoRa.h>",
    description: "LoRa long-range wireless communication driver",
    category: "Communication",
    author: "Sandeep Mistry",
    url: "https://github.com/sandeepmistry/arduino-LoRa",
    boards: ["esp32", "esp8266", "avr", "all"],
    extraIncludes: ["#include <SPI.h>"],
  },
  {
    id: "can-bus",
    name: "CAN Bus (MCP2515)",
    include: "#include <mcp2515.h>",
    description: "CAN Bus 2.0 controller via MCP2515",
    category: "Communication",
    author: "autowp",
    url: "https://github.com/autowp/arduino-mcp2515",
    boards: ["esp32", "esp8266", "avr", "all"],
    extraIncludes: ["#include <SPI.h>"],
  },
  {
    id: "modbus",
    name: "ModbusMaster",
    include: "#include <ModbusMaster.h>",
    description: "Modbus RTU master library over RS-485/RS-232",
    category: "Communication",
    author: "Doc Walker",
    url: "https://github.com/4-20ma/ModbusMaster",
    boards: ["esp32", "esp8266", "avr", "all"],
  },
  {
    id: "simplebluetooth",
    name: "BluetoothSerial (ESP32)",
    include: "#include <BluetoothSerial.h>",
    description: "Classic Bluetooth SPP serial communication for ESP32",
    category: "Communication",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: 'BluetoothSerial SerialBT;\n// In setup(): SerialBT.begin("ESP32-BT");',
  },
  {
    id: "ble-esp32",
    name: "BLE (ESP32 NimBLE)",
    include: "#include <NimBLEDevice.h>",
    description: "Lightweight BLE stack for ESP32 — server/client/scan",
    category: "Communication",
    author: "h2zero",
    url: "https://github.com/h2zero/NimBLE-Arduino",
    boards: ["esp32"],
  },
  {
    id: "irremote",
    name: "IRremote",
    include: "#include <IRremote.hpp>",
    description: "Infrared remote control send/receive library",
    category: "Communication",
    author: "Ken Shirriff",
    url: "https://github.com/Arduino-IRremote/Arduino-IRremote",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },

  // ── Networking ─────────────────────────────────────────────────────────────
  {
    id: "wifi-esp32",
    name: "WiFi (ESP32)",
    include: "#include <WiFi.h>",
    description: "ESP32 built-in WiFi station/AP/mesh networking",
    category: "Networking",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: 'WiFi.begin("SSID", "PASSWORD");\nwhile (WiFi.status() != WL_CONNECTED) delay(500);',
  },
  {
    id: "wifi-esp8266",
    name: "ESP8266WiFi",
    include: "#include <ESP8266WiFi.h>",
    description: "ESP8266 built-in WiFi stack",
    category: "Networking",
    author: "Ivan Grokhotkov",
    boards: ["esp8266"],
    initSnippet: 'WiFi.begin("SSID", "PASSWORD");\nwhile (WiFi.status() != WL_CONNECTED) delay(500);',
  },
  {
    id: "httpclient-esp32",
    name: "HTTPClient (ESP32)",
    include: "#include <HTTPClient.h>",
    description: "HTTP/HTTPS GET/POST client for ESP32",
    category: "Networking",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: 'HTTPClient http;\nhttp.begin("https://api.example.com/data");\nint code = http.GET();\nString body = http.getString();',
  },
  {
    id: "websockets",
    name: "WebSockets",
    include: "#include <WebSocketsClient.h>",
    description: "WebSocket client/server for ESP32/ESP8266",
    category: "Networking",
    author: "Links2004",
    url: "https://github.com/Links2004/arduinoWebSockets",
    boards: ["esp32", "esp8266"],
  },
  {
    id: "pubsubclient",
    name: "PubSubClient (MQTT)",
    include: "#include <PubSubClient.h>",
    description: "MQTT publish/subscribe client for IoT — works with AWS IoT, HiveMQ, Mosquitto",
    category: "Networking",
    author: "Nick O'Leary",
    url: "https://github.com/knolleary/pubsubclient",
    boards: ["esp32", "esp8266"],
    initSnippet: 'PubSubClient client(wifiClient);\nclient.setServer("broker.example.com", 1883);\nclient.connect("ESP32Client");\nclient.publish("topic/hello", "payload");',
  },
  {
    id: "firebase-esp32",
    name: "Firebase ESP32 Client",
    include: "#include <FirebaseESP32.h>",
    description: "Google Firebase Realtime Database and Cloud Firestore for ESP32",
    category: "Networking",
    author: "mobizt",
    url: "https://github.com/mobizt/Firebase-ESP32",
    boards: ["esp32"],
  },
  {
    id: "arduino-json",
    name: "ArduinoJson",
    include: "#include <ArduinoJson.h>",
    description: "JSON serialization/deserialization — parse API responses, build payloads",
    category: "Networking",
    author: "Benoit Blanchon",
    url: "https://github.com/bblanchon/ArduinoJson",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    initSnippet: 'JsonDocument doc;\ndeserializeJson(doc, jsonString);\nString val = doc["key"];',
  },
  {
    id: "async-webserver",
    name: "ESPAsyncWebServer",
    include: "#include <ESPAsyncWebServer.h>",
    description: "Async HTTP/WebSocket server for ESP32/ESP8266",
    category: "Networking",
    author: "ESP Async WebServer",
    url: "https://github.com/ESP-EasyEV/ESPAsyncWebServer",
    boards: ["esp32", "esp8266"],
    extraIncludes: ["#include <AsyncTCP.h>"],
    initSnippet: 'AsyncWebServer server(80);\nserver.on("/", HTTP_GET, [](AsyncWebServerRequest *r) {\n  r->send(200, "text/plain", "Hello!");\n});\nserver.begin();',
  },
  {
    id: "espnow",
    name: "ESP-NOW",
    include: "#include <esp_now.h>",
    description: "Ultra-fast peer-to-peer protocol between ESP32 boards — no router needed",
    category: "Networking",
    author: "Espressif",
    boards: ["esp32"],
    extraIncludes: ["#include <WiFi.h>"],
  },
  {
    id: "ota",
    name: "ArduinoOTA",
    include: "#include <ArduinoOTA.h>",
    description: "Over-the-air firmware updates via WiFi — update ESP32 without USB",
    category: "Networking",
    author: "Arduino",
    boards: ["esp32", "esp8266"],
    initSnippet: "ArduinoOTA.begin();\n// In loop(): ArduinoOTA.handle();",
  },
  {
    id: "ntpclient",
    name: "NTPClient",
    include: "#include <NTPClient.h>",
    description: "Get real time from NTP server over WiFi",
    category: "Networking",
    author: "Fabrice Weinberg",
    url: "https://github.com/arduino-libraries/NTPClient",
    boards: ["esp32", "esp8266"],
    extraIncludes: ["#include <WiFiUdp.h>"],
    initSnippet: 'WiFiUDP ntpUDP;\nNTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000);\n// In setup(): timeClient.begin();\n// In loop(): timeClient.update();',
  },

  // ── Motors & Actuators ─────────────────────────────────────────────────────
  {
    id: "servo",
    name: "Servo",
    include: "#include <Servo.h>",
    description: "RC servo motor control — built into Arduino / ESP32-compatible",
    category: "Motors & Actuators",
    author: "Arduino",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    initSnippet: "Servo myServo;\n// In setup(): myServo.attach(PIN);\n// myServo.write(90);",
  },
  {
    id: "esp32servo",
    name: "ESP32Servo",
    include: "#include <ESP32Servo.h>",
    description: "Servo library optimized for ESP32 using LEDC hardware PWM",
    category: "Motors & Actuators",
    author: "John K. Bennett",
    url: "https://github.com/madhephaestus/ESP32Servo",
    boards: ["esp32"],
    initSnippet: "Servo myServo;\n// In setup(): myServo.attach(PIN);\n// myServo.write(90);",
  },
  {
    id: "stepper",
    name: "Stepper",
    include: "#include <Stepper.h>",
    description: "Stepper motor control — built into Arduino core",
    category: "Motors & Actuators",
    author: "Arduino",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "accelstepper",
    name: "AccelStepper",
    include: "#include <AccelStepper.h>",
    description: "Advanced stepper motor control with acceleration and multi-motor support",
    category: "Motors & Actuators",
    author: "Mike McCauley",
    url: "https://github.com/waspinator/AccelStepper",
    boards: ["esp32", "esp8266", "avr", "all"],
  },
  {
    id: "fastled",
    name: "FastLED",
    include: "#include <FastLED.h>",
    description: "High-performance WS2812B / NeoPixel / APA102 addressable LED control",
    category: "Motors & Actuators",
    author: "Daniel Garcia",
    url: "https://github.com/FastLED/FastLED",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    initSnippet: "CRGB leds[NUM_LEDS];\n// In setup(): FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);",
  },
  {
    id: "adafruit-neopixel",
    name: "Adafruit NeoPixel",
    include: "#include <Adafruit_NeoPixel.h>",
    description: "WS2812B / NeoPixel addressable RGB LED strip control",
    category: "Motors & Actuators",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_NeoPixel",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    initSnippet: "Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);\n// In setup(): strip.begin(); strip.show();",
  },
  {
    id: "afmotor",
    name: "Adafruit Motor Shield V2",
    include: "#include <Adafruit_MotorShield.h>",
    description: "DC motor, stepper, and servo control via Adafruit Motor Shield V2",
    category: "Motors & Actuators",
    author: "Adafruit",
    url: "https://github.com/adafruit/Adafruit_Motor_Shield_V2_Library",
    boards: ["esp32", "avr", "all"],
    extraIncludes: ["#include <Wire.h>"],
  },

  // ── Data & Storage ─────────────────────────────────────────────────────────
  {
    id: "spiffs",
    name: "SPIFFS (ESP32)",
    include: "#include <SPIFFS.h>",
    description: "Serial Peripheral Interface Flash File System — store files on ESP32 flash",
    category: "Data & Storage",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: "// In setup(): SPIFFS.begin(true);",
  },
  {
    id: "littlefs",
    name: "LittleFS (ESP32/ESP8266)",
    include: "#include <LittleFS.h>",
    description: "LittleFS file system — better than SPIFFS for wear-leveling",
    category: "Data & Storage",
    author: "Espressif / Ivan Grokhotkov",
    boards: ["esp32", "esp8266"],
    initSnippet: "// In setup(): LittleFS.begin(true);",
  },
  {
    id: "sd",
    name: "SD Card",
    include: "#include <SD.h>",
    description: "SD card read/write — FAT16/FAT32 via SPI",
    category: "Data & Storage",
    author: "Arduino",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    extraIncludes: ["#include <SPI.h>"],
    initSnippet: "// In setup(): SD.begin(CS_PIN);",
  },
  {
    id: "eeprom",
    name: "EEPROM",
    include: "#include <EEPROM.h>",
    description: "Non-volatile storage — save settings across reboots",
    category: "Data & Storage",
    author: "Arduino",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    initSnippet: "// In setup(): EEPROM.begin(512); // ESP32 requires size\n// EEPROM.put(addr, data); EEPROM.commit();",
  },
  {
    id: "preferences",
    name: "Preferences (ESP32 NVS)",
    include: "#include <Preferences.h>",
    description: "ESP32 non-volatile storage using NVS — key-value pairs in flash",
    category: "Data & Storage",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: 'Preferences prefs;\n// prefs.begin("myApp", false);\n// prefs.putInt("key", value);\n// int val = prefs.getInt("key", 0);',
  },

  // ── ML / AI ────────────────────────────────────────────────────────────────
  {
    id: "tflite-micro",
    name: "TensorFlow Lite Micro",
    include: '#include "tensorflow/lite/micro/all_ops_resolver.h"',
    description: "TFLite Micro — run quantized ML models on ESP32/Arduino",
    category: "ML / AI",
    author: "Google",
    url: "https://github.com/tensorflow/tflite-micro",
    boards: ["esp32"],
    extraIncludes: [
      '#include "tensorflow/lite/micro/micro_interpreter.h"',
      '#include "tensorflow/lite/schema/schema_generated.h"',
    ],
  },
  {
    id: "edge-impulse",
    name: "Edge Impulse SDK",
    include: '#include "edge-impulse-sdk/classifier/ei_run_classifier.h"',
    description: "Edge Impulse embedded ML inference — deploy trained models",
    category: "ML / AI",
    author: "Edge Impulse",
    url: "https://github.com/edgeimpulse/inferencing-sdk-cpp",
    boards: ["esp32"],
  },
  {
    id: "eloquent-ml",
    name: "EloquentTinyML",
    include: "#include <EloquentTinyML.h>",
    description: "Easy TFLite Micro wrapper for Arduino edge inference",
    category: "ML / AI",
    author: "Eloquent Arduino",
    url: "https://github.com/eloquentarduino/EloquentTinyML",
    boards: ["esp32", "renesas"],
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  {
    id: "i2s-esp32",
    name: "I2S Audio (ESP32)",
    include: "#include <driver/i2s.h>",
    description: "ESP32 hardware I2S for MEMS microphones (INMP441, SPH0645) and DAC",
    category: "Audio",
    author: "Espressif",
    boards: ["esp32"],
  },
  {
    id: "audiotoolslib",
    name: "arduino-audio-tools",
    include: "#include <AudioTools.h>",
    description: "High-level audio streaming, effects, and codec library for ESP32",
    category: "Audio",
    author: "Phil Schatzmann",
    url: "https://github.com/pschatzmann/arduino-audio-tools",
    boards: ["esp32"],
  },

  // ── Timing & Interrupts ────────────────────────────────────────────────────
  {
    id: "ticker",
    name: "Ticker",
    include: "#include <Ticker.h>",
    description: "Timer-based callback scheduling for ESP32/ESP8266",
    category: "Timing & Interrupts",
    author: "Espressif",
    boards: ["esp32", "esp8266"],
    initSnippet: "Ticker myTicker;\n// myTicker.attach(1.0, myCallback); // every 1 second",
  },
  {
    id: "timertool",
    name: "ESP32TimerInterrupt",
    include: "#include <ESP32TimerInterrupt.h>",
    description: "Precise hardware timer interrupts for ESP32",
    category: "Timing & Interrupts",
    author: "Khoi Hoang",
    url: "https://github.com/khoih-prog/ESP32TimerInterrupt",
    boards: ["esp32"],
  },

  // ── Math & Signal ──────────────────────────────────────────────────────────
  {
    id: "arduinofft",
    name: "ArduinoFFT",
    include: "#include <arduinoFFT.h>",
    description: "Fast Fourier Transform for signal processing on Arduino/ESP32",
    category: "Math & Signal",
    author: "Enrique Condes",
    url: "https://github.com/kosme/arduinoFFT",
    boards: ["esp32", "esp8266", "avr", "all"],
  },
  {
    id: "pid",
    name: "PID Library",
    include: "#include <PID_v1.h>",
    description: "PID controller implementation for closed-loop control systems",
    category: "Math & Signal",
    author: "Brett Beauregard",
    url: "https://github.com/br3ttb/Arduino-PID-Library",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "kalman-filter",
    name: "Kalman Filter Library",
    include: "#include <KalmanFilter.h>",
    description: "Simple 1D Kalman filter for sensor noise reduction",
    category: "Math & Signal",
    author: "TKJ Electronics",
    url: "https://github.com/TKJElectronics/KalmanFilter",
    boards: ["esp32", "esp8266", "avr", "all"],
  },

  // ── Utilities ──────────────────────────────────────────────────────────────
  {
    id: "taskscheduler",
    name: "TaskScheduler",
    include: "#include <TaskScheduler.h>",
    description: "Cooperative multitasking scheduler — run multiple tasks without RTOS",
    category: "Utilities",
    author: "Anatoli Arkhipenko",
    url: "https://github.com/arkhipenko/TaskScheduler",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
  },
  {
    id: "freertos",
    name: "FreeRTOS Tasks (ESP32)",
    include: "#include <freertos/FreeRTOS.h>",
    description: "ESP32 native FreeRTOS multi-core task management",
    category: "Utilities",
    author: "Espressif",
    boards: ["esp32"],
    extraIncludes: ["#include <freertos/task.h>"],
    initSnippet: 'xTaskCreatePinnedToCore(myTask, "TaskName", 10000, NULL, 1, NULL, 0);',
  },
  {
    id: "watchdog",
    name: "ESP Task Watchdog",
    include: "#include <esp_task_wdt.h>",
    description: "ESP32 task watchdog timer — reset board if task hangs",
    category: "Utilities",
    author: "Espressif",
    boards: ["esp32"],
    initSnippet: "esp_task_wdt_init(5, true); // 5-second timeout\nesp_task_wdt_add(NULL);    // Watch current task\n// In loop(): esp_task_wdt_reset();",
  },
  {
    id: "button-debounce",
    name: "Bounce2",
    include: "#include <Bounce2.h>",
    description: "Button debounce library — detect clean button presses/releases",
    category: "Utilities",
    author: "Thomas Ouellet Fredericks",
    url: "https://github.com/thomasfredericks/Bounce2",
    boards: ["esp32", "esp8266", "avr", "renesas", "all"],
    initSnippet: "Bounce2::Button btn;\n// In setup(): btn.attach(PIN, INPUT_PULLUP); btn.interval(25);\n// In loop(): btn.update(); if (btn.pressed()) { ... }",
  },
];

// ── Board compatibility helpers ───────────────────────────────────────────────

export function getLibrariesForBoard(boardPlatform: string, isAVR: boolean): ArduinoLibrary[] {
  const platformKey: BoardCompat = isAVR ? "avr" : (boardPlatform as BoardCompat);
  return BUILTIN_LIBRARIES.filter(
    (lib) => lib.boards.includes("all") || lib.boards.includes(platformKey)
  );
}

export function getAllCategories(): LibraryCategory[] {
  const cats = new Set(BUILTIN_LIBRARIES.map((l) => l.category));
  return Array.from(cats) as LibraryCategory[];
}

// ── Community library (GitHub URL) fetcher ────────────────────────────────────

export interface CommunityLibraryMeta {
  id: string;
  name: string;
  include: string;
  description: string;
  url: string;
  isCustom: true;
  category: LibraryCategory;
}

/**
 * Parse a GitHub URL and return a minimal library entry.
 * Supports:
 *   - https://github.com/user/repo
 *   - https://github.com/user/repo/tree/branch
 *   - https://raw.githubusercontent.com/...
 */
export function parseCommunityLibraryUrl(url: string): CommunityLibraryMeta | null {
  try {
    const u = new URL(url.trim());
    if (!["github.com", "raw.githubusercontent.com"].includes(u.hostname)) return null;

    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;

    const user = parts[0];
    const repo = parts[1];
    const repoName = repo.replace(/-/g, " ").replace(/(^|\s)\w/g, (c) => c.toUpperCase());
    const includeGuess = repo.replace(/-/g, "").replace(/arduino/i, "").replace(/library/i, "");

    return {
      id: `community-${user}-${repo}`,
      name: repoName,
      include: `#include <${includeGuess}.h>`,
      description: `Community library by ${user} — ${url}`,
      url: `https://github.com/${user}/${repo}`,
      isCustom: true,
      category: "Community",
    };
  } catch {
    return null;
  }
}
