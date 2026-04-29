import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

/**
 * Architecture-specific tensor arena sizes (in KB).
 * Image models need large arenas (input tensor alone = 96*96*3 = 27KB).
 * Sensor models need much smaller arenas.
 */
const ARENA_SIZES: Record<string, number> = {
  "mobilenet_v1":     100,  // 96x96x3 input + intermediate activations
  "face_recognition": 100,  // 96x96x3 input + MobileNetV2 backbone
  "fomo":              80,  // 96x96x3 input + strided conv heatmaps
  "cnn_1d_mfcc":       16,  // windowed 1D sensor data
  "ds_cnn":            16,  // windowed 1D sensor data
  "cnn_1d_imu":        12,  // smaller IMU windows
  "autoencoder":        8,  // small dense-only network
  "autoencoder_tiny":   4,  // tiny dense-only network
};

export function generateMLBlock(Blockly: any, architecture: string, modelName: string, labels: string[]) {
  const blockId = `ml_model_${architecture.toLowerCase().replace(/ /g, "_")}`;
  const safeModelName = architecture.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const arenaKb = ARENA_SIZES[architecture] || 16;

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
    // ── Platform-aware TFLite includes ──
    // @ts-ignore
    const board = getBoardConfig(compiler.boardId);
    if (board.platform === "esp32") {
      compiler.addInclude(`#include <TensorFlowLite_ESP32.h>`);
    } else {
      // Arduino boards (Nano ESP32, R4 WiFi) use Arduino_TensorFlowLite
      compiler.addInclude(`#include <TensorFlowLite.h>`);
    }
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
    // Arena size is architecture-aware to avoid AllocateTensors() failures
    compiler.addGlobal(`
// ── TFLite Micro inference for: ${modelName} ──
constexpr int kTensorArenaSize_${safeModelName} = ${arenaKb} * 1024;
alignas(16) uint8_t tensor_arena_${safeModelName}[kTensorArenaSize_${safeModelName}];

const char* labels_${safeModelName}[] = { ${labelsArr} };
const int numLabels_${safeModelName} = ${numLabels};

String runInference_${blockId}() {
  const tflite::Model* model = tflite::GetModel(${safeModelName}_model_data);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    return "ERR:schema";
  }

  tflite::AllOpsResolver resolver;
  tflite::MicroInterpreter interpreter(model, resolver, tensor_arena_${safeModelName}, kTensorArenaSize_${safeModelName});
  if (interpreter.AllocateTensors() != kTfLiteOk) {
    return "ERR:alloc";
  }

  // Fill input tensor with sensor/image data
  TfLiteTensor* input = interpreter.input(0);
  // TODO: Copy your input data into the input tensor
  // For image models: flatten pixel data into input->data.int8[]
  // For IMU models: copy accelerometer/gyro readings into input->data.int8[]

  if (interpreter.Invoke() != kTfLiteOk) {
    return "ERR:invoke";
  }

  // Parse output — INT8 quantized output requires dequantization
  TfLiteTensor* output = interpreter.output(0);
  int maxIndex = 0;
  float maxVal = -1e9;

  // Handle both INT8 (quantized) and FLOAT32 output tensors
  if (output->type == kTfLiteInt8) {
    float scale = output->params.scale;
    int32_t zero_point = output->params.zero_point;
    for (int i = 0; i < numLabels_${safeModelName}; i++) {
      float val = (output->data.int8[i] - zero_point) * scale;
      if (val > maxVal) {
        maxVal = val;
        maxIndex = i;
      }
    }
  } else {
    // Float32 fallback (dynamic-range quantization)
    for (int i = 0; i < numLabels_${safeModelName}; i++) {
      if (output->data.f[i] > maxVal) {
        maxVal = output->data.f[i];
        maxIndex = i;
      }
    }
  }

  return String(labels_${safeModelName}[maxIndex]);
}
`);
    
    return [`runInference_${blockId}()`, generator.ORDER_FUNCTION_CALL];
  };

  return blockId;
}
