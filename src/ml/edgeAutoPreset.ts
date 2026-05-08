import type { BoardConfig } from "../boards/registry";
import { ML_ARCHITECTURES, TASK_ARCHITECTURES, type MLTask } from "../boards/MLCapabilities";

export interface AutoMLPreset {
  architecture: string;
  hyperparameters: Record<string, number | string>;
  profile: "tiny" | "small" | "balanced" | "performance";
  note: string;
}

function getProfile(board: BoardConfig): AutoMLPreset["profile"] {
  if (board.maxModelSizeKb <= 80) return "tiny";
  if (board.maxModelSizeKb <= 220) return "small";
  if (board.maxModelSizeKb <= 900) return "balanced";
  return "performance";
}

function getBaseHyperparameters(profile: AutoMLPreset["profile"]): Record<string, number | string> {
  if (profile === "tiny") {
    return {
      epochs: 40, batch_size: 16, learning_rate: 0.001,
      window_size: 32, fine_tune_epochs: 0, alpha: 0.25,
      lr_schedule: "cosine", augmentation: "standard",
    };
  }
  if (profile === "small") {
    return {
      epochs: 60, batch_size: 24, learning_rate: 0.001,
      window_size: 40, fine_tune_epochs: 4, alpha: 0.25,
      lr_schedule: "cosine", augmentation: "strong",
    };
  }
  if (profile === "performance") {
    return {
      epochs: 100, batch_size: 48, learning_rate: 0.0005,
      window_size: 64, fine_tune_epochs: 12, alpha: 0.75,
      lr_schedule: "cosine", augmentation: "strong",
    };
  }
  // balanced
  return {
    epochs: 80, batch_size: 32, learning_rate: 0.0008,
    window_size: 50, fine_tune_epochs: 6, alpha: 0.5,
    lr_schedule: "cosine", augmentation: "strong",
  };
}

function pickArchitecture(task: MLTask, board: BoardConfig): string {
  const supportedByTask = TASK_ARCHITECTURES[task] || [];
  const supportedByBoard = new Set(board.supportedMLTasks);
  const eligible = supportedByTask.filter((archId) => {
    const arch = ML_ARCHITECTURES[archId];
    return !!arch && arch.baseSizeKb <= board.maxModelSizeKb && supportedByBoard.has(task);
  });

  if (eligible.length === 0) {
    return ""; // Return empty to force validation error instead of giving an impossible model
  }

  // Prefer the strongest model that fits
  if (task === "image_classification") {
    if (eligible.includes("efficientnet_lite0")) return "efficientnet_lite0";
    if (eligible.includes("mobilenet_v2")) return "mobilenet_v2";
    if (eligible.includes("mobilenet_v1")) return "mobilenet_v1";
  }
  if (task === "object_detection") {
    if (eligible.includes("ssd_mobilenet_v2") && board.psram > 0) return "ssd_mobilenet_v2";
    if (eligible.includes("fomo")) return "fomo";
  }
  if ((task === "motion_anomaly" || task === "sensor_anomaly") && eligible.includes("autoencoder")) {
    return board.maxModelSizeKb >= 30 ? "autoencoder" : "autoencoder_tiny";
  }
  if ((task === "keyword_spotting" || task === "sound") && eligible.includes("ds_cnn")) return "ds_cnn";
  if (task === "face_recognition" && eligible.includes("face_recognition")) return "face_recognition";
  if (task === "gesture" && eligible.includes("cnn_1d_imu")) return "cnn_1d_imu";
  return eligible[0];
}

export function getAutoMLPreset(task: MLTask, board: BoardConfig): AutoMLPreset {
  const profile = getProfile(board);
  const architecture = pickArchitecture(task, board);
  const base = getBaseHyperparameters(profile);

  const hyperparameters: Record<string, number | string> = { ...base };

  // Architecture-specific tuning
  if (architecture === "mobilenet_v2") {
    hyperparameters.alpha = profile === "performance" ? 0.75 : profile === "balanced" ? 0.5 : 0.35;
    hyperparameters.fine_tune_epochs = Math.max(8, Number(base.fine_tune_epochs) || 8);
  }
  if (architecture === "efficientnet_lite0") {
    hyperparameters.fine_tune_epochs = Math.max(10, Number(base.fine_tune_epochs) || 10);
    hyperparameters.epochs = Math.max(80, Number(base.epochs) || 80);
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 24, 24);
  }
  if (architecture === "fomo") {
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 16, 24);
  }
  if (architecture === "ssd_mobilenet_v2") {
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 12, 16);
    hyperparameters.epochs = Math.max(100, Number(base.epochs) || 100);
    hyperparameters.fine_tune_epochs = Math.max(15, Number(base.fine_tune_epochs) || 15);
  }
  if (architecture === "face_recognition") {
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 12, 12);
    hyperparameters.epochs = Math.max(80, Number(base.epochs) || 80);
    hyperparameters.learning_rate = 0.0005;
    hyperparameters.embedding_dim = 64;
    hyperparameters.fine_tune_epochs = Math.max(10, Number(base.fine_tune_epochs) || 10);
  }
  if (architecture === "autoencoder_tiny") {
    hyperparameters.epochs = Math.max(40, Number(base.epochs) || 40);
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 16, 16);
  }
  if (architecture === "autoencoder") {
    hyperparameters.epochs = Math.max(60, Number(base.epochs) || 60);
  }
  if (architecture === "ds_cnn" || architecture === "cnn_1d_mfcc" || architecture === "cnn_1d_imu") {
    hyperparameters.window_size = base.window_size;
    hyperparameters.augmentation = "standard";
  }

  return {
    architecture,
    hyperparameters,
    profile,
    note:
      `Auto-optimized for ${board.name}: ${profile} profile · ${architecture.replaceAll("_", " ")} · ` +
      `cosine LR · ${String(hyperparameters.augmentation)} augmentation · ~${board.maxModelSizeKb}KB budget`,
  };
}
