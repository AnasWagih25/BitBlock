import { compiler } from "../compiler/assembler";

export function generateMLBlock(Blockly: any, modelDocId: string, architecture: string, customName: string, labels: string[]) {
  const blockId = `ml_model_${modelDocId}`;
  const safeModelName = modelDocId.toLowerCase().replace(/[^a-z0-9]/g, "_");

  Blockly.Blocks[blockId] = {
    init() {
      this.appendDummyInput()
          .appendField(`🤖 Run Model: ${customName}`);
      this.setOutput(true, "String");
      this.setColour("#9D27DE");
      this.setTooltip(`Runs TFLite inference for ${customName} (${architecture})`);
    }
  };

  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;
  
  generator.forBlock[blockId] = function() {
    // ── TFLite Micro includes ──
    compiler.addInclude(`#include <TensorFlowLite_ESP32.h>`);
    compiler.addInclude(`#include "tensorflow/lite/micro/all_ops_resolver.h"`);
    compiler.addInclude(`#include "tensorflow/lite/micro/micro_interpreter.h"`);
    compiler.addInclude(`#include "tensorflow/lite/schema/schema_generated.h"`);
    compiler.addInclude(`#include "${safeModelName}_model_data.h"  // Generated from .tflite`);

    // ── Label array ──
    const labelsArr = labels.length > 0
      ? labels.map(l => `"${l}"`).join(", ")
      : `"class_0", "class_1"`;
    const numLabels = labels.length > 0 ? labels.length : 2;

    // ── Tensor arena + inference boilerplate ──
    compiler.addGlobal(`
// ── TFLite Micro inference for: ${customName} ──
constexpr int kTensorArenaSize_${safeModelName} = 8 * 1024;
uint8_t tensor_arena_${safeModelName}[kTensorArenaSize_${safeModelName}];

const char* labels_${safeModelName}[] = { ${labelsArr} };
const int numLabels_${safeModelName} = ${numLabels};

String runInference_${blockId}() {
  const tflite::Model* model = tflite::GetModel(${safeModelName}_model_data);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    return "ERR:schema";
  }

  tflite::AllOpsResolver resolver;
  tflite::MicroInterpreter interpreter(model, resolver, tensor_arena_${safeModelName}, kTensorArenaSize_${safeModelName});
  interpreter.AllocateTensors();

  // Fill input tensor with sensor/image data
  TfLiteTensor* input = interpreter.input(0);
  // TODO: Copy your input data into input->data.f[] or input->data.int8[]
  // For image models: flatten pixel data into the input tensor
  // For IMU models: copy accelerometer/gyro readings

  if (interpreter.Invoke() != kTfLiteOk) {
    return "ERR:invoke";
  }

  // Parse output — find class with highest confidence
  TfLiteTensor* output = interpreter.output(0);
  int maxIndex = 0;
  float maxVal = output->data.f[0];
  for (int i = 1; i < numLabels_${safeModelName}; i++) {
    if (output->data.f[i] > maxVal) {
      maxVal = output->data.f[i];
      maxIndex = i;
    }
  }

  return String(labels_${safeModelName}[maxIndex]);
}
`);
    
    return [`runInference_${blockId}()`, generator.ORDER_FUNCTION_CALL];
  };

  return blockId;
}
