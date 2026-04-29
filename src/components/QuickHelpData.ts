/** Quick Help documentation content — every block, toolbar item, and ML pipeline feature. */

export interface HelpBlock {
  type: string;
  label: string;
  desc: string;
  color: string;
  inputs?: string;
  output?: string;
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  intro: string;
  blocks?: HelpBlock[];
  content?: string;
}

export const HELP_SECTIONS: HelpSection[] = [
  // ─── TOOLBAR ───────────────────────────────
  {
    id: "toolbar",
    title: "Toolbar & Navigation",
    icon: "Layout",
    color: "#9D27DE",
    intro: "The top toolbar controls your project workflow — from saving to compiling to flashing firmware onto real hardware.",
    content: `**Board Selector** — Choose your target microcontroller (ESP32, Arduino Uno, etc.). This affects which libraries are available and how code is compiled.

**Save** — Manually save workspace to the cloud. Auto-save triggers every 3 seconds after changes.

**Connect Board** — Pair your physical board via WebSerial (Chrome/Edge only). Required for flashing and serial monitoring.

**Compile** — Sends generated C++ code to the cloud compiler. Takes 1-2 minutes. Produces a flashable firmware binary.

**Flash Device** — Writes compiled firmware to the connected board over USB. Supports ESP32 (esptool), AVR (STK500), and UF2 boards.

**Export to Marketplace** — Publishes your compiled project as a community-shared block configuration. Requires successful compilation first.

**Examples** — Browse and load 20 pre-built example projects covering GPIO, sensors, displays, communication, actuators, and networking.

**Workspace / ML Pipeline Toggle** — Switch between the visual block editor and the Machine Learning training pipeline.`
  },

  // ─── CORE: SETUP & LOOP ────────────────────
  {
    id: "core",
    title: "Setup & Loop",
    icon: "RefreshCw",
    color: "#9D27DE",
    intro: "Every Arduino program has two entry points: setup() runs once at boot, loop() runs forever. These hat blocks define your program structure.",
    blocks: [
      { type: "event_setup", label: "On Setup", desc: "Code inside runs once when the board powers on or resets. Use for pin modes, sensor initialization, WiFi connection.", color: "#9D27DE", inputs: "Statement body" },
      { type: "event_loop", label: "On Loop", desc: "Code inside runs repeatedly forever. This is your main execution cycle — read sensors, update outputs, check conditions.", color: "#9D27DE", inputs: "Statement body" },
    ]
  },

  // ─── GPIO ──────────────────────────────────
  {
    id: "gpio",
    title: "GPIO (Digital & Analog)",
    icon: "Cpu",
    color: "#E53E3E",
    intro: "General Purpose Input/Output — directly control pin voltages and read analog sensors at the hardware level.",
    blocks: [
      { type: "gpio_pin_mode", label: "Set Pin Mode", desc: "Configure a pin as INPUT, OUTPUT, or INPUT_PULLUP before reading or writing.", color: "#E53E3E", inputs: "PIN (number), MODE (dropdown)" },
      { type: "gpio_digital_write", label: "Digital Write", desc: "Set a pin HIGH (3.3V/5V) or LOW (0V). Controls LEDs, relays, transistors.", color: "#E53E3E", inputs: "PIN, VALUE (HIGH/LOW)" },
      { type: "gpio_digital_read", label: "Digital Read", desc: "Read a pin state (0 or 1). Use with buttons, switches, digital sensors.", color: "#E53E3E", inputs: "PIN", output: "Number (0/1)" },
      { type: "gpio_analog_read", label: "Analog Read", desc: "Read analog voltage via ADC. Returns 0-1023 (Arduino) or 0-4095 (ESP32).", color: "#E53E3E", inputs: "PIN", output: "Number" },
      { type: "gpio_analog_write", label: "Analog Write (PWM)", desc: "Output PWM signal. Simulates analog voltage for LED dimming, motor speed.", color: "#E53E3E", inputs: "PIN, VALUE (0-255)" },
      { type: "led_init", label: "Init LED", desc: "Sets pin as OUTPUT for LED control.", color: "#E53E3E", inputs: "PIN" },
      { type: "led_on", label: "LED On", desc: "Drives pin HIGH to turn on LED.", color: "#E53E3E", inputs: "PIN" },
      { type: "led_off", label: "LED Off", desc: "Drives pin LOW to turn off LED.", color: "#E53E3E", inputs: "PIN" },
      { type: "tone_async", label: "Play Tone", desc: "Generates square wave on a pin for buzzer/speaker.", color: "#E53E3E", inputs: "PIN, FREQ (Hz), DURATION (ms)" },
    ]
  },

  // ─── TIMING ────────────────────────────────
  {
    id: "timing",
    title: "Timing & Delays",
    icon: "Clock",
    color: "#D69E2E",
    intro: "Control execution timing. Blocking delays pause everything; millis() enables non-blocking timing patterns.",
    blocks: [
      { type: "timing_delay", label: "Delay (ms)", desc: "Pause execution for specified milliseconds. Blocks all code — use sparingly.", color: "#D69E2E", inputs: "MS (number)" },
      { type: "timing_delay_micro", label: "Delay (μs)", desc: "Microsecond-precision delay for timing-critical protocols.", color: "#D69E2E", inputs: "US (number)" },
      { type: "time_get_millis", label: "Millis", desc: "Returns milliseconds since boot. Use for non-blocking timing.", color: "#D69E2E", output: "Number" },
      { type: "time_get_micros", label: "Micros", desc: "Returns microseconds since boot. High-resolution timer.", color: "#D69E2E", output: "Number" },
      { type: "yield_block", label: "Yield", desc: "Gives CPU time to background tasks (WiFi, BLE on ESP32). Essential in tight loops.", color: "#D69E2E" },
    ]
  },

  // ─── SENSORS ───────────────────────────────
  {
    id: "sensors",
    title: "Sensors",
    icon: "Radar",
    color: "#38A169",
    intro: "Pre-configured drivers for popular sensor modules. Each Init block sets up the required library and communication protocol.",
    blocks: [
      { type: "dht11_init", label: "Init DHT11", desc: "Initialize DHT11 temp/humidity sensor (±2°C accuracy).", color: "#38A169", inputs: "PIN" },
      { type: "dht22_init", label: "Init DHT22", desc: "Initialize DHT22 temp/humidity sensor (±0.5°C accuracy).", color: "#38A169", inputs: "PIN" },
      { type: "dht_read_temp_c", label: "Read Temperature °C", desc: "Returns current temperature in Celsius from DHT sensor.", color: "#38A169", inputs: "PIN", output: "Number" },
      { type: "dht_read_humidity", label: "Read Humidity %", desc: "Returns relative humidity percentage.", color: "#38A169", inputs: "PIN", output: "Number" },
      { type: "hcsr04_init", label: "Init HC-SR04", desc: "Initialize ultrasonic distance sensor (2cm-400cm range).", color: "#38A169", inputs: "TRIG, ECHO" },
      { type: "hcsr04_read_cm", label: "Read Distance (cm)", desc: "Measures distance using ultrasonic pulse timing.", color: "#38A169", inputs: "TRIG", output: "Number" },
      { type: "bmp280_init", label: "Init BMP280", desc: "Initialize I2C barometric pressure/temperature/altitude sensor.", color: "#38A169" },
      { type: "bmp280_read_temp", label: "BMP280 Temperature", desc: "Read temperature from BMP280.", color: "#38A169", output: "Number" },
      { type: "bmp280_read_pressure", label: "BMP280 Pressure", desc: "Read atmospheric pressure (Pa).", color: "#38A169", output: "Number" },
      { type: "bmp280_read_alt", label: "BMP280 Altitude", desc: "Read estimated altitude (m).", color: "#38A169", output: "Number" },
      { type: "mpu6050_init", label: "Init MPU6050", desc: "Initialize 6-axis IMU (accelerometer + gyroscope) via I2C.", color: "#38A169" },
      { type: "mpu6050_read_acc_x", label: "Accel X", desc: "Read X-axis acceleration (m/s²).", color: "#38A169", output: "Number" },
      { type: "mpu6050_read_gyro_x", label: "Gyro X", desc: "Read X-axis rotation rate (rad/s).", color: "#38A169", output: "Number" },
      { type: "soil_moisture_analog", label: "Soil Moisture", desc: "Read analog soil moisture sensor value.", color: "#38A169", inputs: "PIN", output: "Number" },
      { type: "pir_motion_read", label: "PIR Motion", desc: "Returns true when motion is detected.", color: "#38A169", inputs: "PIN", output: "Boolean" },
      { type: "rfid_rc522_init", label: "Init RFID RC522", desc: "Initialize SPI-based RFID reader.", color: "#38A169", inputs: "SS, RST" },
      { type: "rfid_rc522_read_uid", label: "Read RFID UID", desc: "Returns scanned card UID as string.", color: "#38A169", output: "String" },
    ]
  },

  // ─── DISPLAY ───────────────────────────────
  {
    id: "display",
    title: "Display & LEDs",
    icon: "Lightbulb",
    color: "#3182CE",
    intro: "Control screens, LED strips, and visual output devices. Each display type requires initialization before use.",
    blocks: [
      { type: "oled_init", label: "Init OLED", desc: "Initialize SSD1306 128x64 OLED display over I2C.", color: "#3182CE" },
      { type: "oled_clear", label: "OLED Clear", desc: "Clear the display buffer.", color: "#3182CE" },
      { type: "oled_print_text", label: "OLED Print Text", desc: "Write text at X,Y position on OLED.", color: "#3182CE", inputs: "TEXT, X, Y" },
      { type: "oled_display", label: "OLED Display", desc: "Push buffer to screen. Call after print operations.", color: "#3182CE" },
      { type: "lcd_i2c_init", label: "Init LCD I2C", desc: "Initialize 16x2 I2C LCD display.", color: "#3182CE" },
      { type: "lcd_i2c_clear", label: "LCD Clear", desc: "Clear LCD screen.", color: "#3182CE" },
      { type: "lcd_i2c_set_cursor", label: "LCD Set Cursor", desc: "Move cursor to column/row position.", color: "#3182CE", inputs: "COL, ROW" },
      { type: "lcd_i2c_print", label: "LCD Print", desc: "Print text at current cursor position.", color: "#3182CE", inputs: "TEXT" },
      { type: "neopixel_init", label: "Init NeoPixels", desc: "Initialize WS2812B addressable LED strip.", color: "#3182CE", inputs: "PIN, COUNT" },
      { type: "neopixel_set_pixel", label: "Set Pixel Color", desc: "Set individual pixel RGB color.", color: "#3182CE", inputs: "INDEX, R, G, B" },
      { type: "neopixel_fill", label: "Fill All Pixels", desc: "Set all pixels to same RGB color.", color: "#3182CE", inputs: "R, G, B" },
      { type: "neopixel_show", label: "NeoPixel Show", desc: "Push color data to the LED strip.", color: "#3182CE" },
      { type: "neopixel_set_brightness", label: "Set Brightness", desc: "Set strip brightness (0-255).", color: "#3182CE", inputs: "VALUE" },
    ]
  },

  // ─── MOTORS ────────────────────────────────
  {
    id: "motors",
    title: "Motors & Actuators",
    icon: "Settings",
    color: "#E53E3E",
    intro: "Control servos, DC motors, steppers, relays, and other mechanical actuators.",
    blocks: [
      { type: "servo_init", label: "Init Servo", desc: "Attach servo to PWM pin.", color: "#DD6B20", inputs: "PIN" },
      { type: "servo_write_angle", label: "Servo Write Angle", desc: "Move servo to angle (0°-180°).", color: "#DD6B20", inputs: "PIN, ANGLE" },
      { type: "l298n_dc_init", label: "Init L298N DC Motor", desc: "Initialize L298N H-bridge motor driver.", color: "#DD6B20", inputs: "EN, IN1, IN2" },
      { type: "l298n_dc_forward", label: "Motor Forward", desc: "Set motor direction to forward.", color: "#DD6B20", inputs: "EN" },
      { type: "l298n_dc_set_speed", label: "Set Motor Speed", desc: "Set PWM speed (0-255).", color: "#DD6B20", inputs: "EN, SPEED" },
      { type: "l298n_dc_stop", label: "Motor Stop", desc: "Stop the motor.", color: "#DD6B20", inputs: "EN" },
      { type: "a4988_stepper_init", label: "Init A4988 Stepper", desc: "Initialize A4988 stepper driver.", color: "#DD6B20", inputs: "DIR, STEP, STEPS/REV" },
      { type: "a4988_stepper_step", label: "Step Motor", desc: "Move stepper by N steps (+forward, -backward).", color: "#DD6B20", inputs: "STEPS" },
      { type: "relay_init", label: "Init Relay", desc: "Set relay pin as output.", color: "#DD6B20", inputs: "PIN" },
      { type: "relay_on", label: "Relay ON", desc: "Energize relay coil (close circuit).", color: "#DD6B20", inputs: "PIN" },
      { type: "relay_off", label: "Relay OFF", desc: "De-energize relay (open circuit).", color: "#DD6B20", inputs: "PIN" },
    ]
  },

  // ─── COMMUNICATION ─────────────────────────
  {
    id: "communication",
    title: "Communication & Networking",
    icon: "Wifi",
    color: "#805AD5",
    intro: "WiFi, Bluetooth, MQTT, HTTP, BLE, and serial communication blocks for connected IoT projects.",
    blocks: [
      { type: "wifi_connect", label: "WiFi Connect", desc: "Connect to WiFi network. Blocks until connected.", color: "#805AD5", inputs: "SSID, PASSWORD" },
      { type: "wifi_get_ip", label: "Get IP Address", desc: "Returns device's local IP address as string.", color: "#805AD5", output: "String" },
      { type: "wifi_get_rssi", label: "Get WiFi RSSI", desc: "Returns signal strength in dBm.", color: "#805AD5", output: "Number" },
      { type: "mqtt_init", label: "Init MQTT", desc: "Initialize MQTT client (PubSubClient).", color: "#805AD5" },
      { type: "mqtt_set_server", label: "Set MQTT Server", desc: "Configure MQTT broker address and port.", color: "#805AD5", inputs: "SERVER, PORT" },
      { type: "mqtt_publish", label: "MQTT Publish", desc: "Publish message to a topic.", color: "#805AD5", inputs: "TOPIC, MESSAGE" },
      { type: "mqtt_subscribe", label: "MQTT Subscribe", desc: "Subscribe to a topic for incoming messages.", color: "#805AD5", inputs: "TOPIC" },
      { type: "http_get", label: "HTTP GET", desc: "Make an HTTP GET request and return response.", color: "#805AD5", inputs: "URL", output: "String" },
      { type: "bt_classic_init", label: "Init Bluetooth", desc: "Initialize Bluetooth Classic Serial (ESP32 only).", color: "#805AD5", inputs: "DEVICE NAME" },
      { type: "bt_classic_read", label: "BT Read", desc: "Read incoming Bluetooth serial data.", color: "#805AD5", output: "String" },
      { type: "bt_classic_print", label: "BT Print", desc: "Send data over Bluetooth serial.", color: "#805AD5", inputs: "MESSAGE" },
      { type: "ble_init", label: "Init BLE Server", desc: "Initialize BLE GATT server (ESP32).", color: "#805AD5", inputs: "DEVICE NAME" },
      { type: "ble_create_service", label: "Create BLE Service", desc: "Create and start a BLE service with UUID.", color: "#805AD5", inputs: "UUID" },
      { type: "ble_notify", label: "BLE Notify", desc: "Send notification to connected BLE clients.", color: "#805AD5", inputs: "MESSAGE" },
      { type: "serial_print", label: "Serial Print", desc: "Print data to USB serial monitor.", color: "#805AD5", inputs: "TEXT, MODE (print/println)" },
    ]
  },

  // ─── STORAGE ───────────────────────────────
  {
    id: "storage",
    title: "Storage & Memory",
    icon: "HardDrive",
    color: "#38B2AC",
    intro: "Read/write data to SD cards and EEPROM for data logging and persistent configuration.",
    blocks: [
      { type: "sd_init", label: "Init SD Card", desc: "Initialize SD card module on SPI bus.", color: "#38B2AC", inputs: "CS pin" },
      { type: "sd_append_file", label: "SD Append File", desc: "Append text content to a file on SD card.", color: "#38B2AC", inputs: "PATH, CONTENT" },
      { type: "sd_read_file", label: "SD Read File", desc: "Read entire file contents as string.", color: "#38B2AC", inputs: "PATH", output: "String" },
      { type: "eeprom_write", label: "EEPROM Write", desc: "Write a byte to persistent EEPROM memory.", color: "#38B2AC", inputs: "ADDRESS, VALUE" },
      { type: "eeprom_read", label: "EEPROM Read", desc: "Read a byte from EEPROM.", color: "#38B2AC", inputs: "ADDRESS", output: "Number" },
    ]
  },

  // ─── NAVIGATION ────────────────────────────
  {
    id: "navigation",
    title: "GPS & Navigation",
    icon: "MapPin",
    color: "#2B6CB0",
    intro: "GPS module support for location tracking with latitude, longitude, altitude, speed, and satellite info.",
    blocks: [
      { type: "gps_init", label: "Init GPS", desc: "Initialize NEO-6M GPS module on software serial.", color: "#2B6CB0", inputs: "RX, TX pins" },
      { type: "gps_has_fix", label: "GPS Has Fix?", desc: "Returns true when GPS has satellite lock.", color: "#2B6CB0", output: "Boolean" },
      { type: "gps_get_lat", label: "Get Latitude", desc: "Returns current latitude coordinate.", color: "#2B6CB0", output: "Number" },
      { type: "gps_get_lng", label: "Get Longitude", desc: "Returns current longitude coordinate.", color: "#2B6CB0", output: "Number" },
      { type: "gps_get_satellites", label: "Get Satellite Count", desc: "Number of satellites in view.", color: "#2B6CB0", output: "Number" },
    ]
  },

  // ─── ADVANCED COMM ─────────────────────────
  {
    id: "advanced_comm",
    title: "Advanced Protocols",
    icon: "Network",
    color: "#B94FF0",
    intro: "LoRa long-range radio, CAN bus, RS485 Modbus, and GSM cellular communication.",
    blocks: [
      { type: "lora_init", label: "Init LoRa", desc: "Initialize LoRa radio transceiver (SX1276/78).", color: "#B94FF0", inputs: "FREQ (MHz)" },
      { type: "lora_send", label: "LoRa Send", desc: "Transmit message over LoRa radio.", color: "#B94FF0", inputs: "MESSAGE" },
      { type: "lora_receive", label: "LoRa Receive", desc: "Read incoming LoRa message.", color: "#B94FF0", output: "String" },
      { type: "can_init", label: "Init CAN Bus", desc: "Initialize MCP2515 CAN controller.", color: "#B94FF0", inputs: "CS pin, SPEED" },
      { type: "can_send", label: "CAN Send", desc: "Send CAN frame with ID and data.", color: "#B94FF0", inputs: "ID, DATA" },
      { type: "gsm_init", label: "Init GSM", desc: "Initialize SIM800/SIM900 GSM module.", color: "#B94FF0", inputs: "RX, TX" },
      { type: "gsm_send_sms", label: "Send SMS", desc: "Send SMS text message via GSM.", color: "#B94FF0", inputs: "PHONE, MESSAGE" },
    ]
  },

  // ─── AUDIO ─────────────────────────────────
  {
    id: "audio",
    title: "Audio & Media",
    icon: "Volume2",
    color: "#E53E3E",
    intro: "DFPlayer MP3 module and I2S audio interface for sound playback and recording.",
    blocks: [
      { type: "dfplayer_init", label: "Init DFPlayer", desc: "Initialize DFPlayer Mini MP3 module.", color: "#C53030", inputs: "RX, TX" },
      { type: "dfplayer_play", label: "Play Track", desc: "Play MP3 file by track number.", color: "#C53030", inputs: "TRACK NUMBER" },
      { type: "dfplayer_volume", label: "Set Volume", desc: "Set playback volume (0-30).", color: "#C53030", inputs: "VOLUME" },
      { type: "i2s_init", label: "Init I2S Mic", desc: "Initialize I2S audio interface (ESP32).", color: "#C53030", inputs: "SCK, WS, SD pins" },
      { type: "i2s_read_sample", label: "I2S Read Sample", desc: "Read audio sample from I2S microphone.", color: "#C53030", output: "Number" },
    ]
  },

  // ─── ADVANCED CONTROL ──────────────────────
  {
    id: "advanced_control",
    title: "Advanced Control",
    icon: "Sliders",
    color: "#D69E2E",
    intro: "PID controllers, shift registers, and advanced motor control for precision applications.",
    blocks: [
      { type: "pid_init", label: "Init PID", desc: "Create PID controller with Kp, Ki, Kd gains.", color: "#D69E2E", inputs: "Kp, Ki, Kd" },
      { type: "pid_compute", label: "PID Compute", desc: "Calculate PID output from setpoint and current value.", color: "#D69E2E", inputs: "SETPOINT, INPUT", output: "Number" },
      { type: "shift_register_init", label: "Init Shift Register", desc: "Initialize 74HC595 shift register.", color: "#D69E2E", inputs: "DATA, CLOCK, LATCH" },
      { type: "shift_register_write", label: "Shift Out", desc: "Write byte to shift register outputs.", color: "#D69E2E", inputs: "VALUE (0-255)" },
    ]
  },

  // ─── INTERRUPTS & POWER ────────────────────
  {
    id: "system",
    title: "System & Power",
    icon: "Battery",
    color: "#718096",
    intro: "Hardware interrupts, deep sleep modes, and watchdog timer for power-efficient embedded applications.",
    blocks: [
      { type: "attach_interrupt", label: "Attach Interrupt", desc: "Register a hardware interrupt on a pin. Code runs when pin state changes.", color: "#718096", inputs: "PIN, MODE (RISING/FALLING/CHANGE), Handler" },
      { type: "deep_sleep_start", label: "Deep Sleep", desc: "Enter ultra-low-power deep sleep mode. Wakes via timer or GPIO.", color: "#718096", inputs: "Duration (μs)" },
      { type: "esp_restart", label: "Restart Board", desc: "Software reset the microcontroller.", color: "#718096" },
    ]
  },

  // ─── ML PIPELINE ───────────────────────────
  {
    id: "ml_pipeline",
    title: "ML Pipeline",
    icon: "BrainCircuit",
    color: "#2B6CB0",
    intro: "Train and deploy machine learning models directly on your microcontroller. The full pipeline runs: Collect Data → Train Model → Deploy to Board.",
    content: `**Data Collection Tab** — Record sensor data (IMU, audio, images) directly from your board via serial or camera. Label samples into classes for classification tasks.

**Training Tab** — Configure task type, model architecture, and hyperparameters. Training runs on cloud GPU infrastructure and typically takes 2-10 minutes.

**Task Types:**
• **Gesture Recognition** — Classify IMU motion patterns (wave, punch, idle). Uses 1D CNN on accelerometer/gyro data.
• **Keyword Spotting** — Detect spoken words from microphone audio. Uses DS-CNN (ARM reference architecture).
• **Sound Classification** — Classify environmental sounds. Uses 1D CNN on MFCC audio features.
• **Image Classification** — Classify camera images into categories. Uses MobileNetV1 with ImageNet transfer learning.
• **Object Detection** — Detect and locate objects in images. Uses FOMO centroid heatmaps.
• **Face Recognition** — Identify faces from camera. Uses MobileNetV2 transfer learning with embedding head.
• **Motion Anomaly** — Detect unusual motion patterns. Uses autoencoder reconstruction error.
• **Sensor Anomaly** — Detect unusual sensor readings. Uses autoencoder reconstruction error.

**Model Architectures:**
• **MobileNetV1 INT8** (450KB) — Image classification via transfer learning. Best for ESP32-S3 and ESP32-CAM.
• **MobileFaceNet-Nano** (250KB) — Face recognition with 64-dim embeddings. Runs at ~10 FPS on ESP32-CAM.
• **FOMO** (250KB) — Lightweight object detection with spatial heatmaps. No bounding boxes, just centroid locations.
• **1D CNN on MFCC** (60KB) — Audio classification. Fits all ESP32 boards.
• **DS-CNN** (90KB) — Depthwise separable CNN for keyword spotting. ARM reference design.
• **1D CNN on IMU** (30KB) — Gesture classification from accelerometer data. Very lightweight.
• **Autoencoder** (15KB) — Anomaly detection via reconstruction error.
• **Autoencoder Tiny** (5KB) — Ultra-small anomaly detector, fits Arduino R4 WiFi.

**Versions Tab** — View all trained model versions with accuracy metrics, confusion matrices, and per-class F1 scores. Set any version as the active deployment.

**Test Tab** — Run real-time inference testing against a trained model. Feed live sensor data and see predictions.

**Deployment** — After training, a TFLite Micro inference block appears in the workspace toolbox. Drag it into your program to run on-device ML inference. The model weights are compiled into a C header and embedded in firmware.`
  },

  // ─── SERIAL MONITOR ────────────────────────
  {
    id: "serial",
    title: "Serial Monitor",
    icon: "Terminal",
    color: "#38A169",
    intro: "The bottom panel's Serial tab shows real-time output from your board over USB.",
    content: `**Serial Print blocks** send text to the Serial Monitor at 115200 baud. Use println for line-terminated output, print for inline.

**Auto-scroll** keeps the latest output visible. Disable for reading historical logs.

**Compile logs** also appear here — error messages, flash progress, and WebSerial events are all streamed to this panel.`
  },

  // ─── CODE PANEL ────────────────────────────
  {
    id: "code_panel",
    title: "Code Preview",
    icon: "Code",
    color: "#38B2AC",
    intro: "The right panel shows the live-generated C++ code from your blocks.",
    content: `The code updates in real-time as you connect blocks. It shows the complete Arduino sketch including:

• **#include directives** — Libraries for sensors, displays, communication
• **Global variables** — Sensor objects, configuration constants
• **void setup()** — Initialization code (pin modes, Serial.begin, sensor.begin)
• **void loop()** — Main execution logic

This is the exact code sent to the cloud compiler. You can use it to verify your logic before compiling.`
  },
];
