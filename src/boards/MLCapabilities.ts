export type MLTask = "gesture" | "motion_anomaly" | "keyword_spotting" | "sound" | "sensor_anomaly" | "image_classification" | "object_detection";

export interface MLArchitecture {
  id: string;
  name: string;
  type: "classification" | "anomaly" | "detection";
  recommendedInput: "IMU" | "Audio" | "Image" | "Sensor";
  baseSizeKb: number;
}

export const ML_ARCHITECTURES: Record<string, MLArchitecture> = {
  "mobilenet_v1_0.1": { id: "mobilenet_v1_0.1", name: "MobileNetV1 INT8 (0.1)", type: "classification", recommendedInput: "Image", baseSizeKb: 140 },
  "mobilenet_v1_0.25": { id: "mobilenet_v1_0.25", name: "MobileNetV1 INT8 (0.25)", type: "classification", recommendedInput: "Image", baseSizeKb: 450 },
  "fomo": { id: "fomo", name: "FOMO Object Detection", type: "detection", recommendedInput: "Image", baseSizeKb: 250 },
  "cnn_1d_mfcc": { id: "cnn_1d_mfcc", name: "1D CNN on MFCC", type: "classification", recommendedInput: "Audio", baseSizeKb: 60 },
  "ds_cnn": { id: "ds_cnn", name: "DS-CNN Keyword Spotting", type: "classification", recommendedInput: "Audio", baseSizeKb: 90 },
  "cnn_1d_imu": { id: "cnn_1d_imu", name: "1D CNN on IMU (Gesture)", type: "classification", recommendedInput: "IMU", baseSizeKb: 30 },
  "autoencoder": { id: "autoencoder", name: "Autoencoder Sensor Anomaly", type: "anomaly", recommendedInput: "Sensor", baseSizeKb: 15 },
  "autoencoder_tiny": { id: "autoencoder_tiny", name: "Tiny Autoencoder Anomaly", type: "anomaly", recommendedInput: "Sensor", baseSizeKb: 5 },
};

export const TASK_ARCHITECTURES: Record<MLTask, string[]> = {
  "image_classification": ["mobilenet_v1_0.1", "mobilenet_v1_0.25"],
  "object_detection": ["fomo"],
  "sound": ["cnn_1d_mfcc"],
  "keyword_spotting": ["ds_cnn"],
  "gesture": ["cnn_1d_imu"],
  "motion_anomaly": ["autoencoder", "autoencoder_tiny"],
  "sensor_anomaly": ["autoencoder", "autoencoder_tiny"],
};
