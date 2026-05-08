import type { MLTask } from "./MLCapabilities";

export interface BoardConfig {
  id: string;
  name: string;
  flash: number; // in KB
  ram: number; // in KB
  psram: number; // in KB
  platform: string;
  fqbn: string;
  color: string;
  
  // Capabilities
  wifi: boolean;
  ble: boolean;
  camera: boolean;
  mlSupport: boolean;
  
  // ML Configuration
  maxModelSizeKb: number;
  supportedMLTasks: MLTask[];
  
  notes?: string;
  isAVR?: boolean;
}

export const BOARDS: BoardConfig[] = [
  {
    id: "esp32-wroom",
    name: "ESP32 WROOM-32",
    flash: 4096,
    ram: 320,
    psram: 0,
    platform: "esp32",
    fqbn: "esp32:esp32:esp32",
    color: "#E53E3E",
    wifi: true,
    ble: true,
    camera: false,
    mlSupport: true,
    maxModelSizeKb: 800,
    supportedMLTasks: ["gesture", "motion_anomaly", "keyword_spotting", "sound", "sensor_anomaly"]
  },
  {
    id: "esp32-s3",
    name: "ESP32-S3",
    flash: 8192,
    ram: 512,
    psram: 8192,
    platform: "esp32",
    fqbn: "esp32:esp32:esp32s3:CDCOnBoot=cdc",
    color: "#D69E2E",
    wifi: true,
    ble: true,
    camera: true,
    mlSupport: true,
    maxModelSizeKb: 3000,
    supportedMLTasks: ["gesture", "motion_anomaly", "keyword_spotting", "sound", "sensor_anomaly", "image_classification", "object_detection", "face_recognition"]
  },
  {
    id: "esp32-cam",
    name: "ESP32-CAM",
    flash: 4096,
    ram: 320,
    psram: 4096,
    platform: "esp32",
    fqbn: "esp32:esp32:esp32cam",
    color: "#F56565",
    wifi: true,
    ble: true,
    camera: true,
    mlSupport: true,
    maxModelSizeKb: 1500,
    supportedMLTasks: ["image_classification", "object_detection", "face_recognition", "motion_anomaly", "sensor_anomaly"],
    notes: "Requires FTDI adapter + GPIO 0 pulled LOW to flash."
  },
  {
    id: "esp8266",
    name: "ESP8266 NodeMCU",
    flash: 4096,
    ram: 80,
    psram: 0,
    platform: "esp8266",
    fqbn: "esp8266:esp8266:nodemcuv2",
    color: "#3182CE",
    wifi: true,
    ble: false,
    camera: false,
    mlSupport: false,
    maxModelSizeKb: 0,
    supportedMLTasks: []
  },
  {
    id: "esp32-c3",
    name: "ESP32-C3",
    flash: 4096,
    ram: 400,
    psram: 0,
    platform: "esp32",
    fqbn: "esp32:esp32:esp32c3:CDCOnBoot=cdc",
    color: "#38A169",
    wifi: true,
    ble: true,
    camera: false,
    mlSupport: true,
    maxModelSizeKb: 150,
    supportedMLTasks: ["sensor_anomaly", "motion_anomaly", "keyword_spotting", "gesture", "sound"]
  },
  {
    id: "arduino-uno-r3",
    name: "Arduino Uno R3",
    flash: 32,
    ram: 2,
    psram: 0,
    platform: "arduino",
    fqbn: "arduino:avr:uno",
    color: "#319795",
    wifi: false,
    ble: false,
    camera: false,
    mlSupport: false,
    maxModelSizeKb: 0,
    supportedMLTasks: [],
    isAVR: true,
    notes: "Code must use F() macro for strings. Limited RAM."
  },
  {
    id: "arduino-uno-r4-wifi",
    name: "Arduino Uno R4 WiFi",
    flash: 256,
    ram: 32,
    psram: 0,
    platform: "arduino",
    fqbn: "arduino:renesas_uno:unor4wifi",
    color: "#00979D",
    wifi: true,
    ble: false,
    camera: false,
    mlSupport: true,
    maxModelSizeKb: 40,
    supportedMLTasks: ["sensor_anomaly", "motion_anomaly"]
  },
  {
    id: "arduino-nano",
    name: "Arduino Nano",
    flash: 32,
    ram: 2,
    psram: 0,
    platform: "arduino",
    fqbn: "arduino:avr:nano",
    color: "#2C7A7B",
    wifi: false,
    ble: false,
    camera: false,
    mlSupport: false,
    maxModelSizeKb: 0,
    supportedMLTasks: [],
    isAVR: true,
    notes: "Code must use F() macro for strings. Limited RAM."
  },
  {
    id: "arduino-nano-esp32",
    name: "Arduino Nano ESP32",
    flash: 16384,
    ram: 512,
    psram: 0,
    platform: "esp32",
    fqbn: "arduino:esp32:nano_nora",
    color: "#6B46C1",
    wifi: true,
    ble: true,
    camera: false,
    mlSupport: true,
    maxModelSizeKb: 600,
    supportedMLTasks: ["gesture", "motion_anomaly", "keyword_spotting", "sound", "sensor_anomaly", "image_classification"]
  },
  {
    id: "arduino-mega-2560",
    name: "Arduino Mega 2560",
    flash: 256,
    ram: 8,
    psram: 0,
    platform: "arduino",
    fqbn: "arduino:avr:mega",
    color: "#005C5F",
    wifi: false,
    ble: false,
    camera: false,
    mlSupport: false,
    maxModelSizeKb: 0,
    supportedMLTasks: [],
    isAVR: true,
    notes: "Code must use F() macro for strings. Limited RAM."
  }
];

export function getBoardConfig(boardId: string): BoardConfig {
  return BOARDS.find((b) => b.id === boardId) || BOARDS[0];
}
