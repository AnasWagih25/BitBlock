import { compiler } from "../compiler/assembler";

export function defineMotorBlocks(Blockly: any) {
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // Servo Control
  Blockly.Blocks["motor_servo_write"] = {
    init() {
      this.appendValueInput("ANGLE").setCheck("Number").appendField("Set Servo on pin");
      this.appendDummyInput().appendField(new Blockly.FieldNumber(9), "PIN").appendField("to angle");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    }
  };

  if (generator) {
    generator.forBlock["motor_servo_write"] = function(block: any, generator: any) {
      const pin = block.getFieldValue("PIN");
      const angle = generator.valueToCode(block, 'ANGLE', generator.ORDER_ATOMIC) || '90';
      const id = `servo_${pin}`;
      
      // ESP32 requires 'ESP32Servo', standard uses 'Servo'
      // Assume assembler can differentiate but for ease we use standard Servo include right now
      compiler.addInclude(`#include <Servo.h>`);
      compiler.addGlobal(`Servo ${id};`);
      compiler.addSetup(`${id}.attach(${pin});`);
      
      return `${id}.write(${angle});\n`;
    };
  }
}

export function getMotorCategory() {
  return {
    kind: "category", name: "Motors",
    contents: [
      { kind: "block", type: "motor_servo_write" },
    ]
  };
}
