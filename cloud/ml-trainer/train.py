"""
BitBlock ML Training — Model builders and training loop.

Supports all architectures defined in MLCapabilities.ts:
- MobileNetV1 (image classification via transfer learning)
- FOMO (centroid heatmaps on an 8× downsampled grid; requires `objects` in Firestore samples)
- 1D CNN on MFCC (audio classification)
- DS-CNN (keyword spotting — depthwise separable CNN)
- 1D CNN on IMU (gesture recognition)
- Autoencoder / Autoencoder Tiny (sensor anomaly detection)

Key design decisions:
  • Labels are always SORTED before building the label→index map so that
    the mapping is deterministic across runs.
  • Sensor data collected as individual short vectors (e.g. [ax, ay, az])
    is windowed into fixed-length sequences before training.
  • Each architecture config declares its expected data type ("image" or
    "sensor" or "anomaly") so the loader can filter Firestore samples.
"""

import io
import numpy as np
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from PIL import Image

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

tf.random.set_seed(42)
np.random.seed(42)


def _make_http_session():
    """Create a requests Session with automatic retries for transient errors."""
    session = requests.Session()
    retry = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


# ── Data Loading ─────────────────────────────────────────────────

def load_image_samples(samples, labels, target_size=(96, 96)):
    """Download images from Firebase Storage URLs and return X, y arrays + metadata."""
    images = []
    label_indices = []
    metadata = []
    label_map = {label: idx for idx, label in enumerate(labels)}
    session = _make_http_session()

    for sample in samples:
        url = sample.get("imageUrl")
        label = sample.get("label", "unknown")

        if not url or label not in label_map:
            continue

        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            img = img.resize(target_size, Image.BILINEAR)
            arr = np.array(img, dtype=np.float32) / 255.0
            images.append(arr)
            label_indices.append(label_map[label])
            metadata.append({
                "sampleId": sample.get("id"),
                "label": label,
                "imageUrl": url,
            })
        except Exception as e:
            print(f"[Data] Skipping sample: {e}")
            continue

    if len(images) == 0:
        raise ValueError("No valid image samples could be loaded")

    X = np.array(images)
    y = keras.utils.to_categorical(label_indices, num_classes=len(labels))
    return X, y, metadata


def build_fomo_gaussian_targets(objects, label_to_idx, gh, gw, sigma=1.15):
    """2D Gaussian splats on a downsampled grid (FOMO-style centroid heatmaps)."""
    c = len(label_to_idx)
    heat = np.zeros((gh, gw, c), dtype=np.float32)
    for obj in objects:
        if not isinstance(obj, dict):
            continue
        lab = obj.get("label")
        if lab is None or lab not in label_to_idx:
            continue
        ci = label_to_idx[lab]
        cx = float(min(1.0, max(0.0, float(obj.get("cx", 0.5)))))
        cy = float(min(1.0, max(0.0, float(obj.get("cy", 0.5)))))
        gx = cx * (gw - 1e-6)
        gy = cy * (gh - 1e-6)
        jj = np.arange(gw, dtype=np.float32)
        ii = np.arange(gh, dtype=np.float32)
        mx, my = np.meshgrid(jj, ii)
        dist2 = (mx - gx) ** 2 + (my - gy) ** 2
        blob = np.exp(-dist2 / (2.0 * sigma * sigma)).astype(np.float32)
        heat[:, :, ci] = np.maximum(heat[:, :, ci], blob)
    return heat


