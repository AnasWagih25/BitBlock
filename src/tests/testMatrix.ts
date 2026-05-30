import * as Blockly from "blockly";
import * as Ja from "blockly/javascript";
import { JSDOM } from "jsdom";
import { validateWorkspace } from "../compiler/validator";
import { ArduinoCompiler } from "../compiler/assembler";
import { defineCoreBlocks } from "../blocks/core";
import { defineSensorBlocks } from "../libraries/Sensors";
import { defineMotorBlocks } from "../libraries/Motors";
import { defineCommunicationBlocks } from "../libraries/Communication";
import { defineDisplayBlocks } from "../libraries/Display";

const dom = new JSDOM(`<!DOCTYPE html><body><div id="blocklyDiv"></div></body>`);
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).window.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(global as any).window.cancelAnimationFrame = (id: any) => clearTimeout(id);

// No mock needed here because core.ts now imports it directly

defineCoreBlocks(Blockly);
defineSensorBlocks(Blockly);
defineMotorBlocks(Blockly);
defineCommunicationBlocks(Blockly);
defineDisplayBlocks(Blockly);

const compiler = new ArduinoCompiler('arduino-uno-r3');

function runTest(name: string, xmlString: string) {
  console.log(`\\n--- Test: ${name} ---`);
  const workspace = new Blockly.Workspace(new Blockly.Options({}));
  try {
    const xml = Blockly.utils.xml.textToDom(xmlString);
    Blockly.Xml.domToWorkspace(xml, workspace);
    
    compiler.init('arduino-uno-r3');
    const { errors } = validateWorkspace(workspace);
    
    if (errors.length > 0) {
      console.log("Validation Errors Caught:");
      errors.forEach(e => console.log(" - " + e));
    } else {
      console.log("Validation Passed.");
      const gen = (Blockly as any).javascriptGenerator || Blockly.JavaScript;
      const code = gen.workspaceToCode(workspace);
      const wrapped = compiler.assemble(code);
      console.log("Generated C++:\\n" + wrapped.trim());
    }
  } catch (e: any) {
    console.error("Exception:", e.message);
  }
}

// 1. Missing input on any block (Servo without PIN)
runTest("Missing Input", `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="servo_init"></block>
</xml>
`);

// 2. Same pin, two different blocks (Servo and DHT11 on PIN 9)
runTest("Pin Conflict (Different Blocks)", `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="servo_init">
    <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
    <next>
      <block type="dht11_init">
        <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
      </block>
    </next>
  </block>
</xml>
`);

// 3. Same pin, two identical blocks (Two Servos on PIN 9)
runTest("Pin Conflict (Identical Blocks)", `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="servo_init">
    <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
    <next>
      <block type="servo_init">
        <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
      </block>
    </next>
  </block>
</xml>
`);

// 4. Two correctly configured identical blocks (Two Servos on 9 and 10)
runTest("No Duplicates (Same Block Type, Different Pins)", `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="servo_init">
    <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
    <next>
      <block type="servo_init">
        <value name="PIN"><block type="math_number"><field name="NUM">10</field></block></value>
      </block>
    </next>
  </block>
</xml>
`);

// 5. Float block with int input (Servo Write Angle with 90)
runTest("Type Discipline (Float Block with Int Input)", `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="a4988_stepper_set_speed">
    <value name="RPM"><block type="math_number"><field name="NUM">60</field></block></value>
  </block>
</xml>
`);

// 6. Descending controls_for
runTest("Descending controls_for", `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="controls_for">
    <field name="VAR">i</field>
    <value name="FROM"><block type="math_number"><field name="NUM">180</field></block></value>
    <value name="TO"><block type="math_number"><field name="NUM">0</field></block></value>
    <value name="BY"><block type="math_number"><field name="NUM">1</field></block></value>
    <statement name="DO">
      <block type="servo_write_angle">
        <value name="PIN"><block type="math_number"><field name="NUM">9</field></block></value>
        <value name="ANGLE"><block type="variables_get"><field name="VAR">i</field></block></value>
      </block>
    </statement>
  </block>
</xml>
`);
