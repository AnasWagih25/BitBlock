export type MLTask = "gesture" | "motion_anomaly" | "keyword_spotting" | "sound" | "sensor_anomaly" | "image_classification" | "object_detection" | "face_recognition";

export interface MLHyperparameter {
  id: string;
  name: string;
  type: "number" | "select";
  default: number | string;
  min?: number;
  max?: number;
  options?: { label: string, value: string | number }[];
}

export interface MLArchitecture {
  id: string;
  name: string;
  type: "classification" | "anomaly" | "detection";
  recommendedInput: "IMU" | "Audio" | "Image" | "Sensor";
  baseSizeKb: number;
  inputResolution?: { width: number, height: number };
  hyperparameters?: MLHyperparameter[];
  /** Recommended dataset sizes for this architecture */
  recommendedSamples?: {
    /** Absolute minimum to get any result */
    min: number;
    /** Recommended for good accuracy */
    recommended: number;
    /** Ideal for best results */
    ideal?: number;
    /** Unit label, e.g. "per class", "per person", "total (normal only)" */
    unit: string;
  };
}

const standardHyperparams: MLHyperparameter[] = [
  { id: "epochs", name: "Training Epochs", type: "number", default: 30, min: 1, max: 500 },
  { id: "batch_size", name: "Batch Size", type: "number", default: 32, min: 1, max: 256 },
  { id: "dropout", name: "Dropout Rate", type: "select", default: 0.25, options: [
      { label: "0.10 (Minimal - Underfitting)", value: 0.1 },
      { label: "0.25 (Standard)", value: 0.25 },
      { label: "0.40 (Strong - Overfitting prevention)", value: 0.4 },
      { label: "0.50 (Maximum)", value: 0.5 }
  ]},
  { id: "learning_rate", name: "Learning Rate", type: "select", default: 0.001, options: [
      { label: "0.01 (Fast)", value: 0.01 },
      { label: "0.001 (Recommended)", value: 0.001 },
      { label: "0.0005 (Balanced)", value: 0.0005 },
      { label: "0.0001 (Slow / Fine-tuning)", value: 0.0001 },
      { label: "0.00001 (Micro)", value: 0.00001 }
  ]},
  { id: "lr_schedule", name: "LR Schedule", type: "select", default: "cosine", options: [
      { label: "Cosine Annealing (Best)", value: "cosine" },
      { label: "Reduce on Plateau", value: "plateau" },
      { label: "Constant", value: "constant" },
  ]},
];

const mobileNetHyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "alpha", name: "Alpha Size (Width Multiplier)", type: "select", default: 0.25, options: [
      { label: "0.10 (Tiny - Needs lots of data & epochs)", value: 0.1 },
      { label: "0.25 (Small - ImageNet Transfer Learning)", value: 0.25 },
      { label: "0.35 (Medium-Small - ImageNet Transfer Learning)", value: 0.35 },
      { label: "0.50 (Medium - ImageNet Transfer Learning)", value: 0.5 },
      { label: "0.75 (Large - ImageNet Transfer Learning)", value: 0.75 },
      { label: "1.00 (Full - ImageNet Transfer Learning)", value: 1.0 }
  ]},
  { id: "fine_tune_epochs", name: "Fine-Tune Epochs", type: "number", default: 5, min: 0, max: 40 },
  { id: "augmentation", name: "Data Augmentation", type: "select", default: "strong", options: [
      { label: "Strong (Zoom + Brightness + Contrast)", value: "strong" },
      { label: "Standard (Flip + Rotate)", value: "standard" },
      { label: "None", value: "none" },
  ]},
];

const mobileNetV2Hyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "alpha", name: "Alpha Size (Width Multiplier)", type: "select", default: 0.35, options: [
      { label: "0.35 (Tiny - ESP32-CAM optimized)", value: 0.35 },
      { label: "0.50 (Small - Balanced)", value: 0.5 },
      { label: "0.75 (Medium - Higher accuracy)", value: 0.75 },
      { label: "1.00 (Full - Maximum accuracy)", value: 1.0 }
  ]},
  { id: "fine_tune_epochs", name: "Fine-Tune Epochs", type: "number", default: 8, min: 0, max: 40 },
  { id: "augmentation", name: "Data Augmentation", type: "select", default: "strong", options: [
      { label: "Strong (Zoom + Brightness + Contrast)", value: "strong" },
      { label: "Standard (Flip + Rotate)", value: "standard" },
      { label: "None", value: "none" },
  ]},
];

const efficientNetHyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "fine_tune_epochs", name: "Fine-Tune Epochs", type: "number", default: 10, min: 0, max: 50 },
  { id: "augmentation", name: "Data Augmentation", type: "select", default: "strong", options: [
      { label: "Strong (Zoom + Brightness + Contrast)", value: "strong" },
      { label: "Standard (Flip + Rotate)", value: "standard" },
      { label: "None", value: "none" },
  ]},
];

const anomalyHyperparams: MLHyperparameter[] = [
  { id: "epochs", name: "Training Epochs", type: "number", default: 60, min: 1, max: 500 },
  { id: "batch_size", name: "Batch Size", type: "number", default: 32, min: 1, max: 256 },
  { id: "window_size", name: "Window Size", type: "number", default: 50, min: 8, max: 200 },
  { id: "learning_rate", name: "Learning Rate", type: "select", default: 0.001, options: [
      { label: "0.01 (Fast)", value: 0.01 },
      { label: "0.001 (Recommended)", value: 0.001 },
      { label: "0.0001 (Slow / Fine-tuning)", value: 0.0001 }
  ]},
  { id: "lr_schedule", name: "LR Schedule", type: "select", default: "cosine", options: [
      { label: "Cosine Annealing (Best)", value: "cosine" },
      { label: "Reduce on Plateau", value: "plateau" },
      { label: "Constant", value: "constant" },
  ]},
];

const sensorHyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "window_size", name: "Window Size", type: "number", default: 50, min: 8, max: 200 },
  { id: "augmentation", name: "Sensor Augmentation", type: "select", default: "standard", options: [
      { label: "Standard (Jitter + Scaling + Time Warp)", value: "standard" },
      { label: "None", value: "none" },
  ]},
];

const imageHyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "fine_tune_epochs", name: "Fine-Tune Epochs", type: "number", default: 3, min: 0, max: 40 },
  { id: "augmentation", name: "Data Augmentation", type: "select", default: "strong", options: [
      { label: "Strong (Zoom + Brightness + Contrast)", value: "strong" },
      { label: "Standard (Flip + Rotate)", value: "standard" },
      { label: "None", value: "none" },
  ]},
];

const faceHyperparams: MLHyperparameter[] = [
  { id: "epochs", name: "Training Epochs", type: "number", default: 60, min: 10, max: 500 },
  { id: "batch_size", name: "Batch Size", type: "number", default: 16, min: 1, max: 128 },
  { id: "learning_rate", name: "Learning Rate", type: "select", default: 0.0005, options: [
      { label: "0.01 (Fast)", value: 0.01 },
      { label: "0.001 (Standard)", value: 0.001 },
      { label: "0.0005 (Recommended for Faces)", value: 0.0005 },
      { label: "0.0001 (Slow / Fine-tuning)", value: 0.0001 },
      { label: "0.00001 (Micro)", value: 0.00001 }
  ]},
  { id: "lr_schedule", name: "LR Schedule", type: "select", default: "cosine", options: [
      { label: "Cosine Annealing (Best)", value: "cosine" },
      { label: "Reduce on Plateau", value: "plateau" },
  ]},
  { id: "embedding_dim", name: "Embedding Dimension", type: "select", default: 64, options: [
      { label: "32 (Tiny — faster, less accurate)", value: 32 },
      { label: "64 (Recommended)", value: 64 },
      { label: "128 (Large — slower, more accurate)", value: 128 },
  ]},
  { id: "fine_tune_epochs", name: "Fine-Tune Epochs", type: "number", default: 10, min: 0, max: 40 },
  { id: "augmentation", name: "Data Augmentation", type: "select", default: "strong", options: [
      { label: "Strong (Face-optimized augmentation)", value: "strong" },
      { label: "Standard (Flip + Rotate)", value: "standard" },
  ]},
];

const ssdHyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "fine_tune_epochs", name: "Fine-Tune Epochs", type: "number", default: 10, min: 0, max: 50 },
  { id: "augmentation", name: "Data Augmentation", type: "select", default: "strong", options: [
      { label: "Strong (Zoom + Brightness + Contrast)", value: "strong" },
      { label: "Standard (Flip + Rotate)", value: "standard" },
      { label: "None", value: "none" },
  ]},
];

