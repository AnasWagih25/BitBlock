import { compiler } from "../compiler/assembler";
import { getBoardConfig } from "../boards/registry";
import { ML_ARCHITECTURES } from "../boards/MLCapabilities";

/**
 * Tensor arena sizes (KB) — sized for INT8 quantized models.
 * Image: 96×96×3 input = 27KB + activations.
 * Sensor: windowed 1D data, much smaller.
 */
const ARENA_SIZES: Record<string, number> = {
  "mobilenet_v1":       1024,   // Increased to 1024 to fix AllocateTensors failure
  "mobilenet_v2":       1024,   // Increased to 1024 to fix AllocateTensors failure
  "efficientnet_lite0": 1024,
  "face_recognition":   400,
  "fomo":               150,
  "ssd_mobilenet_v2":   600,
  "cnn_1d_mfcc":         16,
  "ds_cnn":              16,
  "cnn_1d_imu":          12,
  "autoencoder":          8,
  "autoencoder_tiny":     4,
};

const IMAGE_ARCHS = new Set(["mobilenet_v1", "mobilenet_v2", "efficientnet_lite0", "face_recognition", "fomo", "ssd_mobilenet_v2"]);
const ANOMALY_ARCHS = new Set(["autoencoder", "autoencoder_tiny"]);
const AUDIO_ARCHS = new Set(["cnn_1d_mfcc", "ds_cnn"]);
const IMU_ARCHS = new Set(["cnn_1d_imu"]);

/**
 * Ops needed per architecture for MicroMutableOpResolver.
 * Using exact ops instead of AllOpsResolver saves 50-100KB flash.
 */
const ARCH_OPS: Record<string, string[]> = {
  "mobilenet_v1":       ["DEPTHWISE_CONV_2D","CONV_2D","AVERAGE_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","ADD","PAD","MUL","QUANTIZE","DEQUANTIZE"],
  "mobilenet_v2":       ["DEPTHWISE_CONV_2D","CONV_2D","AVERAGE_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","ADD","PAD","MUL","QUANTIZE","DEQUANTIZE","MEAN"],
  "efficientnet_lite0": ["DEPTHWISE_CONV_2D","CONV_2D","AVERAGE_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","ADD","PAD","MUL","QUANTIZE","DEQUANTIZE","MEAN"],
  "face_recognition":   ["DEPTHWISE_CONV_2D","CONV_2D","AVERAGE_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","ADD","PAD","MUL","QUANTIZE","DEQUANTIZE","MEAN"],
  "fomo":               ["DEPTHWISE_CONV_2D","CONV_2D","RESHAPE","LOGISTIC","FULLY_CONNECTED","PAD","MUL","QUANTIZE","DEQUANTIZE"],
  "ssd_mobilenet_v2":   ["DEPTHWISE_CONV_2D","CONV_2D","AVERAGE_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","ADD","PAD","MUL","QUANTIZE","DEQUANTIZE","MEAN","CONCATENATION","LOGISTIC"],
  "cnn_1d_mfcc":        ["CONV_2D","DEPTHWISE_CONV_2D","MAX_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","QUANTIZE","DEQUANTIZE"],
  "ds_cnn":             ["CONV_2D","DEPTHWISE_CONV_2D","MAX_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","AVERAGE_POOL_2D","QUANTIZE","DEQUANTIZE","MEAN"],
  "cnn_1d_imu":         ["CONV_2D","DEPTHWISE_CONV_2D","MAX_POOL_2D","RESHAPE","SOFTMAX","FULLY_CONNECTED","AVERAGE_POOL_2D","QUANTIZE","DEQUANTIZE"],
  "autoencoder":        ["FULLY_CONNECTED","RESHAPE","QUANTIZE","DEQUANTIZE"],
  "autoencoder_tiny":   ["FULLY_CONNECTED","RESHAPE","QUANTIZE","DEQUANTIZE"],
};

/**
 * Exact TFLite Micro API method names — do NOT auto-generate these.
 * Generated names like "AddConv2d" are WRONG (must be "AddConv2D" with capital D).
 */
