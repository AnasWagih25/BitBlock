import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

export function defineCoreBlocks(Blockly: any) {
  // We attach custom generator handling to the javascript generator for now
  // since a pure C++ generator isn't included in the default blockly package
  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;
  const idSafe = (v: string) => String(v).replace(/[^a-zA-Z0-9_]/g, "_");

  // ─── Execution Flow (Hats) ────────────────────────────────────────────────
  Blockly.Blocks["event_setup"] = {
    init: function () {
      this.appendDummyInput().appendField("On Setup (Run Once)");
      this.appendStatementInput("DO").setCheck(null);
      this.setColour("#9D27DE");
      this.setTooltip("Runs once when the device powers on.");
    },
  };
  generator.forBlock["event_setup"] = function (block: any, generator: any) {
    const branch = generator.statementToCode(block, "DO");
    if (branch) {
      compiler.addSetup(branch);
    }
    return "";
  };

  Blockly.Blocks["event_loop"] = {
    init: function () {
      this.appendDummyInput().appendField("Forever Loop (Background)");
      this.appendStatementInput("DO").setCheck(null);
      this.setColour("#9D27DE");
      this.setTooltip("Runs continuously in the background void loop.");
    },
  };
  generator.forBlock["event_loop"] = function (block: any, generator: any) {
    const branch = generator.statementToCode(block, "DO");
    if (branch) {
      compiler.addLoop(branch);
    }
    return "";
  };

  Blockly.Blocks["hardware_interrupt"] = {
    init: function () {
      this.appendValueInput("PIN").setCheck("Number").appendField("On Interrupt Pin");
      this.appendDummyInput().appendField("Mode").appendField(new Blockly.FieldDropdown([["RISING", "RISING"], ["FALLING", "FALLING"], ["CHANGE", "CHANGE"]]), "MODE");
      this.appendStatementInput("DO").setCheck(null);
      this.setColour("#9D27DE");
    },
  };
  generator.forBlock["hardware_interrupt"] = function (block: any, generator: any) {
    const pin = generator.valueToCode(block, "PIN", generator.ORDER_ATOMIC) || "0";
    const mode = block.getFieldValue("MODE");
    const branch = generator.statementToCode(block, "DO");
    const isrName = `isr_${idSafe(pin)}_${Math.random().toString(36).substring(7)}`;
    compiler.addGlobal(`void ${isrName}() {\n${branch}\n}`);
    compiler.addSetup(`pinMode(${pin}, INPUT_PULLUP);`);
    compiler.addSetup(`attachInterrupt(digitalPinToInterrupt(${pin}), ${isrName}, ${mode});`);
    return "";
  };

  // ─── Power & Sleep ────────────────────────────────────────────────────────
  Blockly.Blocks["esp_deep_sleep"] = {
    init: function () {
      this.appendValueInput("TIME").setCheck("Number").appendField("Deep Sleep for (microsecs)");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#6B1A99");
    },
  };
  generator.forBlock["esp_deep_sleep"] = function (block: any, generator: any) {
    const time = generator.valueToCode(block, "TIME", generator.ORDER_ATOMIC) || "1000000";
    // @ts-ignore
    const bd = getBoardConfig(compiler.boardId);
    if (bd.platform === "esp32") {
      return `esp_sleep_enable_timer_wakeup(${time});\nesp_deep_sleep_start();\n`;
    }
    if (bd.platform === "esp8266") {
      return `ESP.deepSleep(${time});\n`;
    }
    return `// Deep sleep is not available on this board.\n`;
  };

  // ─── Data Types & Arrays ──────────────────────────────────────────────────
  Blockly.Blocks["array_create"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("Create Array")
        .appendField(new Blockly.FieldDropdown([["int", "int"], ["float", "float"], ["String", "String"]]), "TYPE")
        .appendField(new Blockly.FieldTextInput("myArray"), "NAME")
        .appendField("[")
        .appendField(new Blockly.FieldTextInput("10"), "SIZE")
        .appendField("]");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#E53E3E");
    },
  };
  generator.forBlock["array_create"] = function (block: any) {
    const type = block.getFieldValue("TYPE");
    const name = idSafe(block.getFieldValue("NAME") || "myArray");
    const rawSize = Number(block.getFieldValue("SIZE"));
    const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.floor(rawSize) : 10;
    compiler.addGlobal(`${type} ${name}[${size}];`);
    return "";
  };

  Blockly.Blocks["array_set"] = {
    init: function () {
      this.appendDummyInput().appendField("Set Array").appendField(new Blockly.FieldTextInput("myArray"), "NAME");
      this.appendValueInput("INDEX").setCheck("Number").appendField("Index");
      this.appendValueInput("VALUE").setCheck(null).appendField("to");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#E53E3E");
    },
  };
  generator.forBlock["array_set"] = function (block: any, generator: any) {
    const name = idSafe(block.getFieldValue("NAME") || "myArray");
    const index = generator.valueToCode(block, "INDEX", generator.ORDER_ATOMIC) || "0";
    const value = generator.valueToCode(block, "VALUE", generator.ORDER_ATOMIC) || "0";
    return `${name}[${index}] = ${value};\n`;
  };

  Blockly.Blocks["array_get"] = {
    init: function () {
      this.appendDummyInput().appendField("Get Array").appendField(new Blockly.FieldTextInput("myArray"), "NAME");
      this.appendValueInput("INDEX").setCheck("Number").appendField("Index");
      this.setOutput(true, null);
      this.setColour("#E53E3E");
    },
  };
  generator.forBlock["array_get"] = function (block: any, generator: any) {
    const name = idSafe(block.getFieldValue("NAME") || "myArray");
    const index = generator.valueToCode(block, "INDEX", generator.ORDER_ATOMIC) || "0";
    return [`${name}[${index}]`, generator.ORDER_ATOMIC];
  };

  // ─── Native Basic C/C++ ──────────────────────────────────────────────────
  Blockly.Blocks["delay_microseconds"] = {
    init: function () {
      this.appendValueInput("TIME").setCheck("Number").appendField("Delay Microseconds");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    },
  };
  generator.forBlock["delay_microseconds"] = function (block: any, generator: any) {
    const time = generator.valueToCode(block, "TIME", generator.ORDER_ATOMIC) || "10";
    return `delayMicroseconds(${time});\n`;
  };

  Blockly.Blocks["yield"] = {
    init: function () {
      this.appendDummyInput().appendField("Yield to OS / Watchdog");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#D69E2E");
    },
  };
  generator.forBlock["yield"] = function () {
    return `yield();\n`;
  };

  // Digital Write block
  Blockly.Blocks["gpio_digital_write"] = {
    init() {
      this.appendValueInput("PIN").setCheck("Number").appendField("Digital Write pin");
      this.appendDummyInput()
        .appendField("value")
        .appendField(new Blockly.FieldDropdown([["HIGH", "HIGH"], ["LOW", "LOW"]]), "STATE");
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

  Blockly.Blocks["gpio_analog_read"] = {
    init() {
      this.appendValueInput("PIN").setCheck("Number").appendField("Analog Read pin");
      this.setOutput(true, "Number");
      this.setColour("#9D27DE");
      this.setTooltip("Read analog value from a pin");
    },
  };

  Blockly.Blocks["gpio_analog_write"] = {
    init() {
      this.appendValueInput("PIN").setCheck("Number").appendField("PWM Write pin");
      this.appendValueInput("VALUE").setCheck("Number").appendField("value");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour("#9D27DE");
      this.setTooltip("Write PWM value to a pin");
    },
  };

  Blockly.Blocks["math_map"] = {
    init() {
      this.appendValueInput("VAL").setCheck("Number").appendField("Map value");
      this.appendDummyInput().appendField("from [");
      this.appendValueInput("FROMLOW").setCheck("Number");
      this.appendDummyInput().appendField(",");
      this.appendValueInput("FROMHIGH").setCheck("Number");
      this.appendDummyInput().appendField("] to [");
      this.appendValueInput("TOLOW").setCheck("Number");
      this.appendDummyInput().appendField(",");
      this.appendValueInput("TOHIGH").setCheck("Number");
      this.appendDummyInput().appendField("]");
      this.setInputsInline(true);
      this.setOutput(true, "Number");
      this.setColour("#3182CE");
      this.setTooltip("Map a number from one range to another");
    },
  };

  if (generator) {
    generator.forBlock['gpio_digital_write'] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      const val = block.getFieldValue("STATE") || "LOW";
      compiler.addSetup(`pinMode(${pin}, OUTPUT);`);
      return `digitalWrite(${pin}, ${val});\n`;
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

    generator.forBlock['gpio_analog_read'] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      return [`analogRead(${pin})`, generator.ORDER_FUNCTION_CALL];
    };

    generator.forBlock['gpio_analog_write'] = function(block: any, generator: any) {
      const pin = generator.valueToCode(block, 'PIN', generator.ORDER_ATOMIC) || '0';
      const val = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || '0';
      return `analogWrite(${pin}, ${val});\n`;
    };

    generator.forBlock['math_map'] = function(block: any, generator: any) {
      const val = generator.valueToCode(block, 'VAL', generator.ORDER_ATOMIC) || '0';
      const fromLow = generator.valueToCode(block, 'FROMLOW', generator.ORDER_ATOMIC) || '0';
      const fromHigh = generator.valueToCode(block, 'FROMHIGH', generator.ORDER_ATOMIC) || '1023';
      const toLow = generator.valueToCode(block, 'TOLOW', generator.ORDER_ATOMIC) || '0';
      const toHigh = generator.valueToCode(block, 'TOHIGH', generator.ORDER_ATOMIC) || '255';
      return [`map(${val}, ${fromLow}, ${fromHigh}, ${toLow}, ${toHigh})`, generator.ORDER_FUNCTION_CALL];
    };
  }
}

