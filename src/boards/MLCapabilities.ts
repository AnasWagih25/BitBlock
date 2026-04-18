export type MLTask = "gesture" | "motion_anomaly" | "keyword_spotting" | "sound" | "sensor_anomaly" | "image_classification" | "object_detection";

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
}

const standardHyperparams: MLHyperparameter[] = [
  { id: "epochs", name: "Training Epochs", type: "number", default: 20, min: 1, max: 500 },
  { id: "batch_size", name: "Batch Size", type: "number", default: 32, min: 1, max: 256 },
  { id: "learning_rate", name: "Learning Rate", type: "select", default: 0.001, options: [
      { label: "0.01 (Fast)", value: 0.01 },
      { label: "0.001 (Recommended)", value: 0.001 },
      { label: "0.0001 (Slow / Fine-tuning)", value: 0.0001 },
      { label: "0.00001 (Micro)", value: 0.00001 }
  ]}
];

const mobileNetHyperparams: MLHyperparameter[] = [
  ...standardHyperparams,
  { id: "alpha", name: "Alpha Size (MobileNet)", type: "select", default: 0.25, options: [
      { label: "0.10 (Tiny - Needs lots of data & epochs)", value: 0.1 },
      { label: "0.25 (Small - ImageNet Transfer Learning)", value: 0.25 },
      { label: "0.50 (Medium - ImageNet Transfer Learning)", value: 0.5 },
      { label: "0.75 (Large - ImageNet Transfer Learning)", value: 0.75 },
      { label: "1.00 (Huge - ImageNet Transfer Learning)", value: 1.0 }
  ]}
];

const anomalyHyperparams: MLHyperparameter[] = [
  { id: "epochs", name: "Training Epochs", type: "number", default: 50, min: 1, max: 500 },
  { id: "batch_size", name: "Batch Size", type: "number", default: 32, min: 1, max: 256 },
  { id: "learning_rate", name: "Learning Rate", type: "select", default: 0.001, options: [
      { label: "0.01 (Fast)", value: 0.01 },
      { label: "0.001 (Recommended)", value: 0.001 },
      { label: "0.0001 (Slow / Fine-tuning)", value: 0.0001 }
  ]}
];

export const ML_ARCHITECTURES: Record<string, MLArchitecture> = {
  "mobilenet_v1": { id: "mobilenet_v1", name: "MobileNetV1 INT8", type: "classification", recommendedInput: "Image", baseSizeKb: 450, inputResolution: { width: 96, height: 96 }, hyperparameters: mobileNetHyperparams },
  "fomo": { id: "fomo", name: "FOMO Object Detection", type: "detection", recommendedInput: "Image", baseSizeKb: 250, inputResolution: { width: 96, height: 96 }, hyperparameters: standardHyperparams },
  "cnn_1d_mfcc": { id: "cnn_1d_mfcc", name: "1D CNN on MFCC", type: "classification", recommendedInput: "Audio", baseSizeKb: 60, hyperparameters: standardHyperparams },
  "ds_cnn": { id: "ds_cnn", name: "DS-CNN Keyword Spotting", type: "classification", recommendedInput: "Audio", baseSizeKb: 90, hyperparameters: standardHyperparams },
  "cnn_1d_imu": { id: "cnn_1d_imu", name: "1D CNN on IMU (Gesture)", type: "classification", recommendedInput: "IMU", baseSizeKb: 30, hyperparameters: standardHyperparams },
  "autoencoder": { id: "autoencoder", name: "Autoencoder Sensor Anomaly", type: "anomaly", recommendedInput: "Sensor", baseSizeKb: 15, hyperparameters: anomalyHyperparams },
  "autoencoder_tiny": { id: "autoencoder_tiny", name: "Tiny Autoencoder Anomaly", type: "anomaly", recommendedInput: "Sensor", baseSizeKb: 5, hyperparameters: anomalyHyperparams },
};

export const TASK_ARCHITECTURES: Record<MLTask, string[]> = {
  "image_classification": ["mobilenet_v1"],
  "object_detection": ["fomo"],
  "sound": ["cnn_1d_mfcc"],
  "keyword_spotting": ["ds_cnn"],
  "gesture": ["cnn_1d_imu"],
  "motion_anomaly": ["autoencoder", "autoencoder_tiny"],
  "sensor_anomaly": ["autoencoder", "autoencoder_tiny"],
};