def load_fomo_samples(samples, labels, target_size=(96, 96), grid_stride=8):
    """
    FOMO training: images + centroid annotations in `objects`:
    [{ "label": str, "cx": float, "cy": float }, ...] with cx,cy normalized to the
    stored square image (same space as the model input after resize).
    """
    gh = int(target_size[0] // grid_stride)
    gw = int(target_size[1] // grid_stride)
    label_to_idx = {lab: i for i, lab in enumerate(labels)}
    images = []
    heats = []
    metadata = []
    session = _make_http_session()

    for sample in samples:
        url = sample.get("imageUrl")
        objs = sample.get("objects")
        if not url or not isinstance(objs, list) or len(objs) == 0:
            continue
        clean_objs = []
        for o in objs:
            if not isinstance(o, dict):
                continue
            lb = o.get("label")
            if lb is None:
                continue
            lbs = str(lb)
            if lbs not in label_to_idx:
                continue
            clean_objs.append({
                "label": lbs,
                "cx": float(o.get("cx", 0.5)),
                "cy": float(o.get("cy", 0.5)),
            })
        if len(clean_objs) == 0:
            continue
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            img = img.resize(target_size, Image.BILINEAR)
            arr = np.array(img, dtype=np.float32) / 255.0
            heat = build_fomo_gaussian_targets(clean_objs, label_to_idx, gh, gw)
            images.append(arr)
            heats.append(heat)
            metadata.append({
                "sampleId": sample.get("id"),
                "imageUrl": url,
                "objects": clean_objs,
            })
        except Exception as e:
            print(f"[FOMO Data] Skipping sample: {e}")
            continue

    if len(images) == 0:
        raise ValueError(
            "No valid FOMO samples. Each sample needs imageUrl plus objects[] "
            "with {label, cx, cy} (cx/cy in 0..1 for the training crop)."
        )

    X = np.array(images)
    y = np.stack(heats, axis=0)
    return X, y, metadata, (gh, gw)


def load_sensor_samples_windowed(samples, labels, window_size=50):
    """
    Load IMU/sensor feature vectors from Firestore docs and group them
    into fixed-length windows for 1D CNN training.

    Each Firestore doc contains a short vector (e.g. [ax, ay, az]) from a
    single sensor reading.  We group consecutive same-label samples into
    windows of `window_size` readings, producing input tensors of shape
    (num_windows, window_size * num_features).

    For classification models: returns X, y (one-hot).
    """
    label_map = {label: idx for idx, label in enumerate(labels)}

    # Group samples by label, preserving insertion order
    by_label: dict[str, list[list[float]]] = {l: [] for l in labels}
    for s in samples:
        label = s.get("label", "unknown")
        feats = s.get("features")
        if not feats or label not in label_map:
            continue
        by_label[label].append([float(v) for v in feats])

    # Determine feature width (number of values per reading)
    all_widths = set()
    for vecs in by_label.values():
        for v in vecs:
            all_widths.add(len(v))
    feat_width = max(all_widths) if all_widths else 3  # default 3 (ax, ay, az)

    # Chop each label's readings into non-overlapping windows
    windows = []
    window_labels = []
    for label, vectors in by_label.items():
        # Pad each vector to feat_width
        padded = [v + [0.0] * (feat_width - len(v)) for v in vectors]
        for start in range(0, len(padded) - window_size + 1, window_size // 2):  # 50% overlap
            window = padded[start:start + window_size]
            if len(window) == window_size:
                flat = []
                for v in window:
                    flat.extend(v)
                windows.append(flat)
                window_labels.append(label_map[label])

    if len(windows) == 0:
        # Fallback: if not enough data for windows, treat each sample as a feature vector
        print(f"[Data] Not enough consecutive samples for windowing (need {window_size}). Using raw vectors.")
        return _load_sensor_raw(samples, labels, feat_width)

    X = np.array(windows, dtype=np.float32)
    # Normalize
    mean = X.mean(axis=0, keepdims=True)
    std = X.std(axis=0, keepdims=True) + 1e-8
    X = (X - mean) / std

    y = keras.utils.to_categorical(window_labels, num_classes=len(labels))
    print(f"[Data] Windowed: {len(windows)} windows of {window_size}×{feat_width} = {X.shape[1]} features, {len(labels)} classes")
    return X, y


def _load_sensor_raw(samples, labels, feat_width=3):
    """Fallback: load raw individual sensor vectors (no windowing)."""
    label_map = {label: idx for idx, label in enumerate(labels)}
    features_list = []
    label_indices = []

    for s in samples:
        feats = s.get("features")
        label = s.get("label", "unknown")
        if not feats or label not in label_map:
            continue
        vec = [float(v) for v in feats]
        # Pad to feat_width
        vec = vec + [0.0] * (feat_width - len(vec))
        features_list.append(vec[:feat_width])
        label_indices.append(label_map[label])

    if len(features_list) == 0:
        raise ValueError("No valid sensor samples could be loaded")

    X = np.array(features_list, dtype=np.float32)
    y = keras.utils.to_categorical(label_indices, num_classes=len(labels))
    return X, y


def load_anomaly_samples(samples, window_size=50):
    """
    Load sensor samples for anomaly detection (autoencoder).
    All samples are treated as "normal" — no label filtering needed.
    Returns X where y = X (reconstruction target).
    """
    all_feats = []
    for s in samples:
        feats = s.get("features")
        if not feats:
            continue
        all_feats.append([float(v) for v in feats])

    if len(all_feats) == 0:
        raise ValueError("No valid sensor samples for anomaly training")

    feat_width = max(len(v) for v in all_feats)
    padded = [v + [0.0] * (feat_width - len(v)) for v in all_feats]

    # Window the data
    windows = []
    for start in range(0, len(padded) - window_size + 1, window_size // 2):
        window = padded[start:start + window_size]
        if len(window) == window_size:
            flat = []
            for v in window:
                flat.extend(v)
            windows.append(flat)

    if len(windows) == 0:
        # Fallback: use raw vectors
        X = np.array(padded, dtype=np.float32)
    else:
        X = np.array(windows, dtype=np.float32)

    # Normalize
    mean = X.mean(axis=0, keepdims=True)
    std = X.std(axis=0, keepdims=True) + 1e-8
    X = (X - mean) / std

    print(f"[Data] Anomaly: {X.shape[0]} samples, {X.shape[1]} features")
    return X


def stratified_split_indices(y, val_ratio=0.2):
    """
    Return train/val indices while preserving class distribution.
    Falls back to random split when classes are too sparse.
    """
    n = len(y)
    if n <= 2:
        return np.arange(n), np.array([], dtype=np.int64)

    y_cls = np.argmax(y, axis=1)
    unique = np.unique(y_cls)
    train_idx = []
    val_idx = []
    for cls in unique:
        cls_idx = np.where(y_cls == cls)[0]
        np.random.shuffle(cls_idx)
        if len(cls_idx) < 2:
            train_idx.extend(cls_idx.tolist())
            continue
        cut = max(1, int(len(cls_idx) * (1.0 - val_ratio)))
        if cut >= len(cls_idx):
            cut = len(cls_idx) - 1
        train_idx.extend(cls_idx[:cut].tolist())
        val_idx.extend(cls_idx[cut:].tolist())

    if len(val_idx) == 0:
        perm = np.random.permutation(n)
        split = max(1, int(n * (1.0 - val_ratio)))
        if split >= n:
            split = n - 1
        train_idx = perm[:split].tolist()
        val_idx = perm[split:].tolist()

    return np.array(train_idx, dtype=np.int64), np.array(val_idx, dtype=np.int64)


def compute_class_weights(y_one_hot):
    """Balanced class weights for imbalanced datasets."""
    y_cls = np.argmax(y_one_hot, axis=1)
    classes, counts = np.unique(y_cls, return_counts=True)
    if len(classes) == 0:
        return None
    total = counts.sum()
    num_classes = len(classes)
    weights = {
        int(cls): float(total / max(1.0, num_classes * count))
        for cls, count in zip(classes, counts)
    }
    return weights


# ── Model Builders ───────────────────────────────────────────────

def build_mobilenet_v1(input_shape, num_classes, alpha=0.25, learning_rate=0.001, dropout=0.35):
    """MobileNetV1 transfer learning for image classification."""
    weights_val = "imagenet" if alpha in [0.25, 0.5, 0.75, 1.0] else None
    base = keras.applications.MobileNet(
        input_shape=input_shape,
        alpha=alpha,
        include_top=False,
        weights=weights_val,
    )
    # Freeze base layers for transfer learning if we loaded weights
    if weights_val == "imagenet":
        for layer in base.layers:
            layer.trainable = False

    model = keras.Sequential([
        keras.Input(shape=input_shape),
        layers.RandomFlip("horizontal"),
        layers.RandomRotation(0.06),
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(dropout),
        layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.03),
        metrics=["accuracy"],
    )
    return model


def build_fomo(input_shape, num_classes, learning_rate=0.001, dropout=0.25):
    """
    Real FOMO-style head: strided CNN → spatial grid (e.g. 12×12 for 96×96 input,
    stride 8) with **sigmoid** per class (multi-label heatmaps over centroids).
    Trained with `objects` centroid targets from Firestore (see load_fomo_samples).
    """
    inputs = keras.Input(shape=input_shape)
    x = layers.RandomFlip("horizontal")(inputs)
    x = layers.Conv2D(16, 3, strides=2, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.SeparableConv2D(32, 3, strides=2, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.SeparableConv2D(64, 3, strides=2, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.SeparableConv2D(96, 3, strides=2, padding="same", activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Conv2D(num_classes, 1, activation="sigmoid", padding="same")(x)
    model = keras.Model(inputs, outputs)
    try:
        focal = keras.losses.BinaryFocalCrossentropy(gamma=2.0, alpha=0.25, from_logits=False)
    except Exception:
        focal = keras.losses.BinaryCrossentropy()
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=focal,
        metrics=[keras.metrics.BinaryAccuracy(threshold=0.35, name="binary_accuracy")],
    )
    return model


def build_1d_cnn(input_length, num_classes, learning_rate=0.001, dropout=0.25):
    """1D CNN for IMU gesture recognition or MFCC audio classification."""
    model = keras.Sequential([
        keras.Input(shape=(input_length,)),
        layers.Reshape((-1, 1)),
        layers.Conv1D(8, 3, activation="relu", padding="same"),
        layers.MaxPooling1D(2),
        layers.Conv1D(16, 3, activation="relu", padding="same"),
        layers.MaxPooling1D(2),
        layers.SeparableConv1D(32, 3, activation="relu", padding="same"),
        layers.GlobalAveragePooling1D(),
        layers.Dense(32, activation="relu"),
        layers.Dropout(dropout),
        layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.02),
        metrics=["accuracy"],
    )
    return model


def build_ds_cnn(input_length, num_classes, learning_rate=0.001, dropout=0.25):
    """
    Depthwise Separable CNN for keyword spotting / audio classification.
    Uses depthwise separable convolutions for efficiency on microcontrollers.
    """
    inputs = keras.Input(shape=(input_length,))
    x = layers.Reshape((-1, 1))(inputs)

    # Initial standard convolution
    x = layers.Conv1D(16, 5, activation="relu", padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling1D(2)(x)

    # Depthwise separable conv blocks
    for filters in [32, 32, 64]:
        x = layers.DepthwiseConv1D(5, padding="same", activation="relu")(x)
        x = layers.BatchNormalization()(x)
        x = layers.Conv1D(filters, 1, activation="relu")(x)  # pointwise
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling1D(2)(x)

    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = keras.Model(inputs, outputs)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def build_autoencoder(input_length, learning_rate=0.001):
    """Autoencoder for anomaly detection (reconstruction-based)."""
    bottleneck = max(2, input_length // 8)
    mid = max(4, input_length // 4)

    model = keras.Sequential([
        keras.Input(shape=(input_length,)),
        layers.Dense(mid, activation="relu"),
        layers.Dense(bottleneck, activation="relu"),
        layers.Dense(mid, activation="relu"),
        layers.Dense(input_length, activation="linear"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="mse",
        metrics=["mae"],
    )
    return model


def build_autoencoder_tiny(input_length, learning_rate=0.001):
    """Tiny autoencoder — smaller bottleneck for very constrained devices."""
    bottleneck = max(2, input_length // 16)

    model = keras.Sequential([
        keras.Input(shape=(input_length,)),
        layers.Dense(8, activation="relu"),
        layers.Dense(bottleneck, activation="relu"),
        layers.Dense(8, activation="relu"),
        layers.Dense(input_length, activation="linear"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="mse",
        metrics=["mae"],
    )
    return model


def _inverted_residual_block(x, filters, expand_ratio=2, stride=1):
    """MobileNetV2-style inverted residual: expand → depthwise → project."""
    in_ch = int(x.shape[-1])
    expanded = int(in_ch * expand_ratio)
    shortcut = x

    # Expand
    if expand_ratio != 1:
        x = layers.Conv2D(expanded, 1, padding="same", use_bias=False)(x)
        x = layers.BatchNormalization()(x)
        x = layers.ReLU(max_value=6)(x)

    # Depthwise
    x = layers.DepthwiseConv2D(3, strides=stride, padding="same", use_bias=False)(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU(max_value=6)(x)

    # Project (linear bottleneck — no activation)
    x = layers.Conv2D(filters, 1, padding="same", use_bias=False)(x)
    x = layers.BatchNormalization()(x)

    # Residual connection when dimensions match
    if stride == 1 and in_ch == filters:
        x = layers.Add()([shortcut, x])
    return x


def build_face_recognition(input_shape, num_classes, embedding_dim=64,
                           learning_rate=0.001, dropout=0.4):
    """
    Face recognition via MobileNetV2 transfer learning for ESP32-CAM.

    Uses ImageNet-pretrained MobileNetV2 (alpha=0.35) as the backbone so the
    model starts with strong visual features instead of random weights. This
    lets it learn to distinguish faces with just 10-30 images per person.

    Architecture:
      • MobileNetV2 α=0.35 backbone (frozen for initial training)
      • 64-dim embedding head with BatchNorm
      • Softmax classification (person labels)
      • Aggressive face-specific augmentation for small-dataset robustness

    INT8 quantized: ~250-350KB TFLite | ~10 FPS on ESP32-CAM at 240 MHz.
    """
    # Pretrained backbone — freeze for head training, unfreeze later for fine-tuning
    base = keras.applications.MobileNetV2(
        input_shape=input_shape,
        alpha=0.35,
        include_top=False,
        weights="imagenet",
    )
    for layer in base.layers:
        layer.trainable = False

    inputs = keras.Input(shape=input_shape)

    # ── Aggressive face-specific augmentation ──
    # Small face datasets REQUIRE heavy augmentation to avoid overfitting.
    x = layers.RandomFlip("horizontal")(inputs)
    x = layers.RandomRotation(0.10)(x)
    x = layers.RandomZoom((-0.15, 0.15))(x)
    x = layers.RandomBrightness(factor=0.20)(x)
    x = layers.RandomContrast(factor=0.20)(x)
    # Gaussian noise layer for regularization
    x = layers.GaussianNoise(0.05)(x)

    # ── Pretrained backbone ──
    x = base(x)

    # ── Face embedding head ──
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(embedding_dim * 2, activation="relu")(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Dense(embedding_dim, use_bias=False)(x)
    x = layers.BatchNormalization(name="embedding")(x)

    # ── Classification head ──
    x = layers.Dropout(dropout * 0.5)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = keras.Model(inputs, outputs)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=["accuracy"],
    )
    return model


# ── TFLite Conversion ────────────────────────────────────────────

def convert_to_tflite(model, X_representative=None):
    """Convert Keras model to quantized INT8 TFLite."""
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter._experimental_lower_tensor_list_ops = False

    if X_representative is not None and len(X_representative) > 0:
        def representative_dataset():
            for i in range(min(100, len(X_representative))):
                sample = X_representative[i:i+1].astype(np.float32)
                yield [sample]
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.int8
        converter.inference_output_type = tf.int8

    try:
        tflite_model = converter.convert()
    except Exception as e:
        print(f"[Train] INT8 conversion failed ({e}). Falling back to dynamic-range quantization.")
        fallback = tf.lite.TFLiteConverter.from_keras_model(model)
        fallback.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = fallback.convert()
    return tflite_model


def tflite_to_c_header(tflite_bytes, var_name="model_data"):
    """Convert TFLite binary to a C header file for embedding."""
    hex_lines = []
    for i in range(0, len(tflite_bytes), 12):
        chunk = tflite_bytes[i:i+12]
        hex_str = ", ".join(f"0x{b:02x}" for b in chunk)
        hex_lines.append(f"  {hex_str},")

    header = f"""// Auto-generated by BitBlock ML Training Service
// Model size: {len(tflite_bytes)} bytes

#ifndef {var_name.upper()}_H
#define {var_name.upper()}_H

#include <cstdint>

alignas(8) const unsigned char {var_name}[] = {{
{chr(10).join(hex_lines)}
}};

const unsigned int {var_name}_len = {len(tflite_bytes)};

#endif // {var_name.upper()}_H
"""
    return header


# ── Main Training Entry Point ────────────────────────────────────

ARCH_CONFIG = {
    "mobilenet_v1":      {"data": "image",   "res": (96, 96)},
    "face_recognition":  {"data": "image",   "res": (96, 96)},
    "fomo":              {"data": "image_fomo", "res": (96, 96), "grid_stride": 8},
    "cnn_1d_mfcc":       {"data": "sensor",  "window": 50},
    "ds_cnn":            {"data": "sensor",  "window": 50},
    "cnn_1d_imu":        {"data": "sensor",  "window": 50},
    "autoencoder":       {"data": "anomaly", "window": 50},
    "autoencoder_tiny":  {"data": "anomaly", "window": 50},
}


def run_training(samples, labels, architecture, task, bucket, on_epoch=None, on_phase=None, hyperparams=None):
    """
    Main training function.
    Returns (tflite_bytes, c_header_string).
    """
    if hyperparams is None:
        hyperparams = {}
    config = ARCH_CONFIG.get(architecture)
    if not config:
        raise ValueError(f"Unknown architecture: {architecture}")

    data_type = config["data"]
    num_classes = len(labels)
    epochs = int(hyperparams.get("epochs", 20))
    batch_size = int(hyperparams.get("batch_size", 32))
    learning_rate = float(hyperparams.get("learning_rate", 0.001))
    window_size = int(hyperparams.get("window_size", config.get("window", 50)))
    dropout = float(hyperparams.get("dropout", 0.25))
    fine_tune_epochs = int(hyperparams.get("fine_tune_epochs", 0))

    history = []
    sample_meta = None

    # ── Load data ──
    if data_type == "image":
        res = config.get("res", (96, 96))
        X, y, sample_meta = load_image_samples(samples, labels, target_size=res)
        input_shape = (*res, 3)
        if architecture == "face_recognition":
            embedding_dim = int(hyperparams.get("embedding_dim", 64))
            model = build_face_recognition(
                input_shape, num_classes, embedding_dim=embedding_dim,
                learning_rate=learning_rate, dropout=dropout
            )
        elif architecture == "mobilenet_v1":
            alpha = float(hyperparams.get("alpha", 0.25))
            model = build_mobilenet_v1(
                input_shape, num_classes, alpha=alpha, learning_rate=learning_rate, dropout=dropout
            )
        else:
            raise ValueError(f"No image model builder for: {architecture}")

    elif data_type == "image_fomo":
        res = tuple(config.get("res", (96, 96)))
        stride = int(config.get("grid_stride", 8))
        X, y, sample_meta, grid_hw = load_fomo_samples(samples, labels, target_size=res, grid_stride=stride)
        input_shape = (*res, 3)
        model = build_fomo(input_shape, num_classes, learning_rate=learning_rate, dropout=dropout)
        print(f"[Train] FOMO grid {grid_hw[0]}×{grid_hw[1]}, heatmap y: {y.shape}")

    elif data_type == "sensor":
        X, y = load_sensor_samples_windowed(samples, labels, window_size=window_size)

        if architecture == "ds_cnn":
            model = build_ds_cnn(X.shape[1], num_classes, learning_rate=learning_rate, dropout=dropout)
        else:
            model = build_1d_cnn(X.shape[1], num_classes, learning_rate=learning_rate, dropout=dropout)

    elif data_type == "anomaly":
        X = load_anomaly_samples(samples, window_size=window_size)
        y = X.copy()  # reconstruction target

        if architecture == "autoencoder_tiny":
            model = build_autoencoder_tiny(X.shape[1], learning_rate=learning_rate)
        else:
            model = build_autoencoder(X.shape[1], learning_rate=learning_rate)

    else:
        raise ValueError(f"Unknown data type: {data_type}")

    try:
        params = model.count_params()
    except Exception:
        # Fallback: force-build from data shape if Keras hasn't built yet.
        if data_type in ("image", "image_fomo"):
            model.build((None, input_shape[0], input_shape[1], input_shape[2]))
        else:
            model.build((None, X.shape[1]))
        params = model.count_params()

    print(f"[Train] Architecture: {architecture}, Samples: {len(X)}, Classes: {num_classes}")
    print(f"[Train] Input shape: {X.shape}, Model params: {params}")

    # ── Train ──
    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch_num, logs=None):
            logs = logs or {}
            loss = logs.get("loss", 0)
            acc = logs.get("binary_accuracy", logs.get("accuracy", logs.get("mae", 0)))
            val_loss = logs.get("val_loss")
            val_acc = logs.get("val_binary_accuracy", logs.get("val_accuracy", logs.get("val_mae")))
            lr = float(tf.keras.backend.get_value(self.model.optimizer.learning_rate))
            history.append({
                "epoch": int(epoch_num + 1),
                "loss": float(loss),
                "accuracy": float(acc),
                "val_loss": float(val_loss) if val_loss is not None else None,
                "val_accuracy": float(val_acc) if val_acc is not None else None,
                "lr": lr,
            })
            if on_epoch:
                on_epoch(epoch_num + 1, float(loss), float(acc))
            print(f"  Epoch {epoch_num+1}/{epochs}: loss={loss:.4f}, metric={acc:.4f}")

    if data_type == "anomaly":
        indices = np.random.permutation(len(X))
        split = max(1, int(len(indices) * 0.8))
        if split >= len(indices):
            split = len(indices) - 1
        train_idx = indices[:split]
        val_idx = indices[split:]
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]
    elif data_type == "image_fomo":
        n = len(X)
        if n <= 1:
            train_idx = np.arange(n, dtype=np.int64)
            val_idx = np.array([], dtype=np.int64)
        else:
            perm = np.random.permutation(n)
            split = max(1, int(n * 0.8))
            if split >= n:
                split = n - 1
            train_idx = perm[:split]
            val_idx = perm[split:]
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]
    else:
        train_idx, val_idx = stratified_split_indices(y, val_ratio=0.2)
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]

    # Face recognition needs more patience to converge with aggressive augmentation
    es_patience = 15 if architecture == "face_recognition" else 10
    lr_patience = 5 if architecture == "face_recognition" else 4
    callbacks = [
        ProgressCallback(),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=lr_patience,
            min_lr=1e-6,
            verbose=0,
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=es_patience,
            restore_best_weights=True,
            verbose=0,
        ),
    ]
    class_weight = (
        None
        if data_type in ("anomaly", "image_fomo")
        else compute_class_weights(y_train)
    )

    if on_phase:
        on_phase("training")

    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val) if len(X_val) > 0 else None,
        epochs=epochs,
        batch_size=min(batch_size, len(X_train)),
        callbacks=callbacks,
        class_weight=class_weight,
        verbose=0,
    )

    # Fine-tuning for transfer learning models
    if architecture in ("mobilenet_v1", "face_recognition") and fine_tune_epochs > 0:
        base_model = None
        for layer in model.layers:
            if isinstance(layer, keras.Model) and "mobilenet" in layer.name.lower():
                base_model = layer
                break
        if base_model is not None:
            # Face recognition: unfreeze more of the backbone for better adaptation
            # MobileNetV2 α=0.35 is small, so 50% gives meaningful gradient flow
            unfreeze_ratio = 0.5 if architecture == "face_recognition" else 0.75
            unfreeze_from = int(len(base_model.layers) * unfreeze_ratio)
            for idx, layer in enumerate(base_model.layers):
                layer.trainable = idx >= unfreeze_from

            # Use a much lower LR for fine-tuning to avoid catastrophic forgetting
            ft_lr = max(learning_rate * 0.05, 1e-5) if architecture == "face_recognition" else max(learning_rate * 0.1, 1e-5)
            ft_smoothing = 0.1 if architecture == "face_recognition" else 0.02
            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=ft_lr),
                loss=keras.losses.CategoricalCrossentropy(label_smoothing=ft_smoothing),
                metrics=["accuracy"],
            )

            # Fine-tune callbacks — same patience but lower min LR
            ft_callbacks = [
                ProgressCallback(),
                keras.callbacks.ReduceLROnPlateau(
                    monitor="val_loss",
                    factor=0.5,
                    patience=lr_patience,
                    min_lr=1e-6,
                    verbose=0,
                ),
                keras.callbacks.EarlyStopping(
                    monitor="val_loss",
                    patience=es_patience,
                    restore_best_weights=True,
                    verbose=0,
                ),
            ]

            ft_epochs = max(8, fine_tune_epochs) if architecture == "face_recognition" else max(1, fine_tune_epochs)
            print(f"[Train] Fine-tuning: unfreezing from layer {unfreeze_from}/{len(base_model.layers)}, LR={ft_lr}, epochs={ft_epochs}")
            model.fit(
                X_train,
                y_train,
                validation_data=(X_val, y_val) if len(X_val) > 0 else None,
                epochs=ft_epochs,
                batch_size=min(batch_size, len(X_train)),
                callbacks=ft_callbacks,
                class_weight=class_weight,
                verbose=0,
            )

    # ── Convert to TFLite ──
    print("[Train] Converting to TFLite INT8...")
    if on_phase:
        on_phase("converting")
    tflite_bytes = convert_to_tflite(model, X_representative=X_train)
    print(f"[Train] TFLite model size: {len(tflite_bytes)} bytes ({len(tflite_bytes)/1024:.1f} KB)")

    # ── Generate C header ──
    safe_name = architecture.replace(".", "_").replace("-", "_")
    c_header = tflite_to_c_header(tflite_bytes, var_name=f"{safe_name}_model_data")

    # ── Final Validation Metrics + Confusion Matrix ──
    confusion_matrix = None
    metrics = {}
    diagnostics = {
        "train_history": history,
        "dataset": {
            "total_samples": int(len(X)),
            "train_samples": int(len(X_train)),
            "val_samples": int(len(X_val)),
            "labels": labels,
        },
    }
    if data_type == "image_fomo" and len(X_val) > 0:
        y_pred = model.predict(X_val, verbose=0)
        eval_out = model.evaluate(X_val, y_val, verbose=0, return_dict=True)
        val_loss = float(eval_out.get("loss", 0.0))
        val_acc = float(eval_out.get("binary_accuracy", 0.0))
        per_class = []
        for c in range(num_classes):
            p = np.clip(y_pred[..., c], 0.0, 1.0)
            t = np.clip(y_val[..., c], 0.0, 1.0)
            inter = float(np.sum(p * t))
            s_p = float(np.sum(p))
            s_t = float(np.sum(t))
            dice = float((2 * inter + 1e-6) / (s_p + s_t + 1e-6))
            per_class.append({
                "label": labels[c] if c < len(labels) else f"class_{c}",
                "precision": dice,
                "recall": dice,
                "f1": dice,
                "support": int(np.sum(t > 0.35)),
            })
        macro_f1 = float(np.mean([p["f1"] for p in per_class])) if per_class else 0.0
        bce_tensor = keras.losses.binary_crossentropy(y_val, y_pred)
        per_sample_loss = np.mean(bce_tensor.numpy(), axis=(1, 2, 3))
        order = np.argsort(-per_sample_loss)[:20]
        hard_examples = []
        for li in order:
            vi = int(val_idx[int(li)])
            meta = sample_meta[vi] if sample_meta and vi < len(sample_meta) else {}
            objs = meta.get("objects") or []
            lab_summary = ", ".join(str(o.get("label", "?")) for o in objs[:4]) if objs else ""
            hard_examples.append({
                "sampleId": meta.get("sampleId"),
                "imageUrl": meta.get("imageUrl"),
                "true_label": lab_summary or "fomo",
                "pred_label": "",
                "pred_confidence": float(per_sample_loss[int(li)]),
                "true_confidence": 0.0,
            })
        metrics = {
            "val_loss": val_loss,
            "val_binary_accuracy": val_acc,
            "macro_f1": macro_f1,
            "macro_dice": macro_f1,
        }
        diagnostics.update({
            "per_class": per_class,
            "hard_examples": hard_examples,
            "fomo_grid": {
                "height": int(y.shape[1]),
                "width": int(y.shape[2]),
                "stride": int(config.get("grid_stride", 8)),
            },
        })
    elif data_type not in ("anomaly", "image_fomo") and len(X_val) > 0:
        y_pred = model.predict(X_val, verbose=0)
        y_pred_classes = np.argmax(y_pred, axis=1)
        y_true_classes = np.argmax(y_val, axis=1)
        cm_tensor = tf.math.confusion_matrix(y_true_classes, y_pred_classes, num_classes=num_classes)
        # Firestore does not allow nested arrays. Flatten it to 1D.
        confusion_matrix = tf.reshape(cm_tensor, [-1]).numpy().tolist()

        # Final validation loss/accuracy from model.evaluate
        eval_out = model.evaluate(X_val, y_val, verbose=0, return_dict=True)
        val_loss = float(eval_out.get("loss", 0.0))
        val_acc = float(eval_out.get("accuracy", 0.0))

        # Macro F1 from confusion matrix (no sklearn dependency)
        cm = cm_tensor.numpy().astype(np.float32)
        num_cls = cm.shape[0]
        f1_scores = []
        for i in range(num_cls):
            tp = cm[i, i]
            fp = cm[:, i].sum() - tp
            fn = cm[i, :].sum() - tp
            precision = tp / (tp + fp + 1e-8)
            recall = tp / (tp + fn + 1e-8)
            f1 = (2.0 * precision * recall) / (precision + recall + 1e-8)
            f1_scores.append(float(f1))
        macro_f1 = float(np.mean(f1_scores)) if f1_scores else 0.0

        # Class-wise report + extra aggregate metrics
        per_class = []
        recalls = []
        precisions = []
        supports = []
        weighted_f1_num = 0.0
        for i in range(num_cls):
            tp = cm[i, i]
            fp = cm[:, i].sum() - tp
            fn = cm[i, :].sum() - tp
            support = cm[i, :].sum()
            precision = tp / (tp + fp + 1e-8)
            recall = tp / (tp + fn + 1e-8)
            f1 = (2.0 * precision * recall) / (precision + recall + 1e-8)
            per_class.append({
                "label": labels[i] if i < len(labels) else f"class_{i}",
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
                "support": int(support),
            })
            recalls.append(float(recall))
            precisions.append(float(precision))
            supports.append(float(support))
            weighted_f1_num += float(f1) * float(support)

        support_total = max(1.0, float(np.sum(supports)))
        weighted_f1 = float(weighted_f1_num / support_total)
        precision_macro = float(np.mean(precisions)) if precisions else 0.0
        recall_macro = float(np.mean(recalls)) if recalls else 0.0
        balanced_accuracy = recall_macro

        # Top-2 accuracy
        top2_idx = np.argsort(y_pred, axis=1)[:, -2:]
        top2_hits = [(yt in top2_idx[i]) for i, yt in enumerate(y_true_classes)]
        top2_acc = float(np.mean(top2_hits)) if len(top2_hits) > 0 else 0.0

        # Hard examples (for image models we can map back to URLs exactly)
        hard_examples = []
        if data_type == "image" and sample_meta is not None:
            for local_i, val_i in enumerate(val_idx.tolist()):
                true_idx = int(y_true_classes[local_i])
                pred_idx = int(y_pred_classes[local_i])
                if true_idx == pred_idx:
                    continue
                meta = sample_meta[val_i] if val_i < len(sample_meta) else {}
                hard_examples.append({
                    "sampleId": meta.get("sampleId"),
                    "imageUrl": meta.get("imageUrl"),
                    "true_label": labels[true_idx] if true_idx < len(labels) else f"class_{true_idx}",
                    "pred_label": labels[pred_idx] if pred_idx < len(labels) else f"class_{pred_idx}",
                    "pred_confidence": float(y_pred[local_i, pred_idx]),
                    "true_confidence": float(y_pred[local_i, true_idx]),
                })
            hard_examples.sort(key=lambda x: x["pred_confidence"], reverse=True)
            hard_examples = hard_examples[:20]

        # Most confusing pairs from off-diagonal CM cells
        confusion_pairs = []
        for i in range(num_cls):
            row_total = max(1.0, float(cm[i, :].sum()))
            for j in range(num_cls):
                if i == j:
                    continue
                count = int(cm[i, j])
                if count <= 0:
                    continue
                confusion_pairs.append({
                    "true_label": labels[i] if i < len(labels) else f"class_{i}",
                    "pred_label": labels[j] if j < len(labels) else f"class_{j}",
                    "count": count,
                    "row_error_rate": float(count / row_total),
                })
        confusion_pairs.sort(key=lambda p: p["count"], reverse=True)

        # Confidence histogram of top-1 prediction
        top1_conf = np.max(y_pred, axis=1).astype(np.float32)
        correct_mask = (y_true_classes == y_pred_classes)
        bins = np.linspace(0.0, 1.0, 6)
        corr_hist, _ = np.histogram(top1_conf[correct_mask], bins=bins)
        inc_hist, _ = np.histogram(top1_conf[~correct_mask], bins=bins)
        confidence_hist = [
            {
                "bin": f"{bins[i]:.1f}-{bins[i+1]:.1f}",
                "correct": int(corr_hist[i]),
                "incorrect": int(inc_hist[i]),
            }
            for i in range(len(corr_hist))
        ]

        metrics = {
            "val_loss": val_loss,
            "val_accuracy": val_acc,
            "macro_f1": macro_f1,
            "precision_macro": precision_macro,
            "recall_macro": recall_macro,
            "weighted_f1": weighted_f1,
            "balanced_accuracy": balanced_accuracy,
            "top2_accuracy": top2_acc,
        }
        diagnostics.update({
            "per_class": per_class,
            "hard_examples": hard_examples,
            "confusion_pairs": confusion_pairs[:10],
            "confidence_histogram": confidence_hist,
        })
    elif data_type == "anomaly":
        # Anomaly models reconstruct input, so report validation MSE.
        if len(X_val) > 0:
            recon = model.predict(X_val, verbose=0)
            mse = float(np.mean(np.square(X_val - recon)))
        else:
            recon = model.predict(X_train, verbose=0)
            mse = float(np.mean(np.square(X_train - recon)))
        metrics = {
            "mse": mse,
        }
        diagnostics.update({
            "reconstruction": {
                "val_mse": mse,
                "val_mae": float(np.mean(np.abs((X_val if len(X_val) > 0 else X_train) - recon))),
                "threshold_p95": float(np.percentile(np.mean(np.square((X_val if len(X_val) > 0 else X_train) - recon), axis=1), 95)),
            }
        })

    return tflite_bytes, c_header, confusion_matrix, metrics, diagnostics
