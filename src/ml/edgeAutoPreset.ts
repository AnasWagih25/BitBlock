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
  // First-gen ESP32 boards like ESP32-CAM have slow Quad-SPI PSRAM and no vector units,
  // so we cap them at "balanced" profile to keep model complexity reasonable.
  if (board.id === "esp32-cam") return "balanced";
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

export function getAutoMLPreset(task: MLTask, board: BoardConfig, currentArchitecture?: string): AutoMLPreset {
  const profile = getProfile(board);
  
  // Decide which architecture to optimize
  let architecture = pickArchitecture(task, board);
  if (currentArchitecture && (TASK_ARCHITECTURES[task] || []).includes(currentArchitecture)) {
    const archDef = ML_ARCHITECTURES[currentArchitecture];
    if (archDef && archDef.baseSizeKb <= board.maxModelSizeKb && board.supportedMLTasks.includes(task)) {
      architecture = currentArchitecture;
    }
  }

  const base = getBaseHyperparameters(profile);
  const hyperparameters: Record<string, number | string> = { ...base };

  // ── Smart Architecture & Board Preset Tuning Matrix ──
  
  // 1. MobileNetV2 (Image Classification)
  if (architecture === "mobilenet_v2") {
    hyperparameters.learning_rate = 0.001; // Stable baseline for transfer learning
    hyperparameters.fine_tune_epochs = Math.max(8, Number(base.fine_tune_epochs) || 8);
    
    if (board.id === "esp32-cam") {
      // First-gen ESP32 has slow PSRAM access and no vector instructions, needs tiny alpha.
      hyperparameters.alpha = 0.35;
      hyperparameters.batch_size = 24; // Lower batch size to prevent OOM
      hyperparameters.epochs = 80;
      hyperparameters.fine_tune_epochs = 10;
    } else if (board.id === "arduino-nano-esp32") {
      // S3 chip is vector-accelerated but board has 0 PSRAM. Must fit in SRAM!
      // Base model is ~500KB with 0.35, arena is 1MB. Fits perfectly if we use 0.35.
      hyperparameters.alpha = 0.35;
      hyperparameters.batch_size = 24;
      hyperparameters.epochs = 80;
      hyperparameters.fine_tune_epochs = 8;
    } else if (board.id === "esp32-s3") {
      // S3 has vector acceleration and 8MB PSRAM! Max performance settings.
      hyperparameters.alpha = profile === "performance" ? 0.75 : 0.50;
      hyperparameters.batch_size = profile === "performance" ? 48 : 32;
      hyperparameters.learning_rate = profile === "performance" ? 0.0005 : 0.0008;
      hyperparameters.epochs = profile === "performance" ? 100 : 80;
      hyperparameters.fine_tune_epochs = profile === "performance" ? 12 : 8;
    } else {
      hyperparameters.alpha = profile === "performance" ? 0.75 : profile === "balanced" ? 0.50 : 0.35;
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 24, 32);
    }
  }

  // 2. MobileNetV1 (Image Classification)
  if (architecture === "mobilenet_v1") {
    hyperparameters.learning_rate = 0.001;
    hyperparameters.fine_tune_epochs = Math.max(5, Number(base.fine_tune_epochs) || 5);
    
    if (board.id === "esp32-cam" || board.id === "arduino-nano-esp32") {
      hyperparameters.alpha = 0.25; // Small size fits well in SRAM
      hyperparameters.batch_size = 24;
      hyperparameters.epochs = 80;
      hyperparameters.fine_tune_epochs = 8;
    } else if (board.id === "esp32-s3") {
      hyperparameters.alpha = profile === "performance" ? 0.50 : 0.25;
      hyperparameters.batch_size = profile === "performance" ? 48 : 32;
      hyperparameters.learning_rate = profile === "performance" ? 0.0008 : 0.001;
      hyperparameters.epochs = profile === "performance" ? 100 : 80;
    } else {
      hyperparameters.alpha = profile === "performance" ? 0.50 : 0.25;
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 24, 32);
    }
  }

  // 3. EfficientNet-Lite0 (Image Classification)
  if (architecture === "efficientnet_lite0") {
    hyperparameters.learning_rate = 0.0005;
    hyperparameters.epochs = profile === "performance" ? 100 : 80;
    hyperparameters.fine_tune_epochs = Math.max(10, Number(base.fine_tune_epochs) || 10);
    
    if (board.id === "esp32-cam") {
      hyperparameters.batch_size = 16; // Strict constraint to prevent OOM
      hyperparameters.learning_rate = 0.0008; // Slightly faster learning rate
    } else if (board.id === "esp32-s3") {
      hyperparameters.batch_size = profile === "performance" ? 32 : 24;
      hyperparameters.learning_rate = profile === "performance" ? 0.0005 : 0.0008;
    } else {
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 16, 24);
    }
  }

  // 4. FOMO (Ultra-Fast Centroid Object Detection)
  if (architecture === "fomo") {
    hyperparameters.learning_rate = 0.001; // Stable baseline for custom CNN
    hyperparameters.augmentation = "strong"; // Centroid precision requires strong augmentation
    
    if (board.id === "esp32-cam") {
      hyperparameters.batch_size = 16;
      hyperparameters.epochs = 80;
    } else if (board.id === "esp32-s3") {
      hyperparameters.batch_size = profile === "performance" ? 32 : 24;
      hyperparameters.epochs = profile === "performance" ? 100 : 80;
    } else {
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 16, 24);
    }
  }

  // 5. SSD MobileNet V2 (Memory-Intense Object Detection)
  if (architecture === "ssd_mobilenet_v2") {
    hyperparameters.alpha = 0.35; // Keep it tight and fast
    hyperparameters.learning_rate = 0.0005; // Critical for complex detection layer convergence
    hyperparameters.augmentation = "strong";
    hyperparameters.epochs = profile === "performance" ? 120 : 100;
    hyperparameters.fine_tune_epochs = Math.max(15, Number(base.fine_tune_epochs) || 15);
    
    if (board.id === "esp32-cam") {
      hyperparameters.batch_size = 8; // Extremely low RAM budget on ESP32-CAM
      hyperparameters.epochs = 80;
      hyperparameters.fine_tune_epochs = 10;
    } else if (board.id === "esp32-s3") {
      hyperparameters.batch_size = profile === "performance" ? 24 : 16;
    } else {
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 8, 12);
    }
  }

  // 6. MobileFaceNet (Face Recognition)
  if (architecture === "face_recognition") {
    hyperparameters.learning_rate = 0.0005; // Standard recommended face embedding learning rate
    hyperparameters.embedding_dim = 64; // Standard balanced dimension
    hyperparameters.augmentation = "strong";
    hyperparameters.epochs = profile === "performance" ? 100 : 80;
    hyperparameters.fine_tune_epochs = Math.max(10, Number(base.fine_tune_epochs) || 10);
    
    if (board.id === "esp32-cam") {
      hyperparameters.batch_size = 12; // Prevent OOM
    } else if (board.id === "esp32-s3") {
      hyperparameters.batch_size = profile === "performance" ? 24 : 16;
      if (profile === "performance") hyperparameters.embedding_dim = 128; // High accuracy mode
    } else {
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 12, 16);
    }
  }

  // 7. Autoencoder (Motion & Sensor Anomaly Detection)
  if (architecture === "autoencoder" || architecture === "autoencoder_tiny") {
    hyperparameters.learning_rate = 0.001;
    
    if (board.id === "arduino-uno-r4-wifi") {
      // Extremely tight 32KB RAM constraint
      hyperparameters.epochs = 40;
      hyperparameters.batch_size = 16;
      hyperparameters.window_size = 32;
    } else if (board.id === "esp32-c3") {
      hyperparameters.epochs = 50;
      hyperparameters.batch_size = 24;
      hyperparameters.window_size = 40;
    } else {
      hyperparameters.epochs = profile === "performance" ? 80 : 60;
      hyperparameters.batch_size = profile === "performance" ? 48 : 32;
      hyperparameters.window_size = profile === "performance" ? 64 : 50;
    }
  }

  // 8. 1D CNNs (Gesture IMU & Audio Keyword Spotting)
  if (architecture === "ds_cnn" || architecture === "cnn_1d_mfcc" || architecture === "cnn_1d_imu") {
    hyperparameters.learning_rate = 0.001;
    hyperparameters.augmentation = "standard";
    hyperparameters.window_size = profile === "performance" ? 64 : profile === "balanced" ? 50 : profile === "small" ? 40 : 32;
    
    if (board.id === "esp32-c3") {
      hyperparameters.epochs = 60;
      hyperparameters.batch_size = 24;
    } else if (board.id === "esp32-wroom" || board.id === "arduino-nano-esp32") {
      hyperparameters.epochs = 80;
      hyperparameters.batch_size = 32;
    } else if (board.id === "esp32-s3") {
      hyperparameters.epochs = profile === "performance" ? 100 : 80;
      hyperparameters.batch_size = profile === "performance" ? 48 : 32;
    } else {
      hyperparameters.epochs = Math.max(60, Number(base.epochs) || 60);
      hyperparameters.batch_size = Math.min(Number(base.batch_size) || 24, 32);
    }
  }

  return {
    architecture,
    hyperparameters,
    profile,
    note:
      `Auto-optimized for ${board.name}: ${profile} profile · ${architecture.replaceAll("_", " ")} · ` +
      `cosine LR · ${String(hyperparameters.augmentation || "standard")} augmentation · ~${board.maxModelSizeKb}KB budget`,
  };
}