export const ML_ARCHITECTURES: Record<string, MLArchitecture> = {
  // ── Image Classification ──
  "mobilenet_v1":      { id: "mobilenet_v1", name: "MobileNetV1 INT8", type: "classification", recommendedInput: "Image", baseSizeKb: 450, inputResolution: { width: 96, height: 96 }, hyperparameters: mobileNetHyperparams, recommendedSamples: { min: 50, recommended: 150, ideal: 300, unit: "per class" } },
  "mobilenet_v2":      { id: "mobilenet_v2", name: "MobileNetV2 INT8 (Best)", type: "classification", recommendedInput: "Image", baseSizeKb: 500, inputResolution: { width: 96, height: 96 }, hyperparameters: mobileNetV2Hyperparams, recommendedSamples: { min: 50, recommended: 150, ideal: 300, unit: "per class" } },
  "efficientnet_lite0": { id: "efficientnet_lite0", name: "EfficientNet-Lite0 INT8", type: "classification", recommendedInput: "Image", baseSizeKb: 1200, inputResolution: { width: 96, height: 96 }, hyperparameters: efficientNetHyperparams, recommendedSamples: { min: 80, recommended: 200, ideal: 500, unit: "per class" } },

  // ── Face Recognition ──
  "face_recognition":  { id: "face_recognition", name: "MobileFaceNet-Nano", type: "classification", recommendedInput: "Image", baseSizeKb: 250, inputResolution: { width: 96, height: 96 }, hyperparameters: faceHyperparams, recommendedSamples: { min: 20, recommended: 50, ideal: 100, unit: "per person" } },

  // ── Object Detection ──
  "fomo":              { id: "fomo", name: "FOMO Centroid Detection", type: "detection", recommendedInput: "Image", baseSizeKb: 250, inputResolution: { width: 96, height: 96 }, hyperparameters: imageHyperparams, recommendedSamples: { min: 50, recommended: 150, ideal: 300, unit: "per class" } },
  "ssd_mobilenet_v2":  { id: "ssd_mobilenet_v2", name: "SSD-MobileNetV2 (PSRAM)", type: "detection", recommendedInput: "Image", baseSizeKb: 1800, inputResolution: { width: 96, height: 96 }, hyperparameters: ssdHyperparams, recommendedSamples: { min: 100, recommended: 300, ideal: 500, unit: "per class" } },

  // ── Audio / Keyword Spotting ──
  "cnn_1d_mfcc":       { id: "cnn_1d_mfcc", name: "1D CNN on MFCC", type: "classification", recommendedInput: "Audio", baseSizeKb: 60, hyperparameters: sensorHyperparams, recommendedSamples: { min: 30, recommended: 100, ideal: 200, unit: "per keyword" } },
  "ds_cnn":            { id: "ds_cnn", name: "DS-CNN Keyword Spotting", type: "classification", recommendedInput: "Audio", baseSizeKb: 90, hyperparameters: sensorHyperparams, recommendedSamples: { min: 50, recommended: 150, ideal: 300, unit: "per keyword" } },

  // ── Gesture / IMU ──
  "cnn_1d_imu":        { id: "cnn_1d_imu", name: "1D CNN on IMU (Gesture)", type: "classification", recommendedInput: "IMU", baseSizeKb: 30, hyperparameters: sensorHyperparams, recommendedSamples: { min: 30, recommended: 80, ideal: 150, unit: "per gesture" } },

  // ── Anomaly Detection ──
  "autoencoder":       { id: "autoencoder", name: "Dense Autoencoder Anomaly", type: "anomaly", recommendedInput: "Sensor", baseSizeKb: 15, hyperparameters: anomalyHyperparams, recommendedSamples: { min: 100, recommended: 300, ideal: 500, unit: "total (normal only)" } },
  "autoencoder_tiny":  { id: "autoencoder_tiny", name: "Tiny Dense Autoencoder", type: "anomaly", recommendedInput: "Sensor", baseSizeKb: 5, hyperparameters: anomalyHyperparams, recommendedSamples: { min: 50, recommended: 150, ideal: 300, unit: "total (normal only)" } },
};

export const TASK_ARCHITECTURES: Record<MLTask, string[]> = {
  "image_classification": ["mobilenet_v2", "mobilenet_v1", "efficientnet_lite0"],
  "face_recognition": ["face_recognition"],
  "object_detection": ["fomo", "ssd_mobilenet_v2"],
  "sound": ["ds_cnn", "cnn_1d_mfcc"],
  "keyword_spotting": ["ds_cnn", "cnn_1d_mfcc"],
  "gesture": ["cnn_1d_imu"],
  "motion_anomaly": ["autoencoder", "autoencoder_tiny"],
  "sensor_anomaly": ["autoencoder", "autoencoder_tiny"],
};
