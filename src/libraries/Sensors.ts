import { compiler } from "../compiler/assembler";

export function defineSensorBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;
  const idSafe = (v: string) => String(v).replace(/[^a-zA-Z0-9_]/g, "_");

  const ensureHcsr04Helpers = () => {
    compiler.addGlobal(`
float hcsr04_read_cm_val(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000);
  if (dur == 0) return -1;
  return dur * 0.034f / 2.0f;
}`);
  };

  // -- DHT SENSORS (5) --
  Blockly.Blocks["dht11_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init DHT11 on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#E53E3E"); }
  };
  Blockly.Blocks["dht22_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init DHT22 on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#E53E3E"); }
  };
  Blockly.Blocks["dht_read_temp_c"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("DHT Temp °C pin"); this.setOutput(true, "Number"); this.setColour("#E53E3E"); }
  };
  Blockly.Blocks["dht_read_temp_f"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("DHT Temp °F pin"); this.setOutput(true, "Number"); this.setColour("#E53E3E"); }
  };
  Blockly.Blocks["dht_read_humidity"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("DHT Humidity % pin"); this.setOutput(true, "Number"); this.setColour("#E53E3E"); }
  };

  // -- HC-SR04 (3) --
  Blockly.Blocks["hcsr04_init"] = {
    init() { this.appendDummyInput().appendField("Init HC-SR04"); this.appendValueInput("TRIG").setCheck("Number").appendField("Trig pin"); this.appendValueInput("ECHO").setCheck("Number").appendField("Echo pin"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#DD6B20"); }
  };
  Blockly.Blocks["hcsr04_read_cm"] = {
    init() { this.appendValueInput("TRIG").setCheck("Number").appendField("HC-SR04 Read CM Trigger"); this.setOutput(true, "Number"); this.setColour("#DD6B20"); }
  };
  Blockly.Blocks["hcsr04_read_in"] = {
    init() { this.appendValueInput("TRIG").setCheck("Number").appendField("HC-SR04 Read Inches Trigger"); this.setOutput(true, "Number"); this.setColour("#DD6B20"); }
  };

  // -- BMP280 (4) --
  Blockly.Blocks["bmp280_init"] = {
    init() { this.appendDummyInput().appendField("Init BMP280 (I2C)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["bmp280_read_temp"] = {
    init() { this.appendDummyInput().appendField("BMP280 Temp °C"); this.setOutput(true, "Number"); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["bmp280_read_pressure"] = {
    init() { this.appendDummyInput().appendField("BMP280 Pressure (hPa)"); this.setOutput(true, "Number"); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["bmp280_read_alt"] = {
    init() { this.appendDummyInput().appendField("BMP280 Altitude (m)"); this.setOutput(true, "Number"); this.setColour("#D69E2E"); }
  };

  // -- GAS/MQ SENSORS (6) --
  Blockly.Blocks["mq2_gas_init"] = {
    init() { this.appendDummyInput().appendField("Init MQ2 (Smoke/Gas)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["mq3_alcohol_init"] = {
    init() { this.appendDummyInput().appendField("Init MQ3 (Alcohol)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["mq7_co_init"] = {
    init() { this.appendDummyInput().appendField("Init MQ7 (CO Gas)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["mq135_air_qual_init"] = {
    init() { this.appendDummyInput().appendField("Init MQ135 (Air Quality)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#319795"); }
  };
  Blockly.Blocks["mq_sensor_read_analog"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read MQ Sensor Analog pin"); this.setOutput(true, "Number"); this.setColour("#319795"); }
  };
  Blockly.Blocks["mq_sensor_read_digital"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read MQ Sensor Digital pin"); this.setOutput(true, "Boolean"); this.setColour("#319795"); }
  };

  // -- MISC ANALOG / DIGITAL (5) --
  Blockly.Blocks["pir_motion_read"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read PIR Motion pin"); this.setOutput(true, "Boolean"); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["ldr_light_read"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read LDR Light Analog pin"); this.setOutput(true, "Number"); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["soil_moisture_analog"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read Soil Moisture Analog pin"); this.setOutput(true, "Number"); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["water_level_analog"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read Water Level Analog pin"); this.setOutput(true, "Number"); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["sound_mic_analog"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read Mic Envelope Analog pin"); this.setOutput(true, "Number"); this.setColour("#3182CE"); }
  };

  // -- MAX30102 (3) --
  Blockly.Blocks["max30102_hr_init"] = {
    init() { this.appendDummyInput().appendField("Init MAX30102 (Pulse Oxi I2C)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#805AD5"); }
  };
  Blockly.Blocks["max30102_read_red"] = {
    init() { this.appendDummyInput().appendField("MAX30102 Read RED value"); this.setOutput(true, "Number"); this.setColour("#805AD5"); }
  };
  Blockly.Blocks["max30102_read_ir"] = {
    init() { this.appendDummyInput().appendField("MAX30102 Read IR value"); this.setOutput(true, "Number"); this.setColour("#805AD5"); }
  };

  // -- MPU6050 (7) --
  Blockly.Blocks["mpu6050_init"] = {
    init() { this.appendDummyInput().appendField("Init MPU6050 (I2C)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D53F8C"); }
  };
  Blockly.Blocks["mpu6050_read_acc_x"] = {
    init() { this.appendDummyInput().appendField("MPU6050 Acc X"); this.setOutput(true, "Number"); this.setColour("#D53F8C"); }
  };
  Blockly.Blocks["mpu6050_read_acc_y"] = {
    init() { this.appendDummyInput().appendField("MPU6050 Acc Y"); this.setOutput(true, "Number"); this.setColour("#D53F8C"); }
  };
  Blockly.Blocks["mpu6050_read_acc_z"] = {
    init() { this.appendDummyInput().appendField("MPU6050 Acc Z"); this.setOutput(true, "Number"); this.setColour("#D53F8C"); }
  };
  Blockly.Blocks["mpu6050_read_gyro_x"] = {
    init() { this.appendDummyInput().appendField("MPU6050 Gyro X"); this.setOutput(true, "Number"); this.setColour("#D53F8C"); }
  };
  Blockly.Blocks["mpu6050_read_gyro_y"] = {
    init() { this.appendDummyInput().appendField("MPU6050 Gyro Y"); this.setOutput(true, "Number"); this.setColour("#D53F8C"); }
  };
  Blockly.Blocks["mpu6050_read_gyro_z"] = {
    init() { this.appendDummyInput().appendField("MPU6050 Gyro Z"); this.setOutput(true, "Number"); this.setColour("#D53F8C"); }
  };

  // -- VL53L0X (2) --
  Blockly.Blocks["vl53l0x_tof_init"] = {
    init() { this.appendDummyInput().appendField("Init VL53L0X ToF (I2C)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#E53E3E"); }
  };
  Blockly.Blocks["vl53l0x_tof_read_mm"] = {
    init() { this.appendDummyInput().appendField("VL53L0X Read Distance (mm)"); this.setOutput(true, "Number"); this.setColour("#E53E3E"); }
  };

  // -- RFID RC522 (2) --
  Blockly.Blocks["rfid_rc522_init"] = {
    init() { this.appendValueInput("SS").setCheck("Number").appendField("Init RFID RC522 SPI, SS pin"); this.appendValueInput("RST").setCheck("Number").appendField("RST pin"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#4A5568"); }
  };
  Blockly.Blocks["rfid_rc522_read_uid"] = {
    init() { this.appendDummyInput().appendField("RFID RC522 Read UID String"); this.setOutput(true, "String"); this.setColour("#4A5568"); }
  };

  // -- DS18B20 (3) --
  Blockly.Blocks["ds18b20_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init DS18B20 on OneWire pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C7A7B"); }
  };
  Blockly.Blocks["ds18b20_request_temp"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("DS18B20 Request Temp pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2C7A7B"); }
  };
  Blockly.Blocks["ds18b20_read_temp_c"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("DS18B20 Get Temp °C pin"); this.setOutput(true, "Number"); this.setColour("#2C7A7B"); }
  };

  // -- LOAD CELL (HX711) (3) --
  Blockly.Blocks["hx711_init"] = {
    init() { this.appendDummyInput().appendField("Init HX711 Load Cell"); this.appendValueInput("DT").setCheck("Number").appendField("DT Pin"); this.appendValueInput("SCK").setCheck("Number").appendField("SCK Pin"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#9C4221"); }
  };
  Blockly.Blocks["hx711_tare"] = {
    init() { this.appendDummyInput().appendField("HX711 Tare (Zero Scale)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#9C4221"); }
  };
  Blockly.Blocks["hx711_get_units"] = {
    init() { this.appendDummyInput().appendField("HX711 Get Weight Units"); this.setOutput(true, "Number"); this.setColour("#9C4221"); }
  };

  // -- TDS / WATER QUALITY (3) --
  Blockly.Blocks["tds_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init Gravity TDS on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#2B6CB0"); }
  };
  Blockly.Blocks["tds_read_ppm"] = {
    init() { this.appendValueInput("TEMP").setCheck("Number").appendField("Read TDS PPM with Temp °C"); this.setOutput(true, "Number"); this.setColour("#2B6CB0"); }
  };

  // -- HEART RATE & ECG (AD8232) (2) --
  Blockly.Blocks["ad8232_ecg_read"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read ECG AD8232 Analog pin"); this.setOutput(true, "Number"); this.setColour("#E53E3E"); }
  };
  Blockly.Blocks["pulse_sensor_read"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read Pulse Sen Analog pin"); this.setOutput(true, "Number"); this.setColour("#E53E3E"); }
  };

  // -- SOIL NPK (MODBUS RTU RS485 SENSORS) (3) --
  Blockly.Blocks["npk_init"] = {
    init() { this.appendDummyInput().appendField("Init Soil NPK Sensor (RS485)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#744210"); }
  };
  Blockly.Blocks["npk_read_nitrogen"] = {
    init() { this.appendDummyInput().appendField("NPK Read Nitrogen (mg/kg)"); this.setOutput(true, "Number"); this.setColour("#744210"); }
  };
  Blockly.Blocks["npk_read_ph"] = {
    init() { this.appendDummyInput().appendField("NPK Read Soil pH"); this.setOutput(true, "Number"); this.setColour("#744210"); }
  };


  if (generator) {
    // DHT11/22
    generator.forBlock["dht11_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      compiler.addInclude(`#include <DHT.h>`);
      compiler.addGlobal(`DHT dht_${pinId}(${pin}, DHT11);`);
      compiler.addSetup(`dht_${pinId}.begin();`);
      return "";
    };
    generator.forBlock["dht22_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      compiler.addInclude(`#include <DHT.h>`);
      compiler.addGlobal(`DHT dht_${pinId}(${pin}, DHT22);`);
      compiler.addSetup(`dht_${pinId}.begin();`);
      return "";
    };
    generator.forBlock["dht_read_temp_c"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      return [`dht_${pinId}.readTemperature(false)`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["dht_read_temp_f"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      return [`dht_${pinId}.readTemperature(true)`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["dht_read_humidity"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      return [`dht_${pinId}.readHumidity()`, generator.ORDER_FUNCTION_CALL];
    };

    // HCSR04
    generator.forBlock["hcsr04_init"] = function(block: any, generator: any) {
      const trig = generator.valueToCode(block, 'TRIG', generator.ORDER_ATOMIC) || '0';
      const echo = generator.valueToCode(block, 'ECHO', generator.ORDER_ATOMIC) || '0';
      const trigId = idSafe(trig);
      compiler.addSetup(`pinMode(${trig}, OUTPUT);\npinMode(${echo}, INPUT);`);
      compiler.addGlobal(`int hcsr04_echo_${trigId} = ${echo};`);
      ensureHcsr04Helpers();
      return "";
    };
    generator.forBlock["hcsr04_read_cm"] = function(block: any, generator: any) {
      const trig = generator.valueToCode(block, 'TRIG', generator.ORDER_ATOMIC) || '0';
      const trigId = idSafe(trig);
      ensureHcsr04Helpers();
      return [`hcsr04_read_cm_val(${trig}, hcsr04_echo_${trigId})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["hcsr04_read_in"] = function(block: any, generator: any) {
       const trig = generator.valueToCode(block, 'TRIG', generator.ORDER_ATOMIC) || '0';
       const trigId = idSafe(trig);
       ensureHcsr04Helpers();
       return [`hcsr04_read_cm_val(${trig}, hcsr04_echo_${trigId}) * 0.393701f`, generator.ORDER_FUNCTION_CALL];
    };

    // BMP280
    generator.forBlock["bmp280_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include <Adafruit_Sensor.h>\n#include <Adafruit_BMP280.h>`);
      compiler.addGlobal(`Adafruit_BMP280 bmp;`);
      compiler.addSetup(`if (!bmp.begin(0x76)) { Serial.println(F("BMP280 not found")); }`);
      return "";
    };
    generator.forBlock["bmp280_read_temp"] = function() {
      return [`bmp.readTemperature()`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["bmp280_read_pressure"] = function() {
      return [`(bmp.readPressure() / 100.0F)`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["bmp280_read_alt"] = function() {
      return [`bmp.readAltitude(1013.25)`, generator.ORDER_FUNCTION_CALL]; // using standard sea level hPa
    };

    // MQ SENSORS
    // The init blocks don't need active code if just analog, but serve for code clarity
    generator.forBlock["mq2_gas_init"] = function() { return `// MQ2 setup\n`; };
    generator.forBlock["mq3_alcohol_init"] = function() { return `// MQ3 setup\n`; };
    generator.forBlock["mq7_co_init"] = function() { return `// MQ7 setup\n`; };
    generator.forBlock["mq135_air_qual_init"] = function() { return `// MQ135 setup\n`; };

    generator.forBlock["mq_sensor_read_analog"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["mq_sensor_read_digital"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, INPUT);`);
      return [`digitalRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };

    // MISC
    generator.forBlock["pir_motion_read"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, INPUT);`);
      return [`(digitalRead(${pin}) == HIGH)`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["ldr_light_read"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["soil_moisture_analog"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["water_level_analog"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["sound_mic_analog"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };

    // MAX30102
    generator.forBlock["max30102_hr_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include "MAX30105.h"`);
      compiler.addGlobal(`MAX30105 particleSensor;`);
      compiler.addSetup(`if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) { Serial.println("MAX30102 not found"); }\nparticleSensor.setup();`);
      return "";
    };
    generator.forBlock["max30102_read_red"] = function() {
      return [`particleSensor.getRed()`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["max30102_read_ir"] = function() {
      return [`particleSensor.getIR()`, generator.ORDER_FUNCTION_CALL];
    };

    // MPU6050
    generator.forBlock["mpu6050_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include <Adafruit_MPU6050.h>\n#include <Adafruit_Sensor.h>`);
      compiler.addGlobal(`Adafruit_MPU6050 mpu;`);
      compiler.addSetup(`if (!mpu.begin()) { Serial.println("MPU6050 not found"); }`);
      compiler.addGlobal(`
float readMPUDirect(String t) {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  if(t=="ax") return a.acceleration.x;
  if(t=="ay") return a.acceleration.y;
  if(t=="az") return a.acceleration.z;
  if(t=="gx") return g.gyro.x;
  if(t=="gy") return g.gyro.y;
  if(t=="gz") return g.gyro.z;
  return 0;
}`);
      return "";
    };
    generator.forBlock["mpu6050_read_acc_x"] = function() { return [`readMPUDirect("ax")`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["mpu6050_read_acc_y"] = function() { return [`readMPUDirect("ay")`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["mpu6050_read_acc_z"] = function() { return [`readMPUDirect("az")`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["mpu6050_read_gyro_x"] = function() { return [`readMPUDirect("gx")`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["mpu6050_read_gyro_y"] = function() { return [`readMPUDirect("gy")`, generator.ORDER_FUNCTION_CALL]; };
    generator.forBlock["mpu6050_read_gyro_z"] = function() { return [`readMPUDirect("gz")`, generator.ORDER_FUNCTION_CALL]; };

    // VL53L0X
    generator.forBlock["vl53l0x_tof_init"] = function() {
      compiler.addInclude(`#include <Adafruit_VL53L0X.h>`);
      compiler.addGlobal(`Adafruit_VL53L0X lox = Adafruit_VL53L0X();`);
      compiler.addSetup(`if (!lox.begin()) { Serial.println("VL53L0X not found"); }`);
      compiler.addGlobal(`
int readToF() {
  VL53L0X_RangingMeasurementData_t measure;
  lox.rangingTest(&measure, false);
  if (measure.RangeStatus != 4) return measure.RangeMilliMeter;
  return -1;
}`);
      return "";
    };
    generator.forBlock["vl53l0x_tof_read_mm"] = function() {
      return [`readToF()`, generator.ORDER_FUNCTION_CALL];
    };

    // RFID
    generator.forBlock["rfid_rc522_init"] = function(block: any, generator: any) {
      const ss = generator.valueToCode(block, 'SS', generator.ORDER_ATOMIC) || '10';
      const rst = generator.valueToCode(block, 'RST', generator.ORDER_ATOMIC) || '9';
      compiler.addInclude(`#include <SPI.h>\n#include <MFRC522.h>`);
      compiler.addGlobal(`MFRC522 mfrc522(${ss}, ${rst});`);
      compiler.addSetup(`SPI.begin();\nmfrc522.PCD_Init();`);
      compiler.addGlobal(`
String readRFIDCard() {
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) return "";
  String content= "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
     content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " "));
     content.concat(String(mfrc522.uid.uidByte[i], HEX));
  }
  content.toUpperCase();
  mfrc522.PICC_HaltA();
  return content.substring(1);
}`);
      return "";
    };
    generator.forBlock["rfid_rc522_read_uid"] = function() {
      return [`readRFIDCard()`, generator.ORDER_FUNCTION_CALL];
    };

    // DS18B20
    generator.forBlock["ds18b20_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      compiler.addInclude(`#include <OneWire.h>\n#include <DallasTemperature.h>`);
      compiler.addGlobal(`OneWire oneWire_${pinId}(${pin});\nDallasTemperature ds_${pinId}(&oneWire_${pinId});`);
      compiler.addSetup(`ds_${pinId}.begin();`);
      return "";
    };
    generator.forBlock["ds18b20_request_temp"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      return `ds_${pinId}.requestTemperatures();\n`;
    };
    generator.forBlock["ds18b20_read_temp_c"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '2';
      const pinId = idSafe(pin);
      return [`ds_${pinId}.getTempCByIndex(0)`, generator.ORDER_FUNCTION_CALL];
    };

    // HX711
    generator.forBlock["hx711_init"] = function(block: any, generator: any) {
      const dt = generator.valueToCode(block, 'DT', generator.ORDER_ATOMIC) || '4';
      const sck = generator.valueToCode(block, 'SCK', generator.ORDER_ATOMIC) || '5';
      compiler.addInclude(`#include "HX711.h"`);
      compiler.addGlobal(`HX711 scale;`);
      compiler.addSetup(`scale.begin(${dt}, ${sck});\nscale.set_scale(2280.f); // calibration factor\nscale.tare();`);
      return "";
    };
    generator.forBlock["hx711_tare"] = function() {
      return `scale.tare();\n`;
    };
    generator.forBlock["hx711_get_units"] = function() {
      return [`scale.get_units(10)`, generator.ORDER_FUNCTION_CALL];
    };

    // TDS
    generator.forBlock["tds_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      const pinId = idSafe(pin);
      compiler.addInclude(`#include <GravityTDS.h>`);
      compiler.addGlobal(`GravityTDS gravityTds_${pinId};`);
      compiler.addGlobal(`GravityTDS* gravityTdsDefault = nullptr;`);
      compiler.addSetup(`gravityTds_${pinId}.setPin(${pin});\ngravityTds_${pinId}.setAref(3.3);\ngravityTds_${pinId}.setAdcRange(4096);\ngravityTds_${pinId}.begin();\ngravityTdsDefault = &gravityTds_${pinId};`);
      return "";
    };
    generator.forBlock["tds_read_ppm"] = function(block: any, generator: any) {
      const temp = generator.valueToCode(block, 'TEMP', generator.ORDER_ATOMIC) || '25.0';
      return [`(gravityTdsDefault ? (gravityTdsDefault->setTemperature(${temp}), gravityTdsDefault->update(), gravityTdsDefault->getTdsValue()) : 0.0f)`, generator.ORDER_FUNCTION_CALL];
    };

    // ECG & Pulse
    generator.forBlock["ad8232_ecg_read"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["pulse_sensor_read"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || 'A0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };

    // NPK
    generator.forBlock["npk_init"] = function() {
      return `// Init advanced NPK polling logic\n`;
    };
    generator.forBlock["npk_read_nitrogen"] = function() {
      return [`0`, generator.ORDER_FUNCTION_CALL]; // Placeholder for modbus struct read
    };
    generator.forBlock["npk_read_ph"] = function() {
      return [`7.0`, generator.ORDER_FUNCTION_CALL]; 
    };
  }
}

export function getSensorCategory() {
  return {
    kind: "category", name: "Sensors & Inputs",
    contents: [
      { kind: "label", text: "DHT Sensors" },
      { kind: "block", type: "dht11_init" },
      { kind: "block", type: "dht22_init" },
      { kind: "block", type: "dht_read_temp_c" },
      { kind: "block", type: "dht_read_temp_f" },
      { kind: "block", type: "dht_read_humidity" },
      { kind: "label", text: "Proximity & Motion" },
      { kind: "block", type: "hcsr04_init" },
      { kind: "block", type: "hcsr04_read_cm" },
      { kind: "block", type: "hcsr04_read_in" },
      { kind: "block", type: "pir_motion_read" },
      { kind: "block", type: "vl53l0x_tof_init" },
      { kind: "block", type: "vl53l0x_tof_read_mm" },
      { kind: "label", text: "Environment (BMP/Gas)" },
      { kind: "block", type: "bmp280_init" },
      { kind: "block", type: "bmp280_read_temp" },
      { kind: "block", type: "bmp280_read_pressure" },
      { kind: "block", type: "bmp280_read_alt" },
      { kind: "block", type: "mq2_gas_init" },
      { kind: "block", type: "mq3_alcohol_init" },
      { kind: "block", type: "mq7_co_init" },
      { kind: "block", type: "mq135_air_qual_init" },
      { kind: "block", type: "mq_sensor_read_analog" },
      { kind: "block", type: "mq_sensor_read_digital" },
      { kind: "label", text: "Misc Analog" },
      { kind: "block", type: "ldr_light_read" },
      { kind: "block", type: "soil_moisture_analog" },
      { kind: "block", type: "water_level_analog" },
      { kind: "block", type: "sound_mic_analog" },
      { kind: "label", text: "Biometric & Accel" },
      { kind: "block", type: "max30102_hr_init" },
      { kind: "block", type: "max30102_read_red" },
      { kind: "block", type: "max30102_read_ir" },
      { kind: "block", type: "mpu6050_init" },
      { kind: "block", type: "mpu6050_read_acc_x" },
      { kind: "block", type: "mpu6050_read_acc_y" },
      { kind: "block", type: "mpu6050_read_acc_z" },
      { kind: "block", type: "mpu6050_read_gyro_x" },
      { kind: "block", type: "mpu6050_read_gyro_y" },
      { kind: "block", type: "mpu6050_read_gyro_z" },
      { kind: "label", text: "Sensors & Ident" },
      { kind: "block", type: "rfid_rc522_init" },
      { kind: "block", type: "rfid_rc522_read_uid" },
      { kind: "block", type: "ds18b20_init" },
      { kind: "block", type: "ds18b20_request_temp" },
      { kind: "block", type: "ds18b20_read_temp_c" },
      { kind: "label", text: "Agri & Medical" },
      { kind: "block", type: "hx711_init" },
      { kind: "block", type: "hx711_tare" },
      { kind: "block", type: "hx711_get_units" },
      { kind: "block", type: "tds_init" },
      { kind: "block", type: "tds_read_ppm" },
      { kind: "block", type: "ad8232_ecg_read" },
      { kind: "block", type: "pulse_sensor_read" },
      { kind: "block", type: "npk_init" },
      { kind: "block", type: "npk_read_nitrogen" },
      { kind: "block", type: "npk_read_ph" },
    ]
  };
}