const OP_METHOD_NAMES: Record<string, string> = {
  "CONV_2D":             "AddConv2D",
  "DEPTHWISE_CONV_2D":   "AddDepthwiseConv2D",
  "AVERAGE_POOL_2D":     "AddAveragePool2D",
  "MAX_POOL_2D":         "AddMaxPool2D",
  "RESHAPE":             "AddReshape",
  "SOFTMAX":             "AddSoftmax",
  "FULLY_CONNECTED":     "AddFullyConnected",
  "ADD":                 "AddAdd",
  "MUL":                 "AddMul",
  "PAD":                 "AddPad",
  "MEAN":                "AddMean",
  "QUANTIZE":            "AddQuantize",
  "DEQUANTIZE":          "AddDequantize",
  "LOGISTIC":            "AddLogistic",
  "CONCATENATION":       "AddConcatenation",
  "RELU":                "AddRelu",
  "RELU6":               "AddRelu6",
};

function getOpResolverCode(arch: string, safeName: string): string {
  const ops = ARCH_OPS[arch];
  if (!ops) {
    return `  tflite::AllOpsResolver resolver_${safeName};`;
  }
  const lines = [
    `  static tflite::MicroMutableOpResolver<${ops.length}> resolver_${safeName};`,
    `  static bool ops_added_${safeName} = false;`,
    `  if (!ops_added_${safeName}) {`,
  ];
  for (const op of ops) {
    const method = OP_METHOD_NAMES[op];
    if (!method) {
      // Fallback: AllOpsResolver if we encounter an unknown op
      return `  tflite::AllOpsResolver resolver_${safeName};`;
    }
    lines.push(`    resolver_${safeName}.${method}();`);
  }
  lines.push(`    ops_added_${safeName} = true;`);
  lines.push(`  }`);
  return lines.join("\n");
}

function getCameraInitCode(safeName: string, boardId: string): string {
  // AI-Thinker ESP32-CAM pin mapping (most common)
  if (boardId === "esp32-cam") {
    return `
void initCamera_${safeName}() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5; config.pin_d1 = 18; config.pin_d2 = 19; config.pin_d3 = 21;
  config.pin_d4 = 36; config.pin_d5 = 39; config.pin_d6 = 34; config.pin_d7 = 35;
  config.pin_xclk = 0; config.pin_pclk = 22; config.pin_vsync = 25;
  config.pin_href = 23; config.pin_sccb_sda = 26; config.pin_sccb_scl = 27;
  config.pin_pwdn = 32; config.pin_reset = -1;
  config.xclk_freq_hz = 10000000;  // 10MHz for stability
  config.pixel_format = PIXFORMAT_RGB565;  // Fast DMA, convert inline
  config.frame_size = FRAMESIZE_QQVGA;  // 160x120 — crop to 96x96
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_LATEST;  // Always get freshest frame
  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("ERR: Camera init failed");
    return;
  }
  // Let sensor AGC/AEC stabilize
  delay(500);
  // Discard first few frames (often corrupted)
  for (int i = 0; i < 3; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
    delay(50);
  }
  Serial.println("Camera ready (RGB565, 160x120)");
}
`;
  }
  // ESP32-S3 DevKitC or similar — no built-in camera, user must wire
  return `
// Configure your camera pins for ${boardId} (AI Thinker ESP32-CAM defaults)
void initCamera_${safeName}() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sccb_sda = 26;
  config.pin_sccb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 10000000;  // 10MHz for stability
  config.pixel_format = PIXFORMAT_RGB565;  // Fast DMA, convert inline
  config.frame_size = FRAMESIZE_QQVGA;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_LATEST;
  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("ERR: Camera init failed. Is it connected properly?");
    return;
  }
  delay(500);
  for (int i = 0; i < 3; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
    delay(50);
  }
  Serial.println("Camera ready (RGB565, 160x120)");
}
`;
}

/**
 * Validates that the model architecture can physically fit on the target board.
 * Returns an error message string if invalid, or null if OK.
 */
