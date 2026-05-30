/**
 * End-to-end pipeline test: loads a real marketplace example XML into a
 * headless Blockly workspace and runs the full generation pipeline
 * (validate → workspaceToCode → assemble → formatCode).
 */
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import { JSDOM } from "jsdom";
import { validateWorkspace } from "../compiler/validator";
import { compiler } from "../compiler/assembler";
import { defineCoreBlocks } from "../blocks/core";
import { defineAllLibraryBlocks } from "../libraries";
import { MARKETPLACE_EXAMPLES } from "../blocks/marketplaceExamples";

// ── DOM shims ────────────────────────────────────────────────────────────────
const dom = new JSDOM(`<!DOCTYPE html><body><div id="blocklyDiv"></div></body>`);
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).window.requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(global as any).window.cancelAnimationFrame = (id: any) => clearTimeout(id);

// ── Register all block definitions ──────────────────────────────────────────
defineCoreBlocks(Blockly);
defineAllLibraryBlocks(Blockly);

// ── Full pipeline run for a given example ───────────────────────────────────
function runPipeline(exampleName: string) {
  const example = MARKETPLACE_EXAMPLES.find(e => e.name === exampleName);
  if (!example) { console.error(`Example "${exampleName}" not found`); return; }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  EXAMPLE: ${example.name}`);
  console.log(`  BOARD:   ${example.boardId}`);
  console.log(`${"═".repeat(60)}\n`);

  const workspace = new Blockly.Workspace();
  const xml = Blockly.utils.xml.textToDom(example.blocksXml);
  Blockly.Xml.domToWorkspace(xml, workspace);

  // Step 1: Validate
  compiler.init(example.boardId);

  const { errors } = validateWorkspace(workspace as any);
  if (errors.length > 0) {
    console.log("❌ VALIDATION FAILED:");
    errors.forEach(e => console.log(`   • ${e}`));
    return;
  }
  console.log("✅ Validation passed");
  console.log(`Blocks in workspace: ${workspace.getAllBlocks().length}`);

  // Step 2: Generate raw code
  try {
    const rawCode = javascriptGenerator.workspaceToCode(workspace);
    console.log("\n--- Raw generator output ---");
    console.log(rawCode);

    // Step 3: Assemble + format
    const finalCode = compiler.assemble(rawCode);
    console.log("\n--- Final assembled & formatted C++ ---");
    console.log(finalCode);
  } catch (e: any) {
    console.error("Generator Error:", e);
  }
}

// Run the Servo Sweep example (has both ascending and descending for-loops)
runPipeline("Ultrasonic Distance Alarm");
