import { compiler } from "../compiler/assembler";
import { javascriptGenerator } from "blockly/javascript";
import { getBoardConfig } from "../boards/registry";

export function defineNavigationBlocks(Blockly: any) {
  const generator = javascriptGenerator as any;

  // ─── GPS (NEO-6M) ────────────────────────────────────────────────────────
  Blockly.Blocks["gps_init"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Init (NEO-6M)");
      this.appendDummyInput().appendField("RX").appendField(new Blockly.FieldTextInput("4"), "RX").appendField("TX").appendField(new Blockly.FieldTextInput("3"), "TX");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#2C7A7B");
      this.setTooltip("Init Neo-6M GPS Module");
    },
  };
  if (generator) {
    generator.forBlock["gps_init"] = function (block: any) {
      const rx = block.getFieldValue("RX");
      const tx = block.getFieldValue("TX");
      // @ts-ignore
      const bd = getBoardConfig(compiler.boardId);
      compiler.addInclude("#include <TinyGPS++.h>");
      compiler.addGlobal(`TinyGPSPlus gps;`);
      if (bd.platform === "esp32") {
        compiler.addGlobal(`HardwareSerial gpsSerial(2);`);
        compiler.addSetup(`gpsSerial.begin(9600, SERIAL_8N1, ${rx}, ${tx});`);
      } else {
        compiler.addInclude("#include <SoftwareSerial.h>");
        compiler.addGlobal(`SoftwareSerial gpsSerial(${rx}, ${tx});`);
        compiler.addSetup(`gpsSerial.begin(9600);`);
      }
      compiler.addLoop(`while (gpsSerial.available() > 0) { gps.encode(gpsSerial.read()); }`);
      return "";
    };
  }

  Blockly.Blocks["gps_has_fix"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Has Location Fix?");
      this.setOutput(true, "Boolean");
      this.setColour("#2C7A7B");
    },
  };
  if (generator) {
    generator.forBlock["gps_has_fix"] = function () {
      return ["gps.location.isValid()", 0];
    };
  }

  Blockly.Blocks["gps_get_lat"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Latitude");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
    },
  };
  if (generator) {
    generator.forBlock["gps_get_lat"] = function () {
      return ["gps.location.lat()", 0];
    };
  }

  Blockly.Blocks["gps_get_lng"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Longitude");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
    },
  };
  if (generator) {
    generator.forBlock["gps_get_lng"] = function () {
      return ["gps.location.lng()", 0];
    };
  }

  Blockly.Blocks["gps_get_alt"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Altitude (m)");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
    },
  };
  if (generator) {
    generator.forBlock["gps_get_alt"] = function () {
      return ["gps.altitude.meters()", 0];
    };
  }

  Blockly.Blocks["gps_get_speed"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Speed (kmph)");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
    },
  };
  if (generator) {
    generator.forBlock["gps_get_speed"] = function () {
      return ["gps.speed.kmph()", 0];
    };
  }

  Blockly.Blocks["gps_get_satellites"] = {
    init: function () {
      this.appendDummyInput().appendField("GPS Satellites Connected");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
    },
  };
  if (generator) {
    generator.forBlock["gps_get_satellites"] = function () {
      return ["gps.satellites.value()", 0];
    };
  }

  // ─── Advanced IMU (MPU9250 9-DOF) ─────────────────────────────────────────
  Blockly.Blocks["mpu9250_init"] = {
    init: function () {
      this.appendDummyInput().appendField("MPU9250 Init (9-DOF I2C)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#2B6CB0");
    },
  };
  if (generator) {
    generator.forBlock["mpu9250_init"] = function () {
      compiler.addInclude("#include <Wire.h>");
      compiler.addInclude("#include <MPU9250_WE.h>");
      compiler.addGlobal(`MPU9250_WE myMPU9250(0x68);`);
      compiler.addSetup(`Wire.begin();`);
      compiler.addSetup(`if (!myMPU9250.init()) { Serial.println("MPU9250 init failed"); }`);
      compiler.addGlobal(`
xyzFloat getMpu9250Mag() {
  return myMPU9250.getMagValues();
}`);
      return "";
    };
  }

  Blockly.Blocks["mpu9250_get_pitch"] = {
    init: function () {
      this.appendDummyInput().appendField("MPU9250 Get Pitch");
      this.setOutput(true, "Number");
      this.setColour("#2B6CB0");
    },
  };
  if (generator) {
    generator.forBlock["mpu9250_get_pitch"] = function () {
      return ["myMPU9250.getPitch()", 0];
    };
  }

  Blockly.Blocks["mpu9250_get_roll"] = {
    init: function () {
      this.appendDummyInput().appendField("MPU9250 Get Roll");
      this.setOutput(true, "Number");
      this.setColour("#2B6CB0");
    },
  };
  if (generator) {
    generator.forBlock["mpu9250_get_roll"] = function () {
      return ["myMPU9250.getRoll()", 0];
    };
  }

  Blockly.Blocks["mpu9250_get_yaw"] = {
    init: function () {
      this.appendDummyInput().appendField("MPU9250 Get Yaw (Mag)");
      this.setOutput(true, "Number");
      this.setColour("#2B6CB0");
    },
  };
  if (generator) {
    generator.forBlock["mpu9250_get_yaw"] = function () {
      return ["myMPU9250.getYaw()", 0]; // Note conceptually yaw might need mag fusion library
    };
  }

  Blockly.Blocks["mpu9250_get_mag_x"] = {
    init: function () {
      this.appendDummyInput().appendField("MPU9250 Get Magnetometer X");
      this.setOutput(true, "Number");
      this.setColour("#2B6CB0");
    },
  };
  if (generator) {
    generator.forBlock["mpu9250_get_mag_x"] = function () {
      return ["getMpu9250Mag().x", 0];
    };
  }

  // ─── Location Math ───────────────────────────────────────────────────────
  Blockly.Blocks["gps_distance_between"] = {
    init: function () {
      this.appendValueInput("LAT1").setCheck("Number").appendField("Distance between Lat1");
      this.appendValueInput("LNG1").setCheck("Number").appendField("Lng1");
      this.appendValueInput("LAT2").setCheck("Number").appendField("and Lat2");
      this.appendValueInput("LNG2").setCheck("Number").appendField("Lng2 (m)");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
      this.setInputsInline(false);
    },
  };
  if (generator) {
    generator.forBlock["gps_distance_between"] = function (block: any) {
      let lat1 = generator.valueToCode(block, "LAT1", 0) || "0";
      let lng1 = generator.valueToCode(block, "LNG1", 0) || "0";
      let lat2 = generator.valueToCode(block, "LAT2", 0) || "0";
      let lng2 = generator.valueToCode(block, "LNG2", 0) || "0";
      lat1 = compiler.emitValue(lat1, 'float');
      lng1 = compiler.emitValue(lng1, 'float');
      lat2 = compiler.emitValue(lat2, 'float');
      lng2 = compiler.emitValue(lng2, 'float');
      compiler.addInclude("#include <TinyGPS++.h>");
      return [`TinyGPSPlus::distanceBetween(${lat1}, ${lng1}, ${lat2}, ${lng2})`, 0];
    };
  }

  Blockly.Blocks["gps_course_to"] = {
    init: function () {
      this.appendValueInput("LAT1").setCheck("Number").appendField("Course angle from Lat1");
      this.appendValueInput("LNG1").setCheck("Number").appendField("Lng1");
      this.appendValueInput("LAT2").setCheck("Number").appendField("to Lat2");
      this.appendValueInput("LNG2").setCheck("Number").appendField("Lng2 (deg)");
      this.setOutput(true, "Number");
      this.setColour("#2C7A7B");
      this.setInputsInline(false);
    },
  };
  if (generator) {
    generator.forBlock["gps_course_to"] = function (block: any) {
      let lat1 = generator.valueToCode(block, "LAT1", 0) || "0";
      let lng1 = generator.valueToCode(block, "LNG1", 0) || "0";
      let lat2 = generator.valueToCode(block, "LAT2", 0) || "0";
      let lng2 = generator.valueToCode(block, "LNG2", 0) || "0";
      lat1 = compiler.emitValue(lat1, 'float');
      lng1 = compiler.emitValue(lng1, 'float');
      lat2 = compiler.emitValue(lat2, 'float');
      lng2 = compiler.emitValue(lng2, 'float');
      compiler.addInclude("#include <TinyGPS++.h>");
      return [`TinyGPSPlus::courseTo(${lat1}, ${lng1}, ${lat2}, ${lng2})`, 0];
    };
  }
}

export function getNavigationCategory() {
  return {
    kind: "category",
    name: "Navigation & Location",
    contents: [
      { kind: "label", text: "GPS (NEO-6M)" },
      { kind: "block", type: "gps_init" },
      { kind: "block", type: "gps_has_fix" },
      { kind: "block", type: "gps_get_lat" },
      { kind: "block", type: "gps_get_lng" },
      { kind: "block", type: "gps_get_alt" },
      { kind: "block", type: "gps_get_speed" },
      { kind: "block", type: "gps_get_satellites" },
      { kind: "label", text: "IMU (MPU9250 9-DOF)" },
      { kind: "block", type: "mpu9250_init" },
      { kind: "block", type: "mpu9250_get_pitch" },
      { kind: "block", type: "mpu9250_get_roll" },
      { kind: "block", type: "mpu9250_get_yaw" },
      { kind: "block", type: "mpu9250_get_mag_x" },
      { kind: "label", text: "Location Math" },
      { kind: "block", type: "gps_distance_between" },
      { kind: "block", type: "gps_course_to" },
    ],
  };
}
