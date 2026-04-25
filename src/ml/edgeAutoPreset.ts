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
    return { epochs: 30, batch_size: 16, learning_rate: 0.001, window_size: 32, fine_tune_epochs: 0, alpha: 0.1 };
  }
  if (profile === "small") {
    return { epochs: 45, batch_size: 24, learning_rate: 0.001, window_size: 40, fine_tune_epochs: 3, alpha: 0.25 };
  }
  if (profile === "performance") {
    return { epochs: 80, batch_size: 48, learning_rate: 0.0005, window_size: 64, fine_tune_epochs: 8, alpha: 0.75 };
  }
  return { epochs: 60, batch_size: 32, learning_rate: 0.0008, window_size: 50, fine_tune_epochs: 5, alpha: 0.5 };
}

function pickArchitecture(task: MLTask, board: BoardConfig): string {
  const supportedByTask = TASK_ARCHITECTURES[task] || [];
  const supportedByBoard = new Set(board.supportedMLTasks);
  const eligible = supportedByTask.filter((archId) => {
    const arch = ML_ARCHITECTURES[archId];
    return !!arch && arch.baseSizeKb <= board.maxModelSizeKb && supportedByBoard.has(task);
  });

  if (eligible.length === 0) {
    return supportedByTask[0] || "";
  }

  // Prefer stronger models when the board has headroom.
  if ((task === "motion_anomaly" || task === "sensor_anomaly") && eligible.includes("autoencoder")) {
    return board.maxModelSizeKb >= 30 ? "autoencoder" : "autoencoder_tiny";
  }
  if (task === "keyword_spotting" && eligible.includes("ds_cnn")) return "ds_cnn";
  if (task === "image_classification" && eligible.includes("mobilenet_v1")) return "mobilenet_v1";
  if (task === "object_detection" && eligible.includes("fomo")) return "fomo";
  if (task === "sound" && eligible.includes("cnn_1d_mfcc")) return "cnn_1d_mfcc";
  if (task === "gesture" && eligible.includes("cnn_1d_imu")) return "cnn_1d_imu";
  return eligible[0];
}

export function getAutoMLPreset(task: MLTask, board: BoardConfig): AutoMLPreset {
  const profile = getProfile(board);
  const architecture = pickArchitecture(task, board);
  const base = getBaseHyperparameters(profile);

  const hyperparameters: Record<string, number | string> = { ...base };

  if (architecture === "fomo") {
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 16, 24);
  }
  if (architecture === "autoencoder_tiny") {
    hyperparameters.epochs = Math.max(35, Number(base.epochs) || 35);
    hyperparameters.batch_size = Math.min(Number(base.batch_size) || 16, 16);
  }
  if (architecture === "ds_cnn" || architecture === "cnn_1d_mfcc" || architecture === "cnn_1d_imu") {
    hyperparameters.window_size = base.window_size;
  }

  return {
    architecture,
    hyperparameters,
    profile,
    note:
      `Auto-optimized for ${board.name}: ${profile} profile with ${architecture.replaceAll("_", " ")} ` +
      `based on flash/RAM budget (~${board.maxModelSizeKb}KB model allowance).`,
  };
}

