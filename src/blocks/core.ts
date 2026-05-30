import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

import { javascriptGenerator } from "blockly/javascript";

export function defineCoreBlocks(Blockly: any) {
  const generator = javascriptGenerator;
  
  // Prevent JS generator from prepending "var x;" to the top of the code
  generator.finish = function(code: string) { return code; };

  const idSafe = (v: string) => String(v).replace(/[^a-zA-Z0-9_]/g, "_");
  const asCppString = (expr: string) => {
    if (expr.startsWith("'") && expr.endsWith("'")) {
      return compiler.wrapString(expr.slice(1, -1));
    }
    return expr;
  };

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
    const isrName = `isr_pin${idSafe(pin)}_${mode.toLowerCase()}`;
    // @ts-ignore
    const bd = getBoardConfig(compiler.boardId);
    const iramAttr = (bd.platform === "esp32") ? "IRAM_ATTR " : "";
    compiler.addGlobal(`// WARNING: Variables modified inside ISRs should be declared volatile\nvoid ${iramAttr}${isrName}() {\n${branch}\n}`);
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
    // ─── Override built-in Blockly blocks to emit C++ instead of JavaScript ───

    // controls_for: properly handle bidirectional loop logic
    generator.forBlock['controls_for'] = function(block: any, generator: any) {
      const varId = block.getFieldValue('VAR');
      const varModel = block.workspace.getVariableMap().getVariableById(varId);
      const varName = idSafe(varModel ? varModel.name : 'i');
      const from = generator.valueToCode(block, 'FROM', generator.ORDER_ATOMIC) || '0';
      const to = generator.valueToCode(block, 'TO', generator.ORDER_ATOMIC) || '10';
      const by = generator.valueToCode(block, 'BY', generator.ORDER_ATOMIC) || '1';
      const branch = generator.statementToCode(block, 'DO');

      // Static path: both FROM and TO are literal numbers
      if (!isNaN(Number(from)) && !isNaN(Number(to))) {
        const isDown = Number(from) > Number(to);
        const op = isDown ? '>=' : '<=';
        // Use the absolute value of BY, pick += or -= based on direction
        const absByVal = !isNaN(Number(by)) ? Math.abs(Number(by)).toString() : by;
        const stepOp = isDown ? '-=' : '+=';
        return `for (int ${varName} = ${from}; ${varName} ${op} ${to}; ${varName} ${stepOp} ${absByVal}) {\n${branch}}\n`;
      } else {
        // Dynamic path: FROM/TO are variables, decide direction at runtime
        return `int _s_${varName} = ${from};\nint _e_${varName} = ${to};\nint _b_${varName} = ${by};\nif (_s_${varName} > _e_${varName} && _b_${varName} > 0) _b_${varName} = -_b_${varName};\nfor (int ${varName} = _s_${varName}; (_s_${varName} <= _e_${varName}) ? (${varName} <= _e_${varName}) : (${varName} >= _e_${varName}); ${varName} += _b_${varName}) {\n${branch}}\n`;
      }
    };

    // controls_repeat_ext: repeat N times
    generator.forBlock['controls_repeat_ext'] = function(block: any, generator: any) {
      const times = generator.valueToCode(block, 'TIMES', generator.ORDER_ATOMIC) || '10';
      const branch = generator.statementToCode(block, 'DO');
      return `for (int _rep_i = 0; _rep_i < ${times}; _rep_i++) {\n${branch}}\n`;
    };

    // controls_whileUntil: while/until loop
    generator.forBlock['controls_whileUntil'] = function(block: any, generator: any) {
      const mode = block.getFieldValue('MODE');
      let cond = generator.valueToCode(block, 'BOOL', generator.ORDER_ATOMIC) || 'false';
      const branch = generator.statementToCode(block, 'DO');
      if (mode === 'UNTIL') {
        cond = `!(${cond})`;
      }
      return `while (${cond}) {\n${branch}}\n`;
    };

    // variables_set: Blockly JS emits "var x = ..." which is invalid C++
    generator.forBlock['variables_set'] = function(block: any, generator: any) {
      const varId = block.getFieldValue('VAR');
      const varModel = block.workspace.getVariableMap().getVariableById(varId);
      const varName = idSafe(varModel ? varModel.name : 'myVar');
      const value = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || '0';
      // Detect if value is a string expression to choose appropriate global type
      const valTrimmed = value.trim();
      const isStringExpr = valTrimmed.startsWith('"') || valTrimmed.startsWith('F("') ||
        valTrimmed.startsWith('String(') || valTrimmed.startsWith('WiFi.') ||
        valTrimmed.includes('.toString()') || valTrimmed.includes('readRFIDCard()') ||
        valTrimmed.includes('readString()') || valTrimmed.includes('btReadStr()');
      if (isStringExpr) {
        compiler.addGlobal(`String ${varName} = "";`);
      } else {
        compiler.addGlobal(`int ${varName} = 0;`);
      }
      return `${varName} = ${value};\n`;
    };

    // variables_get: just return the variable name
    generator.forBlock['variables_get'] = function(block: any, generator: any) {
      const varId = block.getFieldValue('VAR');
      const varModel = block.workspace.getVariableMap().getVariableById(varId);
      const varName = idSafe(varModel ? varModel.name : 'myVar');
      return [varName, generator.ORDER_ATOMIC];
    };

    // math_change: value += delta
    generator.forBlock['math_change'] = function(block: any, generator: any) {
      const varId = block.getFieldValue('VAR');
      const varModel = block.workspace.getVariableMap().getVariableById(varId);
      const varName = idSafe(varModel ? varModel.name : 'myVar');
      const value = generator.valueToCode(block, 'DELTA', generator.ORDER_ATOMIC) || '1';
      return `${varName} += ${value};\n`;
    };

    // math_number: ensure it returns just the number
    generator.forBlock['math_number'] = function(block: any) {
      const num = block.getFieldValue('NUM') || '0';
      return [String(num), (generator as any).ORDER_ATOMIC];
    };

    // text: return C++ double-quoted string instead of JS single-quoted
    generator.forBlock['text'] = function(block: any) {
      const text = block.getFieldValue('TEXT') || '';
      return [compiler.wrapString(text), (generator as any).ORDER_ATOMIC];
    };

    // logic_boolean: true/false works in both JS and C++
    generator.forBlock['logic_boolean'] = function(block: any) {
      const code = block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false';
      return [code, (generator as any).ORDER_ATOMIC];
    };

    // logic_compare: comparison operators
    generator.forBlock['logic_compare'] = function(block: any, generator: any) {
      const ops: Record<string, string> = { 'EQ': '==', 'NEQ': '!=', 'LT': '<', 'LTE': '<=', 'GT': '>', 'GTE': '>=' };
      const op = ops[block.getFieldValue('OP')] || '==';
      const a = generator.valueToCode(block, 'A', generator.ORDER_RELATIONAL) || '0';
      const b = generator.valueToCode(block, 'B', generator.ORDER_RELATIONAL) || '0';
      return [`${a} ${op} ${b}`, generator.ORDER_RELATIONAL];
    };

    // logic_operation: and/or
    generator.forBlock['logic_operation'] = function(block: any, generator: any) {
      const op = block.getFieldValue('OP') === 'AND' ? '&&' : '||';
      const order = block.getFieldValue('OP') === 'AND' ? generator.ORDER_LOGICAL_AND : generator.ORDER_LOGICAL_OR;
      const a = generator.valueToCode(block, 'A', order) || 'false';
      const b = generator.valueToCode(block, 'B', order) || 'false';
      return [`${a} ${op} ${b}`, order];
    };

    // logic_negate: not
    generator.forBlock['logic_negate'] = function(block: any, generator: any) {
      const val = generator.valueToCode(block, 'BOOL', generator.ORDER_LOGICAL_NOT) || 'true';
      return [`!${val}`, generator.ORDER_LOGICAL_NOT];
    };

    // controls_if: if/elseif/else
    generator.forBlock['controls_if'] = function(block: any, generator: any) {
      let code = '';
      let n = 0;
      // Handle IF/ELSEIF clauses
      do {
        const cond = generator.valueToCode(block, 'IF' + n, generator.ORDER_NONE) || 'false';
        const branch = generator.statementToCode(block, 'DO' + n);
        code += (n === 0 ? '' : ' else ') + `if (${cond}) {\n${branch}}`;
        n++;
      } while (block.getInput('IF' + n));
      // Handle ELSE clause
      if (block.getInput('ELSE')) {
        const elseBranch = generator.statementToCode(block, 'ELSE');
        if (elseBranch) {
          code += ` else {\n${elseBranch}}`;
        }
      }
      return code + '\n';
    };

    // math_arithmetic: +, -, *, /, ^
    generator.forBlock['math_arithmetic'] = function(block: any, generator: any) {
      const ops: Record<string, [string, number]> = {
        'ADD': ['+', generator.ORDER_ADDITION],
        'MINUS': ['-', generator.ORDER_SUBTRACTION],
        'MULTIPLY': ['*', generator.ORDER_MULTIPLICATION],
        'DIVIDE': ['/', generator.ORDER_DIVISION],
        'POWER': ['', generator.ORDER_FUNCTION_CALL],
      };
      const tuple = ops[block.getFieldValue('OP')] || ['+', generator.ORDER_ADDITION];
      const a = generator.valueToCode(block, 'A', tuple[1]) || '0';
      const b = generator.valueToCode(block, 'B', tuple[1]) || '0';
      if (block.getFieldValue('OP') === 'POWER') {
        return [`pow(${a}, ${b})`, generator.ORDER_FUNCTION_CALL];
      }
      return [`${a} ${tuple[0]} ${b}`, tuple[1]];
    };

    // math_modulo: emit C++ integer modulo
    generator.forBlock['math_modulo'] = function(block: any, generator: any) {
      const a = generator.valueToCode(block, 'DIVIDEND', generator.ORDER_MODULUS) || '0';
      const b = generator.valueToCode(block, 'DIVISOR', generator.ORDER_MODULUS) || '1';
      return [`((int)(${a}) % (int)(${b}))`, generator.ORDER_MODULUS];
    };

    // math_random_int: emit Arduino random()
    generator.forBlock['math_random_int'] = function(block: any, generator: any) {
      const from = generator.valueToCode(block, 'FROM', generator.ORDER_ATOMIC) || '0';
      const to = generator.valueToCode(block, 'TO', generator.ORDER_ATOMIC) || '100';
      compiler.addSetup(`randomSeed(analogRead(0));`);
      return [`random(${from}, ${to} + 1)`, generator.ORDER_FUNCTION_CALL];
    };

    // math_constrain: emit Arduino constrain()
    generator.forBlock['math_constrain'] = function(block: any, generator: any) {
      const val = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || '0';
      const low = generator.valueToCode(block, 'LOW', generator.ORDER_ATOMIC) || '0';
      const high = generator.valueToCode(block, 'HIGH', generator.ORDER_ATOMIC) || '100';
      return [`constrain(${val}, ${low}, ${high})`, generator.ORDER_FUNCTION_CALL];
    };

    // text_join: emit Arduino String concatenation (handles mutator N-inputs)
    generator.forBlock['text_join'] = function(block: any, generator: any) {
      const itemCount = block.itemCount_ || 0;
      if (itemCount === 0) return ['""', generator.ORDER_ATOMIC];
      if (itemCount === 1) {
        const item = generator.valueToCode(block, 'ADD0', generator.ORDER_ATOMIC) || '""';
        return [`String(${asCppString(item)})`, generator.ORDER_FUNCTION_CALL];
      }
      const parts: string[] = [];
      for (let i = 0; i < itemCount; i++) {
        const item = generator.valueToCode(block, 'ADD' + i, generator.ORDER_ATOMIC) || '""';
        parts.push(`String(${asCppString(item)})`);
      }
      return [parts.join(' + '), generator.ORDER_ADDITION];
    };

    // text_print: emit Serial.println() instead of window.alert()
    generator.forBlock['text_print'] = function(block: any, generator: any) {
      let msg = generator.valueToCode(block, 'TEXT', generator.ORDER_ATOMIC) || '""';
      msg = asCppString(msg);
      return `Serial.println(${msg});\n`;
    };

    // text_length: emit Arduino String.length()
    generator.forBlock['text_length'] = function(block: any, generator: any) {
      const text = generator.valueToCode(block, 'VALUE', generator.ORDER_ATOMIC) || '""';
      return [`String(${asCppString(text)}).length()`, generator.ORDER_FUNCTION_CALL];
    };

    // ─── Procedure/Function blocks ─────────────────────────────────────────────

    // procedures_defnoreturn: void function definition
    generator.forBlock['procedures_defnoreturn'] = function(block: any, generator: any) {
      const funcName = idSafe(block.getFieldValue('NAME') || 'myFunction');
      const args = block.arguments_ || [];
      const params = args.map((a: string) => `String ${idSafe(a)}`).join(', ');
      const branch = generator.statementToCode(block, 'STACK');
      compiler.addGlobal(`void ${funcName}(${params});`);
      compiler.addGlobal(`void ${funcName}(${params}) {\n${branch}}`);
      return '';
    };

    // procedures_defreturn: function with return value
    generator.forBlock['procedures_defreturn'] = function(block: any, generator: any) {
      const funcName = idSafe(block.getFieldValue('NAME') || 'myFunction');
      const args = block.arguments_ || [];
      const params = args.map((a: string) => `String ${idSafe(a)}`).join(', ');
      const branch = generator.statementToCode(block, 'STACK');
      const retVal = generator.valueToCode(block, 'RETURN', generator.ORDER_ATOMIC) || '""';
      compiler.addGlobal(`String ${funcName}(${params});`);
      compiler.addGlobal(`String ${funcName}(${params}) {\n${branch}  return ${asCppString(retVal)};\n}`);
      return '';
    };

    // procedures_callnoreturn: call void function
    generator.forBlock['procedures_callnoreturn'] = function(block: any, generator: any) {
      const funcName = idSafe(block.getFieldValue('NAME') || 'myFunction');
      const args = block.arguments_ || [];
      const params = args.map((_: string, i: number) => {
        const val = generator.valueToCode(block, 'ARG' + i, generator.ORDER_ATOMIC) || '""';
        return asCppString(val);
      }).join(', ');
      return `${funcName}(${params});\n`;
    };

    // procedures_callreturn: call function with return value
    generator.forBlock['procedures_callreturn'] = function(block: any, generator: any) {
      const funcName = idSafe(block.getFieldValue('NAME') || 'myFunction');
      const args = block.arguments_ || [];
      const params = args.map((_: string, i: number) => {
        const val = generator.valueToCode(block, 'ARG' + i, generator.ORDER_ATOMIC) || '""';
        return asCppString(val);
      }).join(', ');
      return [`${funcName}(${params})`, generator.ORDER_FUNCTION_CALL];
    };

    // ─── End of built-in block overrides ───────────────────────────────────────

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
      return `pinMode(${pin}, ${mode});\n`;
    };

    generator.forBlock['timing_delay'] = function(block: any, generator: any) {
      const ms = generator.valueToCode(block, 'MS', generator.ORDER_ATOMIC) || '1000';
      return `delay(${ms});\n`;
    };

    generator.forBlock['serial_print'] = function(block: any, generator: any) {
      let text = generator.valueToCode(block, 'TEXT', generator.ORDER_ATOMIC) || '""';
      const mode = block.getFieldValue('MODE');
      text = asCppString(text);
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
