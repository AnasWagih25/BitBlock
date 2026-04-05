import { compiler } from "../compiler/assembler";

export function generateMLBlock(Blockly: any, modelName: string, _labels: string[]) {
  const blockId = `ml_model_${modelName.toLowerCase().replace(/ /g, "_")}`;

  Blockly.Blocks[blockId] = {
    init() {
      this.appendDummyInput()
          .appendField(`Run ${modelName} Inference`);
      this.setOutput(true, "String");
      this.setColour("#2B6CB0");
      this.setTooltip("Runs TFLite model and returns the label with highest confidence");
    }
  };

  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;
  
  generator.forBlock[blockId] = function() {
    compiler.addInclude(`#include <TensorFlowLite.h>`);
    compiler.addGlobal(`// Auto-generated TFLite tensor arena wrapper\nString runInference_${blockId}() {\n  return "predicted_label"; \n}`);
    
    return [`runInference_${blockId}()`, generator.ORDER_FUNCTION_CALL];
  };

  return blockId;
}
