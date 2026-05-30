import { compiler } from "../compiler/assembler";
import { javascriptGenerator } from "blockly/javascript";

export function defineAdvancedControlBlocks(Blockly: any) {
  const generator = javascriptGenerator as any;

  // ─── PID Controller ───────────────────────────────────────────────────────
  Blockly.Blocks["pid_init"] = {
    init: function () {
      this.appendDummyInput().appendField("PID Init");
      this.appendValueInput("KP").setCheck("Number").appendField("Kp");
      this.appendValueInput("KI").setCheck("Number").appendField("Ki");
      this.appendValueInput("KD").setCheck("Number").appendField("Kd");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D53F8C");
      this.setTooltip("Initialize Arduino PID Library");
    },
  };
  if (generator) {
    generator.forBlock["pid_init"] = function (block: any) {
      const kp = generator.valueToCode(block, "KP", 0) || "1";
      const ki = generator.valueToCode(block, "KI", 0) || "0";
      const kd = generator.valueToCode(block, "KD", 0) || "0";
      compiler.addInclude("#include <PID_v1.h>");
      compiler.addGlobal(`double pid_setpoint = 0, pid_input = 0, pid_output = 0;\nPID myPID(&pid_input, &pid_output, &pid_setpoint, 1.0, 0.0, 0.0, DIRECT);`);
      compiler.addSetup(`myPID.SetTunings(${kp}, ${ki}, ${kd});\nmyPID.SetMode(AUTOMATIC);`);
      return "";
    };
  }

  Blockly.Blocks["pid_setpoint"] = {
    init: function () {
      this.appendValueInput("SP").setCheck("Number").appendField("PID Set Target Setpoint");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D53F8C");
    },
  };
  if (generator) {
    generator.forBlock["pid_setpoint"] = function (block: any) {
      const sp = generator.valueToCode(block, "SP", 0) || "0";
      return `pid_setpoint = ${sp};\n`;
    };
  }

  Blockly.Blocks["pid_compute"] = {
    init: function () {
      this.appendValueInput("INPUT").setCheck("Number").appendField("PID Compute Output for Input");
      this.setOutput(true, "Number");
      this.setColour("#D53F8C");
    },
  };
  if (generator) {
    generator.forBlock["pid_compute"] = function (block: any) {
      const input = generator.valueToCode(block, "INPUT", 0) || "0";
      compiler.addGlobal(`
double pidComputeBlock(double inVal) {
  pid_input = inVal;
  myPID.Compute();
  return pid_output;
}`);
      return [`pidComputeBlock(${input})`, 0];
    };
  }

  // ─── Shift Registers (74HC595) ───────────────────────────────────────────
  Blockly.Blocks["shift_init"] = {
    init: function () {
      this.appendDummyInput().appendField("Shift Register Init (74HC595)");
      this.appendDummyInput().appendField("Data (DS)").appendField(new Blockly.FieldTextInput("11"), "DS");
      this.appendDummyInput().appendField("Latch (STCP)").appendField(new Blockly.FieldTextInput("8"), "STCP");
      this.appendDummyInput().appendField("Clock (SHCP)").appendField(new Blockly.FieldTextInput("12"), "SHCP");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D53F8C");
    },
  };
  if (generator) {
    generator.forBlock["shift_init"] = function (block: any) {
      const ds = block.getFieldValue("DS");
      const stcp = block.getFieldValue("STCP");
      const shcp = block.getFieldValue("SHCP");
      compiler.addGlobal(`const int SR_DS = ${ds};\nconst int SR_STCP = ${stcp};\nconst int SR_SHCP = ${shcp};`);
      compiler.addSetup(`pinMode(SR_DS, OUTPUT);\npinMode(SR_STCP, OUTPUT);\npinMode(SR_SHCP, OUTPUT);`);
      return "";
    };
  }

  Blockly.Blocks["shift_write"] = {
    init: function () {
      this.appendValueInput("DATA").setCheck("Number").appendField("Shift Out 8-bit Data");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D53F8C");
    },
  };
  if (generator) {
    generator.forBlock["shift_write"] = function (block: any) {
      const data = generator.valueToCode(block, "DATA", 0) || "0";
      return `digitalWrite(SR_STCP, LOW);\nshiftOut(SR_DS, SR_SHCP, MSBFIRST, ${data});\ndigitalWrite(SR_STCP, HIGH);\n`;
    };
  }

  // ─── Stepper Motor (A4988) ───────────────────────────────────────────────
  Blockly.Blocks["stepper_init"] = {
    init: function () {
      this.appendDummyInput().appendField("Stepper Driver Init (A4988)");
      this.appendDummyInput().appendField("STEP").appendField(new Blockly.FieldTextInput("3"), "STEP");
      this.appendDummyInput().appendField("DIR").appendField(new Blockly.FieldTextInput("4"), "DIR");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#97266D");
    },
  };
  if (generator) {
    generator.forBlock["stepper_init"] = function (block: any) {
      const step = block.getFieldValue("STEP");
      const dir = block.getFieldValue("DIR");
      compiler.addGlobal(`const int STEP_PIN = ${step};\nconst int DIR_PIN = ${dir};`);
      compiler.addSetup(`pinMode(STEP_PIN, OUTPUT);\npinMode(DIR_PIN, OUTPUT);`);
      return "";
    };
  }

  Blockly.Blocks["stepper_step"] = {
    init: function () {
      this.appendValueInput("STEPS").setCheck("Number").appendField("Stepper Move Steps");
      this.appendDummyInput().appendField("Dir").appendField(new Blockly.FieldDropdown([["Forward", "HIGH"], ["Backward", "LOW"]]), "DIR");
      this.appendValueInput("DELAY").setCheck("Number").appendField("Delay (us)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#97266D");
    },
  };
  if (generator) {
    generator.forBlock["stepper_step"] = function (block: any) {
      const steps = generator.valueToCode(block, "STEPS", 0) || "200";
      const dir = block.getFieldValue("DIR");
      const delay = generator.valueToCode(block, "DELAY", 0) || "500";
      return `digitalWrite(DIR_PIN, ${dir});\nfor(int i=0; i<${steps}; i++) {\n  digitalWrite(STEP_PIN, HIGH);\n  delayMicroseconds(${delay});\n  digitalWrite(STEP_PIN, LOW);\n  delayMicroseconds(${delay});\n}\n`;
    };
  }
}

export function getAdvancedControlCategory() {
  return {
    kind: "category",
    name: "Advanced Control",
    contents: [
      { kind: "label", text: "PID Controllers" },
      { kind: "block", type: "pid_init" },
      { kind: "block", type: "pid_setpoint" },
      { kind: "block", type: "pid_compute" },
      { kind: "label", text: "Shift Registers (74HC595)" },
      { kind: "block", type: "shift_init" },
      { kind: "block", type: "shift_write" },
      { kind: "label", text: "Stepper Motors (A4988)" },
      { kind: "block", type: "stepper_init" },
      { kind: "block", type: "stepper_step" },
    ],
  };
}
