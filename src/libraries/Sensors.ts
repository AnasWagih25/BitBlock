import { compiler } from "../compiler/assembler";

export function defineSensorBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // DHT Library
  Blockly.Blocks["sensor_dht_read"] = {
    init() {
      this.appendDummyInput()
          .appendField("Read DHT")
          .appendField(new Blockly.FieldDropdown([["Temperature", "readTemperature"], ["Humidity", "readHumidity"]]), "TYPE")
          .appendField("on pin")
          .appendField(new Blockly.FieldNumber(2), "PIN");
      this.setOutput(true, "Number");
      this.setColour("#E53E3E");
    }
  };

  // MPU6050
  Blockly.Blocks["sensor_mpu6050_read"] = {
    init() {
      this.appendDummyInput()
          .appendField("MPU6050")
          .appendField(new Blockly.FieldDropdown([["Acc X", "getAccX"], ["Acc Y", "getAccY"], ["Acc Z", "getAccZ"]]), "AXIS");
      this.setOutput(true, "Number");
      this.setColour("#E53E3E");
    }
  };

  if (generator) {
    generator.forBlock["sensor_dht_read"] = function(block: any, generator: any) {
      const pin = block.getFieldValue("PIN");
      const type = block.getFieldValue("TYPE");
      const id = `dht_${pin}`;
      
      compiler.addInclude(`#include <DHT.h>`);
      compiler.addGlobal(`DHT ${id}(${pin}, DHT11);`); // Assuming DHT11 default
      compiler.addSetup(`${id}.begin();`);
      
      return [`${id}.${type}()`, generator.ORDER_FUNCTION_CALL];
    };

    generator.forBlock["sensor_mpu6050_read"] = function(block: any, generator: any) {
      const axis = block.getFieldValue("AXIS");
      compiler.addInclude(`#include <Wire.h>`);
      compiler.addInclude(`#include <Adafruit_MPU6050.h>`);
      compiler.addInclude(`#include <Adafruit_Sensor.h>`);
      compiler.addGlobal(`Adafruit_MPU6050 mpu;`);
      compiler.addGlobal(`sensors_event_t a, g, temp;`);
      compiler.addSetup(`Wire.begin();`);
      compiler.addSetup(`mpu.begin();`);
      
      compiler.addLoop(`mpu.getEvent(&a, &g, &temp);`);
      
      const mapping: Record<string, string> = {
          "getAccX": "a.acceleration.x",
          "getAccY": "a.acceleration.y",
          "getAccZ": "a.acceleration.z",
      };

      return [mapping[axis], generator.ORDER_ATOMIC];
    };
  }
}

export function getSensorCategory() {
  return {
    kind: "category", name: "Sensors",
    contents: [
      { kind: "block", type: "sensor_dht_read" },
      { kind: "block", type: "sensor_mpu6050_read" },
    ]
  };
}
