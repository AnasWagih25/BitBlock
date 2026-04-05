import { compiler } from "../compiler/assembler";

export function defineCoreBlocks(Blockly: any) {
  // We attach custom generator handling to the javascript generator for now
  // since a pure C++ generator isn't included in the default blockly package
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  // Digital Write block
  Blockly.Blocks["gpio_digital_write"] = {
    init() {
      this.appendValueInput("PIN").setCheck("Number").appendField("Digital Write pin");
      this.appendValueInput("VALUE").setCheck("Boolean").appendField("value");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#9D27DE");
      this.setTooltip("Write HIGH or LOW to a digital pin");
    },
  };

  Blockly.Blocks["gpio_digital_read"] = {
    init() {
      this.appendValueInput("PIN").setCheck("Number").appendField("Digital Read pin");
      this.setOutput(true, "Boolean");
      this.setColour("#9D27DE");
      this.setTooltip("Read the digital value of a pin");
    },
  };

  Blockly.Blocks["gpio_pin_mode"] = {
    init() {
      this.appendValueInput("PIN").setCheck("Number").appendField("Set pin");
      this.appendDummyInput().appendField("mode").appendField(
        new Blockly.FieldDropdown([["OUTPUT", "OUTPUT"], ["INPUT", "INPUT"], ["INPUT_PULLUP", "INPUT_PULLUP"]]),
        "MODE"
      );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#9D27DE");
    },
  };

  Blockly.Blocks["timing_delay"] = {
    init() {
      this.appendValueInput("MS").setCheck("Number").appendField("Delay");
      this.appendDummyInput().appendField("milliseconds");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#38B2AC");
      this.setTooltip("Wait for the specified number of milliseconds");
    },
  };

  Blockly.Blocks["serial_print"] = {
    init() {
      this.appendValueInput("TEXT").appendField("Serial print");
      this.appendDummyInput().appendField(new Blockly.FieldDropdown([["newline", "println"], ["no newline", "print"]]), "MODE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#B794F4");
      this.setTooltip("Print a value to the Serial monitor");
    },
  };

  if (generator) {
    generator.forBlock['gpio_digital_write'] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      const val = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || 'LOW';
      compiler.addSetup(`pinMode(${pin}, OUTPUT);`);
      return `digitalWrite(${pin}, ${val ? 'HIGH' : 'LOW'});\n`;
    };

    generator.forBlock['gpio_digital_read'] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      compiler.addSetup(`pinMode(${pin}, INPUT);`);
      return [`digitalRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };

    generator.forBlock['gpio_pin_mode'] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      const mode = block.getFieldValue('MODE');
      compiler.addSetup(`pinMode(${pin}, ${mode});`);
      return "";
    };

    generator.forBlock['timing_delay'] = function(block: any, generator: any) {
      const ms = generator.valueToCode(block, 'MS', generator.ORDER_ATOMIC) || '1000';
      return `delay(${ms});\n`;
    };

    generator.forBlock['serial_print'] = function(block: any, generator: any) {
      let text = generator.valueToCode(block, 'TEXT', generator.ORDER_ATOMIC) || '""';
      const mode = block.getFieldValue('MODE');
      
      // Safely unquote then string-wrap via compiler mapping
      if (text.startsWith("'") && text.endsWith("'")) {
         text = compiler.wrapString(text.slice(1, -1));
      }

      return `Serial.${mode}(${text});\n`;
    };
  }
}

export function getCoreToolboxBlocks() {
  return [
    {
      kind: "category", name: "GPIO",
      contents: [
        { kind: "block", type: "gpio_pin_mode" },
        { kind: "block", type: "gpio_digital_write" },
        { kind: "block", type: "gpio_digital_read" },
      ],
    },
    {
      kind: "category", name: "Timing",
      contents: [
        { kind: "block", type: "timing_delay" },
      ],
    },
    {
      kind: "category", name: "Serial",
      contents: [
        { kind: "block", type: "serial_print" },
      ],
    }
  ];
}
