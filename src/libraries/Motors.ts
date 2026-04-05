import { compiler } from "../compiler/assembler";

export function defineMotorBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // -- SERVOS (7) --
  Blockly.Blocks["servo_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init Servo on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["servo_write_angle"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Set Servo on pin"); this.appendValueInput("ANGLE").setCheck("Number").appendField("to angle (0-180)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["servo_read_angle"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Read Servo angle on pin"); this.setOutput(true, "Number"); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["servo_detach"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Detach Servo on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["servo_cont_forward"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Continuous Servo Forward on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["servo_cont_backward"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Continuous Servo Backward on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };
  Blockly.Blocks["servo_cont_stop"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Continuous Servo Stop on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#D69E2E"); }
  };

  // -- L298N DC (5) --
  Blockly.Blocks["l298n_dc_init"] = {
    init() { this.appendDummyInput().appendField("Init L298N Motor"); this.appendValueInput("EN").setCheck("Number").appendField("EN"); this.appendValueInput("IN1").setCheck("Number").appendField("IN1"); this.appendValueInput("IN2").setCheck("Number").appendField("IN2"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B7791F"); }
  };
  Blockly.Blocks["l298n_dc_forward"] = {
    init() { this.appendValueInput("EN").setCheck("Number").appendField("L298N Forward EN pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B7791F"); }
  };
  Blockly.Blocks["l298n_dc_backward"] = {
    init() { this.appendValueInput("EN").setCheck("Number").appendField("L298N Backward EN pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B7791F"); }
  };
  Blockly.Blocks["l298n_dc_stop"] = {
    init() { this.appendValueInput("EN").setCheck("Number").appendField("L298N Stop EN pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B7791F"); }
  };
  Blockly.Blocks["l298n_dc_set_speed"] = {
    init() { this.appendValueInput("EN").setCheck("Number").appendField("L298N Set Speed (0-255) on EN"); this.appendValueInput("SPEED").setCheck("Number"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#B7791F"); }
  };

  // -- A4988 STEPPER (3) --
  Blockly.Blocks["a4988_stepper_init"] = {
    init() { this.appendDummyInput().appendField("Init Stepper (A4988)"); this.appendValueInput("DIR").setCheck("Number").appendField("DIR"); this.appendValueInput("STEP").setCheck("Number").appendField("STEP"); this.appendValueInput("STEPS").setCheck("Number").appendField("Steps/Rev"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#975A16"); }
  };
  Blockly.Blocks["a4988_stepper_set_speed"] = {
    init() { this.appendValueInput("RPM").setCheck("Number").appendField("A4988 Stepper Speed (RPM)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#975A16"); }
  };
  Blockly.Blocks["a4988_stepper_step"] = {
    init() { this.appendValueInput("STEPS").setCheck("Number").appendField("A4988 Move Steps"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#975A16"); }
  };

  // -- PCA9685 (5) --
  Blockly.Blocks["pca9685_init"] = {
    init() { this.appendDummyInput().appendField("Init PCA9685 (I2C Servo Driver)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#744210"); }
  };
  Blockly.Blocks["pca9685_set_pwm_freq"] = {
    init() { this.appendValueInput("FREQ").setCheck("Number").appendField("PCA9685 Set PWM Freq (Hz)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#744210"); }
  };
  Blockly.Blocks["pca9685_set_servo"] = {
    init() { this.appendValueInput("CH").setCheck("Number").appendField("PCA9685 Servo Ch (0-15)"); this.appendValueInput("ANGLE").setCheck("Number").appendField("Angle"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#744210"); }
  };
  Blockly.Blocks["pca9685_set_pwm"] = {
    init() { this.appendValueInput("CH").setCheck("Number").appendField("PCA9685 Raw PWM Ch (0-15)"); this.appendValueInput("VAL").setCheck("Number").appendField("Val (0-4095)"); this.setInputsInline(true); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#744210"); }
  };
  Blockly.Blocks["pca9685_sleep"] = {
    init() { this.appendDummyInput().appendField("PCA9685 Sleep"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#744210"); }
  };

  // -- RELAYS & SOLENOIDS (5) --
  Blockly.Blocks["relay_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init Relay on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#5F370E"); }
  };
  Blockly.Blocks["relay_on"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Relay ON pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#5F370E"); }
  };
  Blockly.Blocks["relay_off"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Relay OFF pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#5F370E"); }
  };
  Blockly.Blocks["solenoid_init"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Init Solenoid on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#5F370E"); }
  };
  Blockly.Blocks["solenoid_trigger"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Trigger/Kick Solenoid on pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#5F370E"); }
  };

  // -- VIBRATION, PUMPS, & ESC (5) --
  Blockly.Blocks["vibration_motor_on"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Vibration Motor ON pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["vibration_motor_off"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Vibration Motor OFF pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["water_pump_on"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Water Pump ON pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["water_pump_off"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Water Pump OFF pin"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };
  Blockly.Blocks["bldc_esc_write"] = {
    init() { this.appendValueInput("PIN").setCheck("Number").appendField("Write BLDC ESC Throttle on pin"); this.appendValueInput("SPEED").setCheck("Number").appendField("speed (0-180)"); this.setPreviousStatement(true, null); this.setNextStatement(true, null); this.setColour("#3182CE"); }
  };

  if (generator) {
    // 1-7. Servos
    generator.forBlock["servo_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      compiler.addInclude(`#include <Servo.h>`);
      compiler.addGlobal(`Servo servo_${pin};`);
      compiler.addSetup(`servo_${pin}.attach(${pin});`);
      return "";
    };
    generator.forBlock["servo_write_angle"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      const a = generator.valueToCode(block, 'ANGLE', generator.ORDER_ATOMIC) || '90';
      return `servo_${pin}.write(${a});\n`;
    };
    generator.forBlock["servo_read_angle"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      return [`servo_${pin}.read()`, generator.ORDER_FUNCTION_CALL];
    };
    generator.forBlock["servo_detach"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      return `servo_${pin}.detach();\n`;
    };
    generator.forBlock["servo_cont_forward"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      return `servo_${pin}.write(180);\n`;
    };
    generator.forBlock["servo_cont_backward"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      return `servo_${pin}.write(0);\n`;
    };
    generator.forBlock["servo_cont_stop"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      return `servo_${pin}.write(90);\n`;
    };

    // 8-12. L298N DC
    generator.forBlock["l298n_dc_init"] = function(block: any, generator: any) {
      const en = generator.valueToCode(block, 'EN', generator.ORDER_ATOMIC) || '0';
      const in1 = generator.valueToCode(block, 'IN1', generator.ORDER_ATOMIC) || '0';
      const in2 = generator.valueToCode(block, 'IN2', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${en}, OUTPUT);\npinMode(${in1}, OUTPUT);\npinMode(${in2}, OUTPUT);`);
      // Attach mapping global cache
      compiler.addGlobal(`int in1_${en} = ${in1};\nint in2_${en} = ${in2};`);
      return "";
    };
    generator.forBlock["l298n_dc_forward"] = function(block: any, generator: any) {
      const en = generator.valueToCode(block, 'EN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(in1_${en}, HIGH);\ndigitalWrite(in2_${en}, LOW);\n`;
    };
    generator.forBlock["l298n_dc_backward"] = function(block: any, generator: any) {
      const en = generator.valueToCode(block, 'EN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(in1_${en}, LOW);\ndigitalWrite(in2_${en}, HIGH);\n`;
    };
    generator.forBlock["l298n_dc_stop"] = function(block: any, generator: any) {
      const en = generator.valueToCode(block, 'EN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(in1_${en}, LOW);\ndigitalWrite(in2_${en}, LOW);\nanalogWrite(${en}, 0);\n`;
    };
    generator.forBlock["l298n_dc_set_speed"] = function(block: any, generator: any) {
      const en = generator.valueToCode(block, 'EN', generator.ORDER_ATOMIC) || '0';
      const spd = generator.valueToCode(block, 'SPEED', generator.ORDER_ATOMIC) || '255';
      return `analogWrite(${en}, ${spd});\n`;
    };

    // 13-15. Stepper
    generator.forBlock["a4988_stepper_init"] = function(block: any, generator: any) {
      const dir = generator.valueToCode(block, 'DIR', generator.ORDER_ATOMIC) || '2';
      const step = generator.valueToCode(block, 'STEP', generator.ORDER_ATOMIC) || '3';
      const spr = generator.valueToCode(block, 'STEPS', generator.ORDER_ATOMIC) || '200';
      compiler.addInclude(`#include <Stepper.h>`);
      compiler.addGlobal(`Stepper myStepper(${spr}, ${dir}, ${step});`);
      return "";
    };
    generator.forBlock["a4988_stepper_set_speed"] = function(block: any, generator: any) {
      const rpm = generator.valueToCode(block, 'RPM', generator.ORDER_ATOMIC) || '60';
      return `myStepper.setSpeed(${rpm});\n`;
    };
    generator.forBlock["a4988_stepper_step"] = function(block: any, generator: any) {
      const steps = generator.valueToCode(block, 'STEPS', generator.ORDER_ATOMIC) || '0';
      return `myStepper.step(${steps});\n`;
    };

    // 16-20. PCA9685
    generator.forBlock["pca9685_init"] = function() {
      compiler.addInclude(`#include <Wire.h>\n#include <Adafruit_PWMServoDriver.h>`);
      compiler.addGlobal(`Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver();`);
      compiler.addSetup(`pca.begin();\npca.setPWMFreq(60);`);
      return "";
    };
    generator.forBlock["pca9685_set_pwm_freq"] = function(block: any, generator: any) {
      const freq = generator.valueToCode(block, 'FREQ', generator.ORDER_ATOMIC) || '60';
      return `pca.setPWMFreq(${freq});\n`;
    };
    generator.forBlock["pca9685_set_servo"] = function(block: any, generator: any) {
      const ch = generator.valueToCode(block, 'CH', generator.ORDER_ATOMIC) || '0';
      const a = generator.valueToCode(block, 'ANGLE', generator.ORDER_ATOMIC) || '90';
      return `pca.setPWM(${ch}, 0, map(${a}, 0, 180, 150, 600));\n`;
    };
    generator.forBlock["pca9685_set_pwm"] = function(block: any, generator: any) {
      const ch = generator.valueToCode(block, 'CH', generator.ORDER_ATOMIC) || '0';
      const val = generator.valueToCode(block, 'VAL', generator.ORDER_ATOMIC) || '4095';
      return `pca.setPWM(${ch}, 0, ${val});\n`;
    };
    generator.forBlock["pca9685_sleep"] = function() {
      return `pca.sleep();\n`;
    };

    // 21-25. Relays & Solenoids
    generator.forBlock["relay_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, OUTPUT);\ndigitalWrite(${pin}, LOW);`);
      return "";
    };
    generator.forBlock["relay_on"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(${pin}, HIGH);\n`;
    };
    generator.forBlock["relay_off"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(${pin}, LOW);\n`;
    };
    generator.forBlock["solenoid_init"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, OUTPUT);\ndigitalWrite(${pin}, LOW);`);
      return "";
    };
    generator.forBlock["solenoid_trigger"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(${pin}, HIGH);\ndelay(100);\ndigitalWrite(${pin}, LOW);\n`;
    };

    // 26-30. Vibration, Pump, ESC
    generator.forBlock["vibration_motor_on"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, OUTPUT);`);
      return `digitalWrite(${pin}, HIGH);\n`;
    };
    generator.forBlock["vibration_motor_off"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(${pin}, LOW);\n`;
    };
    generator.forBlock["water_pump_on"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, OUTPUT);`);
      return `digitalWrite(${pin}, HIGH);\n`;
    };
    generator.forBlock["water_pump_off"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      return `digitalWrite(${pin}, LOW);\n`;
    };
    generator.forBlock["bldc_esc_write"] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '9';
      const spd = generator.valueToCode(block, 'SPEED', generator.ORDER_ATOMIC) || '0';
      compiler.addInclude(`#include <Servo.h>`);
      compiler.addGlobal(`Servo esc_${pin};`);
      compiler.addSetup(`esc_${pin}.attach(${pin}, 1000, 2000);`);
      return `esc_${pin}.write(${spd});\n`;
    };
  }
}

export function getMotorCategory() {
  return {
    kind: "category", name: "Motors & Actuators",
    contents: [
      { kind: "label", text: "Servos" },
      { kind: "block", type: "servo_init" },
      { kind: "block", type: "servo_write_angle" },
      { kind: "block", type: "servo_read_angle" },
      { kind: "block", type: "servo_detach" },
      { kind: "block", type: "servo_cont_forward" },
      { kind: "block", type: "servo_cont_backward" },
      { kind: "block", type: "servo_cont_stop" },
      { kind: "label", text: "DC Motors (L298N)" },
      { kind: "block", type: "l298n_dc_init" },
      { kind: "block", type: "l298n_dc_forward" },
      { kind: "block", type: "l298n_dc_backward" },
      { kind: "block", type: "l298n_dc_stop" },
      { kind: "block", type: "l298n_dc_set_speed" },
      { kind: "label", text: "Stepper Motors" },
      { kind: "block", type: "a4988_stepper_init" },
      { kind: "block", type: "a4988_stepper_set_speed" },
      { kind: "block", type: "a4988_stepper_step" },
      { kind: "label", text: "PCA9685 I2C Expansion" },
      { kind: "block", type: "pca9685_init" },
      { kind: "block", type: "pca9685_set_pwm_freq" },
      { kind: "block", type: "pca9685_set_servo" },
      { kind: "block", type: "pca9685_set_pwm" },
      { kind: "block", type: "pca9685_sleep" },
      { kind: "label", text: "Relays & Solenoids" },
      { kind: "block", type: "relay_init" },
      { kind: "block", type: "relay_on" },
      { kind: "block", type: "relay_off" },
      { kind: "block", type: "solenoid_init" },
      { kind: "block", type: "solenoid_trigger" },
      { kind: "label", text: "Pumps, Vibe & ESC" },
      { kind: "block", type: "vibration_motor_on" },
      { kind: "block", type: "vibration_motor_off" },
      { kind: "block", type: "water_pump_on" },
      { kind: "block", type: "water_pump_off" },
      { kind: "block", type: "bldc_esc_write" },
    ]
  };
}
