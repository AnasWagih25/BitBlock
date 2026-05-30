import { MARKETPLACE_EXAMPLES } from "../blocks/marketplaceExamples";
import { ArduinoCompiler } from "../compiler/assembler";
import * as Blockly from "blockly";
import { defineCoreBlocks } from "../blocks/core";
import { defineAllLibraryBlocks } from "../libraries";


// Mock environment for headless Blockly
import { JSDOM } from "jsdom";
const dom = new JSDOM(`<!DOCTYPE html><body><div id="blocklyDiv"></div></body>`);
(global as any).window = dom.window;
(global as any).document = dom.window.document;
if (!(Blockly as any).javascriptGenerator) {
  (Blockly as any).javascriptGenerator = {
    forBlock: {},
    ORDER_ATOMIC: 0,
    ORDER_FUNCTION_CALL: 1,
    ORDER_MULTIPLICATION: 2,
    workspaceToCode: () => ""
  };
}


// Initialize blocks
// Initialize blocks
defineCoreBlocks(Blockly);
defineAllLibraryBlocks(Blockly);


const compiler = new ArduinoCompiler();

function testExamples() {
  const workspace = new Blockly.Workspace();
  const errors: string[] = [];

  for (const example of MARKETPLACE_EXAMPLES) {
    try {
      workspace.clear();
      Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(example.blocksXml), workspace);
      
      compiler.init(example.boardId);
      const generator = Blockly.JavaScript || (Blockly as any).javascriptGenerator;
      const mainCode = generator.workspaceToCode(workspace);
      const cppCode = compiler.assemble(mainCode);
      
      console.log(`\n==========================================`);
      console.log(`Example: ${example.name}`);
      console.log(`==========================================`);
      console.log(cppCode);
      
      // Basic checks for "undefined" or NaN or JS artifacts
      if (cppCode.includes("undefined")) {
        errors.push(`[${example.name}] Contains 'undefined'`);
      }
      if (cppCode.includes("NaN")) {
        errors.push(`[${example.name}] Contains 'NaN'`);
      }
      if (cppCode.includes("var ")) {
        errors.push(`[${example.name}] Contains JS 'var'`);
      }
      if (cppCode.includes("function ")) {
        errors.push(`[${example.name}] Contains JS 'function'`);
      }
      
    } catch (e: any) {
      errors.push(`[${example.name}] Exception: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.error("\nERRORS FOUND:");
    errors.forEach(e => console.error(e));
  } else {
    console.log("\nNo obvious JS artifacts or exceptions found.");
  }
}

testExamples();