export function validateModelFitsBoard(architecture: string, boardId: string): string | null {
  const board = getBoardConfig(boardId);
  const archDef = ML_ARCHITECTURES[architecture];
  if (!archDef) return null; // Unknown arch, skip validation
  const arenaKb = ARENA_SIZES[architecture] || 16;
  const totalNeededKb = archDef.baseSizeKb + arenaKb;
  const totalAvailableKb = board.ram + board.psram;
  if (archDef.baseSizeKb > board.maxModelSizeKb) {
    return `Model "${archDef.name}" (${archDef.baseSizeKb}KB) exceeds ${board.name} max model budget (${board.maxModelSizeKb}KB). Choose a smaller model or a more capable board.`;
  }
  if (totalNeededKb > totalAvailableKb) {
    return `Model "${archDef.name}" needs ~${totalNeededKb}KB (model+arena) but ${board.name} only has ${totalAvailableKb}KB total RAM. Choose a smaller alpha/model or use a board with PSRAM.`;
  }
  if (IMAGE_ARCHS.has(architecture) && !board.camera && !ANOMALY_ARCHS.has(architecture)) {
    const isImageOnly = ["mobilenet_v1","mobilenet_v2","efficientnet_lite0","face_recognition","fomo","ssd_mobilenet_v2"].includes(architecture);
    if (isImageOnly && !board.camera) {
      // Allow it but warn — user might have external camera wired
    }
  }
  return null;
}

