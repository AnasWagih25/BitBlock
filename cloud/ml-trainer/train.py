"""
BitBlock ML Training — Model builders and training loop.

Supports all architectures defined in MLCapabilities.ts:
- MobileNetV1 (image classification via transfer learning)
- FOMO (object detection / image classification)
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
    """Download images from Firebase Storage URLs and return X, y arrays."""
    images = []
    label_indices = []
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
        except Exception as e:
            print(f"[Data] Skipping sample: {e}")
            continue

    if len(images) == 0:
        raise ValueError("No valid image samples could be loaded")

    X = np.array(images)
    y = keras.utils.to_categorical(label_indices, num_classes=len(labels))
    return X, y


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


# ── Model Builders ───────────────────────────────────────────────

def build_mobilenet_v1(input_shape, num_classes, alpha=0.25, learning_rate=0.001):
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
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def build_fomo(input_shape, num_classes, learning_rate=0.001):
    """FOMO-style object detection (simple version - outputs grid predictions)."""
    model = keras.Sequential([
        layers.Conv2D(8, 3, strides=2, padding="same", activation="relu", input_shape=input_shape),
        layers.Conv2D(16, 3, strides=2, padding="same", activation="relu"),
        layers.Conv2D(32, 3, strides=2, padding="same", activation="relu"),
        layers.Conv2D(num_classes, 1, activation="softmax"),
        layers.GlobalAveragePooling2D(),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def build_1d_cnn(input_length, num_classes, learning_rate=0.001):
    """1D CNN for IMU gesture recognition or MFCC audio classification."""
    model = keras.Sequential([
        layers.Reshape((-1, 1), input_shape=(input_length,)),
        layers.Conv1D(8, 3, activation="relu", padding="same"),
        layers.MaxPooling1D(2),
        layers.Conv1D(16, 3, activation="relu", padding="same"),
        layers.MaxPooling1D(2),
        layers.Conv1D(32, 3, activation="relu", padding="same"),
        layers.GlobalAveragePooling1D(),
        layers.Dense(32, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(num_classes, activation="softmax"),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def build_ds_cnn(input_length, num_classes, learning_rate=0.001):
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
    x = layers.Dropout(0.3)(x)
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
        layers.Dense(mid, activation="relu", input_shape=(input_length,)),
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
        layers.Dense(8, activation="relu", input_shape=(input_length,)),
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


# ── TFLite Conversion ────────────────────────────────────────────

def convert_to_tflite(model, X_representative=None):
    """Convert Keras model to quantized INT8 TFLite."""
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    if X_representative is not None and len(X_representative) > 0:
        def representative_dataset():
            for i in range(min(100, len(X_representative))):
                sample = X_representative[i:i+1].astype(np.float32)
                yield [sample]
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type = tf.int8
        converter.inference_output_type = tf.int8

    tflite_model = converter.convert()
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
    "fomo":              {"data": "image",   "res": (96, 96)},
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
    window_size = config.get("window", 50)

    # ── Load data ──
    if data_type == "image":
        res = config.get("res", (96, 96))
        X, y = load_image_samples(samples, labels, target_size=res)
        input_shape = (*res, 3)

        if architecture == "mobilenet_v1":
            alpha = float(hyperparams.get("alpha", 0.25))
            model = build_mobilenet_v1(input_shape, num_classes, alpha=alpha, learning_rate=learning_rate)
        elif architecture == "fomo":
            model = build_fomo(input_shape, num_classes, learning_rate=learning_rate)
        else:
            raise ValueError(f"No image model builder for: {architecture}")

    elif data_type == "sensor":
        X, y = load_sensor_samples_windowed(samples, labels, window_size=window_size)

        if architecture == "ds_cnn":
            model = build_ds_cnn(X.shape[1], num_classes, learning_rate=learning_rate)
        else:
            model = build_1d_cnn(X.shape[1], num_classes, learning_rate=learning_rate)

    elif data_type == "anomaly":
        X = load_anomaly_samples(samples, window_size=window_size)
        y = X.copy()  # reconstruction target

        if architecture == "autoencoder_tiny":
            model = build_autoencoder_tiny(X.shape[1], learning_rate=learning_rate)
        else:
            model = build_autoencoder(X.shape[1], learning_rate=learning_rate)

    else:
        raise ValueError(f"Unknown data type: {data_type}")

    print(f"[Train] Architecture: {architecture}, Samples: {len(X)}, Classes: {num_classes}")
    print(f"[Train] Input shape: {X.shape}, Model params: {model.count_params()}")

    # ── Train ──
    class ProgressCallback(keras.callbacks.Callback):
        def on_epoch_end(self, epoch_num, logs=None):
            loss = logs.get("loss", 0)
            acc = logs.get("accuracy", logs.get("mae", 0))
            if on_epoch:
                on_epoch(epoch_num + 1, float(loss), float(acc))
            print(f"  Epoch {epoch_num+1}/{epochs}: loss={loss:.4f}, metric={acc:.4f}")

    # Train/val split (shuffle first to avoid label-grouped bias)
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]

    split = max(1, int(len(X) * 0.8))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    if on_phase:
        on_phase("training")

    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val) if len(X_val) > 0 else None,
        epochs=epochs,
        batch_size=min(batch_size, len(X_train)),
        callbacks=[ProgressCallback()],
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

    return tflite_bytes, c_header
