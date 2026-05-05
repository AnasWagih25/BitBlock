import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";

/**
 * Architecture-specific tensor arena sizes (in KB).
 * Image models need large arenas (input tensor alone = 96*96*3 = 27KB).
 * Sensor models need much smaller arenas.
 */
const ARENA_SIZES: Record<string, number> = {
  "mobilenet_v1":     120,  // 96x96x3 input + MobileNetV1 intermediate activations
  "face_recognition": 140,  // 96x96x3 input + MobileNetV2 backbone + embedding head
  "fomo":              90,  // 96x96x3 input + strided conv heatmaps
  "cnn_1d_mfcc":       16,  // windowed 1D sensor data
  "ds_cnn":            16,  // windowed 1D sensor data
  "cnn_1d_imu":        12,  // smaller IMU windows
  "autoencoder":        8,  // small dense-only network
  "autoencoder_tiny":   4,  // tiny dense-only network
};

/** Which architectures are image-based and need camera capture code */
const IMAGE_ARCHS = new Set(["mobilenet_v1", "face_recognition", "fomo"]);
/** Anomaly detection architectures (reconstruction-based, not classification) */
const ANOMALY_ARCHS = new Set(["autoencoder", "autoencoder_tiny"]);

export function generateMLBlock(Blockly: any, architecture: string, modelName: string, labels: string[]) {
  const blockId = `ml_model_${architecture.toLowerCase().replace(/ /g, "_")}`;
  const safeModelName = architecture.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const arenaKb = ARENA_SIZES[architecture] || 16;
  const isImage = IMAGE_ARCHS.has(architecture);
  const isAnomaly = ANOMALY_ARCHS.has(architecture);
  const isFomo = architecture === "fomo";

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

    // Camera includes for image models on boards with camera
    if (isImage && board.camera) {
      compiler.addInclude(`#include "esp_camera.h"`);
    }

    // ── Label array ──
    const labelsArr = labels.length > 0
      ? labels.map(l => `"${l}"`).join(", ")
      : `"class_0", "class_1"`;
    const numLabels = labels.length > 0 ? labels.length : 2;

    // ── Input data acquisition code ──
    let inputDataCode = "";
    if (isImage && board.camera) {
      inputDataCode = `
  // Capture a frame from ESP32-CAM
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return "ERR:cam";
  
  // Map pixel data into the quantized input tensor
  int input_size = input->bytes;
  int fb_size = fb->len;
  for (int i = 0; i < input_size && i < fb_size; i++) {
    float pixel = (float)fb->buf[i] / 255.0f;
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(pixel / input->params.scale + input->params.zero_point);
    } else {
      input->data.f[i] = pixel;
    }
  }
  esp_camera_fb_return(fb);`;
    } else if (isImage) {
      inputDataCode = `
  // TODO: Read image data from your camera/sensor into the input tensor
  // For each pixel channel value [0,255]:
  //   float normalized = pixel_value / 255.0f;
  //   if (input->type == kTfLiteInt8)
  //     input->data.int8[i] = (int8_t)(normalized / input->params.scale + input->params.zero_point);
  //   else
  //     input->data.f[i] = normalized;
  // Input expects 96x96x3 = 27648 values`;
    } else if (isAnomaly) {
      inputDataCode = `
  // Read sensor data for anomaly detection
  int input_size = input->bytes;
  for (int i = 0; i < input_size; i++) {
    float reading = 0.0f; // TODO: Replace with actual sensor readings
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(reading / input->params.scale + input->params.zero_point);
    } else {
      input->data.f[i] = reading;
    }
  }`;
    } else {
      inputDataCode = `
  // Read IMU/audio sensor data into the input tensor
  int input_size = input->bytes;
  for (int i = 0; i < input_size; i++) {
    float reading = 0.0f; // TODO: Read from IMU (ax, ay, az, gx, gy, gz)
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(reading / input->params.scale + input->params.zero_point);
    } else {
      input->data.f[i] = reading;
    }
  }`;
    }

    // ── Output parsing code ──
    let outputParseCode = "";
    if (isFomo) {
      outputParseCode = `
  // FOMO output: spatial grid of class heatmaps — find strongest detection
  TfLiteTensor* output = interpreter.output(0);
  int total_elements = 1;
  for (int d = 0; d < output->dims->size; d++) total_elements *= output->dims->data[d];
  
  int maxIndex = 0;
  float maxVal = -1e9;
  
  if (output->type == kTfLiteInt8) {
    float scale = output->params.scale;
    int32_t zero_point = output->params.zero_point;
    for (int i = 0; i < total_elements; i++) {
      float val = (output->data.int8[i] - zero_point) * scale;
      if (val > maxVal) { maxVal = val; maxIndex = i; }
    }
  } else {
    for (int i = 0; i < total_elements; i++) {
      if (output->data.f[i] > maxVal) { maxVal = output->data.f[i]; maxIndex = i; }
    }
  }

  if (maxVal < 0.28f) return "none";
  int classIdx = maxIndex % numLabels_${safeModelName};
  return String(labels_${safeModelName}[classIdx]) + ":" + String(maxVal, 2);`;
    } else if (isAnomaly) {
      outputParseCode = `
  // Anomaly detection: compare reconstruction error against threshold
  TfLiteTensor* output = interpreter.output(0);
  float mse = 0.0f;
  int n = input->bytes;
  
  for (int i = 0; i < n; i++) {
    float in_val, out_val;
    if (input->type == kTfLiteInt8) {
      in_val = (input->data.int8[i] - input->params.zero_point) * input->params.scale;
    } else { in_val = input->data.f[i]; }
    if (output->type == kTfLiteInt8) {
      out_val = (output->data.int8[i] - output->params.zero_point) * output->params.scale;
    } else { out_val = output->data.f[i]; }
    float diff = in_val - out_val;
    mse += diff * diff;
  }
  mse /= (float)n;
  
  // Compare against threshold (adjust based on your training diagnostics)
  if (mse > 0.5f) return "ANOMALY:" + String(mse, 4);
  return "normal:" + String(mse, 4);`;
    } else {
      outputParseCode = `
  // Classification: find the class with highest confidence
  TfLiteTensor* output = interpreter.output(0);
  int maxIndex = 0;
  float maxVal = -1e9;

  if (output->type == kTfLiteInt8) {
    float scale = output->params.scale;
    int32_t zero_point = output->params.zero_point;
    for (int i = 0; i < numLabels_${safeModelName}; i++) {
      float val = (output->data.int8[i] - zero_point) * scale;
      if (val > maxVal) { maxVal = val; maxIndex = i; }
    }
  } else {
    for (int i = 0; i < numLabels_${safeModelName}; i++) {
      if (output->data.f[i] > maxVal) { maxVal = output->data.f[i]; maxIndex = i; }
    }
  }

  return String(labels_${safeModelName}[maxIndex]);`;
    }

    // ── Camera init setup code for image models ──
    let cameraInitCode = "";
    if (isImage && board.camera) {
      cameraInitCode = `
// Call this in setup() to initialize ESP32-CAM
void initCamera_${safeModelName}() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5; config.pin_d1 = 18; config.pin_d2 = 19; config.pin_d3 = 21;
  config.pin_d4 = 36; config.pin_d5 = 39; config.pin_d6 = 34; config.pin_d7 = 35;
  config.pin_xclk = 0; config.pin_pclk = 22; config.pin_vsync = 25;
  config.pin_href = 23; config.pin_sscb_sda = 26; config.pin_sscb_scl = 27;
  config.pin_pwdn = 32; config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_RGB888;
  config.frame_size = FRAMESIZE_96X96;
  config.fb_count = 1;
  esp_camera_init(&config);
}
`;
    }

    // ── Tensor arena + inference boilerplate ──
    compiler.addGlobal(`
// ── TFLite Micro inference for: ${modelName} ──
constexpr int kTensorArenaSize_${safeModelName} = ${arenaKb} * 1024;
alignas(16) uint8_t tensor_arena_${safeModelName}[kTensorArenaSize_${safeModelName}];

const char* labels_${safeModelName}[] = { ${labelsArr} };
const int numLabels_${safeModelName} = ${numLabels};
${cameraInitCode}
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

  TfLiteTensor* input = interpreter.input(0);
${inputDataCode}

  if (interpreter.Invoke() != kTfLiteOk) {
    return "ERR:invoke";
  }
${outputParseCode}
}
`);
    
    return [`runInference_${blockId}()`, generator.ORDER_FUNCTION_CALL];
  };

  return blockId;
}