export function generateMLBlock(Blockly: any, architecture: string, modelName: string, labels: string[], trainingDiagnostics?: any, jobId?: string) {
  const blockId = `ml_model_${architecture.toLowerCase().replace(/ /g, "_")}`;
  const safeName = architecture.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const arenaKb = ARENA_SIZES[architecture] || 16;
  const isImage = IMAGE_ARCHS.has(architecture);
  const isAnomaly = ANOMALY_ARCHS.has(architecture);
  const isAudio = AUDIO_ARCHS.has(architecture);
  const isIMU = IMU_ARCHS.has(architecture);
  const isFomo = architecture === "fomo";
  const isSSD = architecture === "ssd_mobilenet_v2";

  Blockly.Blocks[blockId] = {
    init() {
      const shortId = jobId ? ` (${jobId.slice(0, 6)})` : "";
      this.appendDummyInput().appendField(`Run ${modelName}${shortId} Inference`);
      this.setOutput(true, "String");
      this.setColour("#2B6CB0");
      this.setTooltip(`Runs TFLite model and returns the label with highest confidence.\nVersion: ${jobId || "latest"}\nLabels: ${labels.join(", ")}`);
    }
  };

  const generator = Blockly.JavaScript || Blockly.javascriptGenerator;

  generator.forBlock[blockId] = function(block: any) {
    const board = getBoardConfig(compiler.boardId);
    
    // C26 FIX: Strict memory validation at code-gen time
    const fitError = validateModelFitsBoard(architecture, board.id);
    if (fitError) {
      compiler.addGlobal(`\n#error "BitBlock ML Error: ${fitError}"\n`);
      return [`"ERR: ${fitError}"`, generator.ORDER_ATOMIC];
    }

    // Treat Arduino Nano ESP32 as ESP32 (it uses an ESP32-S3 chip)
    const isESP32 = board.platform === "esp32" || board.fqbn.includes("esp32");
    const hasCamera = board.camera;
    const hasPSRAM = board.psram > 0;

    // ── Includes ──
    if (isESP32) {
      compiler.addInclude(`#include <TensorFlowLite_ESP32.h>`);
    } else {
      compiler.addInclude(`#include <TensorFlowLite.h>`);
    }
    compiler.addInclude(`#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"`);
    compiler.addInclude(`#include "tensorflow/lite/micro/micro_interpreter.h"`);
    compiler.addInclude(`#include "tensorflow/lite/micro/micro_error_reporter.h"`);
    compiler.addInclude(`#include "tensorflow/lite/schema/schema_generated.h"`);
    compiler.addInclude(`#include "${safeName}_model_data.h"  // Generated .tflite header`);

    if (isImage && hasCamera) {
      compiler.addInclude(`#include "esp_camera.h"`);
    }
    if (hasPSRAM && isESP32) {
      compiler.addInclude(`#include "esp_heap_caps.h"`);
    }

    // ── Labels ──
    const labelsArr = labels.length > 0
      ? labels.map(l => `"${l}"`).join(", ")
      : `"class_0", "class_1"`;
    const numLabels = labels.length > 0 ? labels.length : 2;

    // ── Build inference function + persistent globals ──
    const opResolver = getOpResolverCode(architecture, safeName);

    // Arena allocation: use PSRAM if available for large models
    let arenaDecl: string;
    if (hasPSRAM && isESP32 && arenaKb > 50) {
      arenaDecl = `
constexpr int kArenaSize_${safeName} = ${arenaKb} * 1024;
uint8_t* arena_${safeName} = nullptr;`;
    } else {
      arenaDecl = `
constexpr int kArenaSize_${safeName} = ${arenaKb} * 1024;
alignas(16) static uint8_t arena_${safeName}[kArenaSize_${safeName}];`;
    }

    // Camera init for image models
    let camInit = "";
    let camSetup = "";
    if (isImage && hasCamera) {
      camInit = getCameraInitCode(safeName, board.id);
      camSetup = `initCamera_${safeName}();`;
    }

    // ── Input acquisition ──
    let inputCode: string;
    if (isImage && hasCamera) {
      inputCode = `
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) return "ERR:cam";
  // Crop center 96x96 from 160x120 RGB565 QQVGA frame
  int src_w = fb->width, src_h = fb->height;
  int ox = (src_w - 96) / 2, oy = (src_h - 96) / 2;
  // Pre-compute quantization params for INT8 (avoid per-pixel float ops)
  float scale = input->params.scale;
  int32_t zp = input->params.zero_point;
  bool isInt8 = (input->type == kTfLiteInt8);
  for (int row = 0; row < 96; row++) {
    for (int col = 0; col < 96; col++) {
      // RGB565: 2 bytes per pixel, big-endian packed [RRRRRGGGGGGBBBBB]
      int si = ((oy + row) * src_w + (ox + col)) * 2;
      uint16_t px = (fb->buf[si] << 8) | fb->buf[si + 1];
      // Extract and scale to 0-255
      uint8_t r = ((px >> 11) & 0x1F) << 3;  // 5-bit -> 8-bit
      uint8_t g = ((px >> 5) & 0x3F) << 2;   // 6-bit -> 8-bit
      uint8_t b = (px & 0x1F) << 3;           // 5-bit -> 8-bit
      int di = (row * 96 + col) * 3;
      if (isInt8) {
        // Integer-only quantization: q = clamp(round(pixel/255/scale) + zp)
        input->data.int8[di + 0] = (int8_t)constrain((int)((float)r / 255.0f / scale + zp), -128, 127);
        input->data.int8[di + 1] = (int8_t)constrain((int)((float)g / 255.0f / scale + zp), -128, 127);
        input->data.int8[di + 2] = (int8_t)constrain((int)((float)b / 255.0f / scale + zp), -128, 127);
      } else {
        input->data.f[di + 0] = r / 255.0f;
        input->data.f[di + 1] = g / 255.0f;
        input->data.f[di + 2] = b / 255.0f;
      }
    }
  }
  esp_camera_fb_return(fb);`;
    } else if (isImage) {
      inputCode = `
  // TODO: Feed 96x96x3 image data into input tensor
  // For each pixel channel [0..255]:
  //   float val = pixel / 255.0f;
  //   input->data.int8[i] = (int8_t)(val / input->params.scale + input->params.zero_point);`;
    } else if (isAnomaly) {
      inputCode = `
  int input_len = input->bytes / sizeof(int8_t);
  for (int i = 0; i < input_len; i++) {
    float reading = 0.0f; // TODO: Replace with actual sensor readings
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(reading / input->params.scale + input->params.zero_point);
    } else { input->data.f[i] = reading; }
  }`;
    } else if (isAudio) {
      inputCode = `
  // Collect audio window and compute MFCC features
  // TODO: Use I2S or analogRead() to capture audio samples,
  // then compute MFCC coefficients and fill the input tensor.
  int input_len = input->bytes / (input->type == kTfLiteInt8 ? 1 : 4);
  for (int i = 0; i < input_len; i++) {
    float feat = 0.0f; // TODO: MFCC feature value
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(feat / input->params.scale + input->params.zero_point);
    } else { input->data.f[i] = feat; }
  }`;
    } else if (isIMU) {
      inputCode = `
  // Collect IMU window: read N frames of [ax, ay, az, gx, gy, gz]
  int input_len = input->bytes / (input->type == kTfLiteInt8 ? 1 : 4);
  for (int i = 0; i < input_len; i++) {
    float reading = 0.0f; // TODO: Read from IMU sensor
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(reading / input->params.scale + input->params.zero_point);
    } else { input->data.f[i] = reading; }
  }`;
    } else {
      inputCode = `
  int input_len = input->bytes / (input->type == kTfLiteInt8 ? 1 : 4);
  for (int i = 0; i < input_len; i++) {
    float reading = 0.0f; // TODO: Sensor reading
    if (input->type == kTfLiteInt8) {
      input->data.int8[i] = (int8_t)(reading / input->params.scale + input->params.zero_point);
    } else { input->data.f[i] = reading; }
  }`;
    }

    // ── Output parsing ──
    let outputCode: string;
    if (isFomo || isSSD) {
      // FOMO/SSD: scan spatial grid for ALL detections above threshold
      outputCode = `
  TfLiteTensor* output = interpreter_${safeName}->output(0);
  // Output shape: [1, grid_h, grid_w, num_classes]
  int gh = output->dims->data[1];
  int gw = output->dims->data[2];
  int nc = output->dims->data[3];
  float sc = 1.0f; int32_t zp = 0;
  bool isQ = (output->type == kTfLiteInt8);
  if (isQ) { sc = output->params.scale; zp = output->params.zero_point; }
  String result = "";
  int detections = 0;
  for (int r = 0; r < gh; r++) {
    for (int c = 0; c < gw; c++) {
      for (int cls = 0; cls < nc && cls < numLabels_${safeName}; cls++) {
        int idx = (r * gw + c) * nc + cls;
        float v = isQ ? (output->data.int8[idx] - zp) * sc : output->data.f[idx];
        if (v > 0.35f) {
          if (detections > 0) result += ";";
          result += String(labels_${safeName}[cls]) + ":" + String(v, 2);
          result += "@" + String(c) + "," + String(r);
          detections++;
          if (detections >= 10) goto done_${safeName};
        }
      }
    }
  }
  done_${safeName}:
  if (detections == 0) return "none";
  return result;`;
    } else if (isAnomaly) {
      const threshold = trainingDiagnostics?.anomalyThreshold ?? trainingDiagnostics?.reconstruction?.threshold_p95 ?? 0.5;
      outputCode = `
  TfLiteTensor* output = interpreter_${safeName}->output(0);
  float mse = 0.0f;
  int n = input->bytes / (input->type == kTfLiteInt8 ? 1 : 4);
  for (int i = 0; i < n; i++) {
    float iv, ov;
    if (input->type == kTfLiteInt8) {
      iv = (input->data.int8[i] - input->params.zero_point) * input->params.scale;
    } else { iv = input->data.f[i]; }
    if (output->type == kTfLiteInt8) {
      ov = (output->data.int8[i] - output->params.zero_point) * output->params.scale;
    } else { ov = output->data.f[i]; }
    float d = iv - ov; mse += d * d;
  }
  mse /= (float)n;
  if (mse > ${threshold.toFixed(4)}f) return "ANOMALY:" + String(mse, 4);
  return "normal:" + String(mse, 4);`;
    } else {
      // Standard classification (including face_recognition)
      outputCode = `
  TfLiteTensor* output = interpreter_${safeName}->output(0);
  int maxIdx = 0; float maxVal = -1e9f;
  if (output->type == kTfLiteInt8) {
    float sc = output->params.scale; int32_t zp = output->params.zero_point;
    for (int i = 0; i < numLabels_${safeName}; i++) {
      float v = (output->data.int8[i] - zp) * sc;
      if (v > maxVal) { maxVal = v; maxIdx = i; }
    }
  } else {
    for (int i = 0; i < numLabels_${safeName}; i++) {
      if (output->data.f[i] > maxVal) { maxVal = output->data.f[i]; maxIdx = i; }
    }
  }
  return String(labels_${safeName}[maxIdx]) + ":" + String(maxVal, 2);`;
    }

    // ── PSRAM arena allocation in setup ──
    let psramSetup = "";
    if (hasPSRAM && isESP32 && arenaKb > 50) {
      psramSetup = `
  Serial.printf("Free heap: %u, PSRAM: %u\\n", ESP.getFreeHeap(), ESP.getFreePsram());
  if (!psramFound()) {
    Serial.println("ERR: PSRAM not detected - check board config");
    return;
  }
  if (!arena_${safeName}) {
    arena_${safeName} = (uint8_t*)heap_caps_malloc(kArenaSize_${safeName}, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!arena_${safeName}) {
      Serial.println("ERR: Arena alloc failed (PSRAM)");
      return;
    }
    Serial.println("Arena allocated in PSRAM");
  }`;
    }

    // ── Emit persistent globals + init-once inference function ──
    compiler.addGlobal(`
// ── TFLite Micro: ${modelName} (persistent interpreter) ──
${arenaDecl}
const char* labels_${safeName}[] = { ${labelsArr} };
const int numLabels_${safeName} = ${numLabels};

static const tflite::Model* model_${safeName} = nullptr;
static tflite::MicroInterpreter* interpreter_${safeName} = nullptr;
static bool ml_ready_${safeName} = false;
${camInit}
void initML_${safeName}() {
  if (ml_ready_${safeName}) return;
${psramSetup}
  model_${safeName} = tflite::GetModel(${safeName}_model_data);
  if (model_${safeName}->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("ERR: TFLite schema mismatch");
    return;
  }
${opResolver}
  static tflite::MicroErrorReporter micro_error_reporter_${safeName};
  static tflite::MicroInterpreter static_interp_${safeName}(
    model_${safeName}, resolver_${safeName}, arena_${safeName}, kArenaSize_${safeName}, &micro_error_reporter_${safeName});
  interpreter_${safeName} = &static_interp_${safeName};
  if (interpreter_${safeName}->AllocateTensors() != kTfLiteOk) {
    Serial.println("ERR: AllocateTensors failed");
    return;
  }
  ${camSetup}
  ml_ready_${safeName} = true;
  Serial.println("ML model initialized: ${modelName}");
}

String runInference_${blockId}() {
  if (!ml_ready_${safeName}) return "ERR:init";
  TfLiteTensor* input = interpreter_${safeName}->input(0);
${inputCode}
  unsigned long t0_${safeName} = millis();
  if (interpreter_${safeName}->Invoke() != kTfLiteOk) return "ERR:invoke";
  unsigned long dt_${safeName} = millis() - t0_${safeName};
  Serial.printf("[ML] Inference: %lums\\n", dt_${safeName});
${outputCode}
}
`);

    // Add setup call (single Serial.begin)
    compiler.addSetup(`Serial.begin(115200);\ndelay(2000);\nSerial.println("BitBlock ML starting...");\ninitML_${safeName}();`);

    // If placed loosely on the canvas, act as an auto-printing statement loop
    if (!block.getParent()) {
      return `
if (!ml_ready_${safeName}) {
  Serial.println("ERR:init - waiting...");
  delay(2000);
} else {
  String result_${safeName} = runInference_${blockId}();
  Serial.println(result_${safeName});
  delay(100);
}`;
    }

    return [`runInference_${blockId}()`, generator.ORDER_FUNCTION_CALL];
  };

  return blockId;
}