export function getCoreToolboxBlocks() {
  return [
    {
      kind: "category",
      name: "Logic & Control",
      colour: "#5C81A6",
      contents: [
        // Built-in Blockly control blocks (supports if / else if / else via mutator)
        { kind: "block", type: "controls_if" },
        // Comparison operators: =, !=, <, <=, >, >=
        { kind: "block", type: "logic_compare" },
        // Logical operators: and / or
        { kind: "block", type: "logic_operation" },
        // Unary not operator
        { kind: "block", type: "logic_negate" },
        // True / false constants
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Events & Arrays",
      colour: "#9D27DE",
      contents: [
        { kind: "block", type: "event_setup" },
        { kind: "block", type: "event_loop" },
        { kind: "block", type: "hardware_interrupt" },
        { kind: "block", type: "esp_deep_sleep" },
        { kind: "block", type: "array_create" },
        { kind: "block", type: "array_set" },
        { kind: "block", type: "array_get" },
        { kind: "block", type: "delay_microseconds" },
        { kind: "block", type: "yield" }
      ]
    },
    {
      kind: "category", name: "GPIO",
      contents: [
        { kind: "block", type: "gpio_pin_mode" },
        { kind: "block", type: "gpio_digital_write" },
        { kind: "block", type: "gpio_digital_read" },
        { kind: "block", type: "gpio_analog_write" },
        { kind: "block", type: "gpio_analog_read" },
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
