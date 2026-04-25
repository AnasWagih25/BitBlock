"""
BitBlock ML Training Service — Flask server for Cloud Run.

Receives training job requests, trains TensorFlow models from Firestore samples,
and uploads quantized TFLite models back to Firebase Storage.

IMPORTANT: Training runs SYNCHRONOUSLY in the request handler (not in a
background thread) because Cloud Run throttles CPU after a response is sent.
The frontend uses a Firestore listener for real-time progress, so it does
not depend on this HTTP response to complete quickly.
"""

import os
import json
import traceback
from flask import Flask, request, jsonify, Response, stream_with_context
import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest
import requests

import firebase_admin
from firebase_admin import credentials, firestore, storage
import tensorflow as tf
import numpy as np
from PIL import Image

from train import run_training, ARCH_CONFIG

app = Flask(__name__)

# CORS — allow browser-based requests (local dev + production)
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

# Initialize Firebase Admin SDK
# On Cloud Run, Application Default Credentials work automatically
# if the service account has the right permissions.
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", ""),
    })

db = firestore.client()
bucket = storage.bucket()


def _coerce_sample_ids(raw):
    """Match client DataCollection: sampleIds may be array or string-keyed map."""
    if isinstance(raw, list):
        return sorted(
            {str(x).strip() for x in raw if isinstance(x, str) and str(x).strip()}
        )
    if isinstance(raw, dict):
        return sorted(
            {str(x).strip() for x in raw.values() if isinstance(x, str) and str(x).strip()}
        )
    return []


def _normalize_id_list(raw):
    if not isinstance(raw, list):
        return []
    return sorted({str(x).strip() for x in raw if str(x).strip()})


TRAINING_JOB_NAME = os.environ.get("TRAINING_JOB_NAME", "bitblock-ml-trainer-job")
TRAINING_JOB_REGION = os.environ.get("TRAINING_JOB_REGION", os.environ.get("REGION", "us-central1"))
GOOGLE_CLOUD_PROJECT = (
    os.environ.get("GOOGLE_CLOUD_PROJECT")
    or os.environ.get("GCP_PROJECT")
    or os.environ.get("GCLOUD_PROJECT")
)


def update_job(project_id: str, job_id: str, data: dict):
    """Update a training job document in Firestore."""
    db.document(f"projects/{project_id}/jobs/{job_id}").update(data)


def trigger_training_job_execution(project_id: str, job_id: str, architecture: str, task: str, hyperparams: dict):
    """Trigger Cloud Run Job execution with per-request env overrides."""
    if not GOOGLE_CLOUD_PROJECT:
        raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT environment variable on training service")

    creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(GoogleAuthRequest())

    run_url = (
        f"https://run.googleapis.com/v2/projects/{GOOGLE_CLOUD_PROJECT}"
        f"/locations/{TRAINING_JOB_REGION}/jobs/{TRAINING_JOB_NAME}:run"
    )
    env_overrides = [
        {"name": "PROJECT_ID", "value": project_id},
        {"name": "JOB_ID", "value": job_id},
        {"name": "ARCHITECTURE", "value": architecture},
        {"name": "TASK", "value": task or "classification"},
        {"name": "HYPERPARAMETERS_JSON", "value": json.dumps(hyperparams or {})},
    ]
    body = {
        "overrides": {
            "containerOverrides": [
                {"env": env_overrides}
            ]
        }
    }

    resp = requests.post(
        run_url,
        headers={
            "Authorization": f"Bearer {creds.token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=30,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Failed to start training job ({resp.status_code}): {resp.text[:500]}")

    payload = resp.json() if resp.text else {}
    return payload.get("name"), payload


def training_worker(
    project_id: str,
    job_id: str,
    architecture: str,
    task: str,
    hyperparams: dict,
    dataset_ids: list | None = None,
    sample_ids: list | None = None,
):
    """
    Runs the full training pipeline.
    Called synchronously from the request handler so Cloud Run keeps CPU alive.
    Yields progress strings for the streaming response.
    """
    try:
        update_job(project_id, job_id, {"status": "fetching_data"})
        yield f"status: fetching_data\n"

        # 1. Fetch training samples from Firestore
        samples_ref = db.collection(f"projects/{project_id}/ml_samples")

        # Determine expected data type from architecture
        arch_config = ARCH_CONFIG.get(architecture, {})
        expected_data = arch_config.get("data", "sensor")

        # Filter samples by type to avoid mixing image + sensor data
        all_samples = [doc.to_dict() | {"id": doc.id} for doc in samples_ref.stream()]
        total_all_raw = len(all_samples)

        raw_ids = dataset_ids if isinstance(dataset_ids, list) else []
        dataset_ids_norm = [str(x).strip() for x in raw_ids if str(x).strip()]
        direct_sample_ids = set(_normalize_id_list(sample_ids))
        if len(dataset_ids_norm) < 2:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": (
                    "Select at least 2 saved datasets in the Training tab. "
                    "Create datasets under Data Collection → Cloud library."
                ),
            })
            yield "status: failed (need 2 datasets)\n"
            return

        allowed_sample_ids = set(direct_sample_ids)
        missing_docs: list[str] = []
        if len(allowed_sample_ids) == 0:
            for ds_id in dataset_ids_norm:
                snap = db.document(f"projects/{project_id}/ml_datasets/{ds_id}").get()
                if not snap.exists:
                    missing_docs.append(ds_id)
                    continue
                d = snap.to_dict() or {}
                allowed_sample_ids.update(_coerce_sample_ids(d.get("sampleIds")))

        if missing_docs:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": f"Unknown or deleted dataset id(s): {', '.join(missing_docs[:8])}",
            })
            yield "status: failed (missing datasets)\n"
            return

        if len(allowed_sample_ids) == 0:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": "Selected datasets contain no sample references. Add samples to your datasets in Data Collection.",
            })
            yield "status: failed (empty datasets)\n"
            return

        all_samples = [s for s in all_samples if s.get("id") in allowed_sample_ids]

        if expected_data == "image":
            samples = [s for s in all_samples if s.get("imageUrl")]
        elif expected_data == "image_fomo":
            samples = []
            for s in all_samples:
                if not s.get("imageUrl"):
                    continue
                objs = s.get("objects")
                if not isinstance(objs, list) or len(objs) == 0:
                    continue
                has_point = False
                for o in objs:
                    if isinstance(o, dict) and o.get("label") is not None:
                        if "cx" in o and "cy" in o:
                            has_point = True
                            break
                if has_point:
                    samples.append(s)
        elif expected_data in ("sensor", "anomaly"):
            samples = [s for s in all_samples if s.get("features")]
        else:
            samples = all_samples

        if len(samples) < 2:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": f"Need at least 2 samples to train. Found {len(samples)} "
                         f"(filtered for {expected_data} data from {len(all_samples)} total)."
            })
            yield f"status: failed (insufficient data)\n"
            return

        # Build sorted label list for deterministic label→index mapping
        if expected_data == "image_fomo":
            obj_labels = []
            for s in samples:
                for o in s.get("objects") or []:
                    if isinstance(o, dict) and o.get("label") is not None:
                        obj_labels.append(str(o["label"]))
            labels = sorted(set(obj_labels))
        else:
            labels = sorted(set(s.get("label", "unknown") for s in samples))

        # Log label distribution for debugging
        label_counts = {}
        if expected_data == "image_fomo":
            for s in samples:
                for o in s.get("objects") or []:
                    if isinstance(o, dict) and o.get("label") is not None:
                        l = str(o["label"])
                        label_counts[l] = label_counts.get(l, 0) + 1
        else:
            for s in samples:
                l = s.get("label", "unknown")
                label_counts[l] = label_counts.get(l, 0) + 1
        print(f"[Data] Label distribution: {label_counts}")
        print(f"[Data] Sorted labels: {labels} ({len(labels)} classes, {len(samples)} samples)")
        print(f"[Data] Selected datasetIds: {dataset_ids_norm}")
        print(f"[Data] Selected sample refs: {len(allowed_sample_ids)}")

        if expected_data == "image_fomo" and len(labels) < 1:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": "FOMO needs at least one class label on centroid objects[]. "
                         "Annotate images in Data Collection (Mark objects mode).",
            })
            yield f"status: failed (fomo labels)\n"
            return

        # For classification tasks, require at least 2 different labels
        is_anomaly = expected_data == "anomaly"
        is_fomo = expected_data == "image_fomo"
        if not is_anomaly and not is_fomo and len(labels) < 2:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": f"Classification models need ≥2 different labels. Found: {labels}. "
                         f"Add more data with different labels."
            })
            yield f"status: failed (need more labels)\n"
            return

        update_job(project_id, job_id, {
            "status": "loading_data",
            "totalSamples": len(samples),
            "labels": labels,
        })
        yield f"status: loading_data, samples: {len(samples)}, labels: {len(labels)}\n"

        # 2. Run training
        def on_epoch(epoch, loss, acc):
            update_job(project_id, job_id, {
                "epoch": epoch,
                "loss": round(loss, 6),
                "acc": round(acc, 6),
            })
            
        def on_phase(phase):
            update_job(project_id, job_id, {"status": phase})

        tflite_bytes, c_header, confusion_matrix, metrics, diagnostics = run_training(
            samples=samples,
            labels=labels,
            architecture=architecture,
            task=task,
            bucket=bucket,
            on_epoch=on_epoch,
            on_phase=on_phase,
            hyperparams=hyperparams,
        )

        # 3. Upload TFLite model to Storage
        update_job(project_id, job_id, {"status": "uploading"})
        tflite_path = f"projects/{project_id}/models/{job_id}.tflite"
        tflite_blob = bucket.blob(tflite_path)
        tflite_blob.upload_from_string(tflite_bytes, content_type="application/octet-stream")
        tflite_blob.make_public()
        tflite_url = tflite_blob.public_url

        # 4. Upload C header
        header_path = f"projects/{project_id}/models/{job_id}_model_data.h"
        header_blob = bucket.blob(header_path)
        header_blob.upload_from_string(c_header, content_type="text/plain")
        header_blob.make_public()
        header_url = header_blob.public_url

        # Dataset snapshot at training time (for model registry / version control)
        n_image = sum(1 for s in all_samples if s.get("imageUrl"))
        n_sensor = sum(1 for s in all_samples if s.get("features"))
        dataset_snapshot = {
            "expectedDataType": expected_data,
            "samplesUsed": len(samples),
            "totalSamplesInProject": total_all_raw,
            "unionSampleRefsInDatasets": len(allowed_sample_ids),
            "datasetIds": dataset_ids_norm,
            "sampleIds": sorted(list(allowed_sample_ids)),
            "samplesWithImage": n_image,
            "samplesWithFeatures": n_sensor,
            "labelCountsTraining": label_counts,
        }

        # 5. Mark job complete
        update_job(project_id, job_id, {
            "status": "completed",
            "completedAt": firestore.SERVER_TIMESTAMP,
            "modelUrl": tflite_url,
            "headerUrl": header_url,
            "modelSizeBytes": len(tflite_bytes),
            "labels": labels,
            "confusionMatrix": confusion_matrix,
            "metrics": metrics,
            "diagnostics": diagnostics,
            "datasetSnapshot": dataset_snapshot,
            "task": task,
            "arch": architecture,
        })

        print(f"[Train] Job {job_id} completed: {len(tflite_bytes)} bytes, {len(labels)} classes")
        yield f"status: completed, size: {len(tflite_bytes)}\n"

    except Exception as e:
        traceback.print_exc()
        try:
            update_job(project_id, job_id, {
                "status": "failed",
                "error": str(e)[:500],
            })
        except:
            pass
        yield f"status: failed, error: {str(e)[:200]}\n"


@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "bitblock-ml-trainer"})


@app.route("/train", methods=["POST"])
def start_training():
    data = request.get_json(force=True)
    project_id = data.get("projectId")
    job_id = data.get("jobId")
    architecture = data.get("architecture")
    task = data.get("task", "classification")
    hyperparams = data.get("hyperparameters", {})
    raw_ds = data.get("datasetIds")
    if isinstance(raw_ds, list):
        dataset_ids = [str(x).strip() for x in raw_ds if str(x).strip()]
    else:
        dataset_ids = []
    sample_ids = _normalize_id_list(data.get("sampleIds"))

    if not project_id or not job_id or not architecture:
        return jsonify({"error": "Missing projectId, jobId, or architecture"}), 400

    if architecture not in ARCH_CONFIG:
        return jsonify({"error": f"Unknown architecture: {architecture}. "
                        f"Valid: {list(ARCH_CONFIG.keys())}"}), 400

    # Run training synchronously in the service request for lower queue latency.
    return Response(
        stream_with_context(
            training_worker(project_id, job_id, architecture, task, hyperparams, dataset_ids, sample_ids)
        ),
        content_type="text/plain",
        status=200,
    )


@app.route("/predict", methods=["POST"])
def predict():
    """Run inference on an uploaded file using a trained model."""
    project_id = request.form.get("projectId")
    job_id = request.form.get("jobId")

    if not project_id or not job_id:
        return jsonify({"error": "Missing projectId or jobId"}), 400

    uploaded = request.files.get("file")
    if not uploaded:
        return jsonify({"error": "No file uploaded"}), 400

    # Look up job to get labels and architecture
    job_doc = db.document(f"projects/{project_id}/jobs/{job_id}").get()
    if not job_doc.exists:
        return jsonify({"error": "Job not found"}), 404
    job_data = job_doc.to_dict()
    labels = job_data.get("labels", [])
    architecture = job_data.get("arch", "")
    arch_config = ARCH_CONFIG.get(architecture, {})
    data_type = arch_config.get("data", "image")

    # Download tflite model from Storage
    tflite_path = f"projects/{project_id}/models/{job_id}.tflite"
    tflite_blob = bucket.blob(tflite_path)
    if not tflite_blob.exists():
        return jsonify({"error": "Model file not found in storage"}), 404

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".tflite", delete=False) as tmp:
        tflite_blob.download_to_filename(tmp.name)
        tmp_path = tmp.name

    try:
        interpreter = tf.lite.Interpreter(model_path=tmp_path)
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        input_shape = input_details[0]["shape"]
        input_dtype = input_details[0]["dtype"]
        in_scale, in_zero_point = input_details[0].get("quantization", (0.0, 0))
        out_scale, out_zero_point = output_details[0].get("quantization", (0.0, 0))

        if data_type in ("image", "image_fomo"):
            img = Image.open(uploaded.stream).convert("RGB")
            target_h, target_w = int(input_shape[1]), int(input_shape[2])
            img = img.resize((target_w, target_h), Image.BILINEAR)
            arr = np.array(img, dtype=np.float32) / 255.0
            if input_dtype == np.int8:
                if in_scale and in_scale > 0:
                    arr = np.round(arr / in_scale + in_zero_point).astype(np.int8)
                else:
                    arr = (arr * 255 - 128).astype(np.int8)
            arr = np.expand_dims(arr, axis=0)
        else:
            raw = uploaded.read().decode("utf-8").strip()
            values = [float(v) for v in raw.replace(",", " ").split()]
            flat_size = int(np.prod(input_shape[1:]))
            values = (values + [0.0] * flat_size)[:flat_size]
            arr = np.array(values, dtype=np.float32).reshape(input_shape)
            if input_dtype == np.int8:
                if in_scale and in_scale > 0:
                    arr = np.round(arr / in_scale + in_zero_point).astype(np.int8)
                else:
                    arr = arr.astype(np.int8)

        interpreter.set_tensor(input_details[0]["index"], arr)
        interpreter.invoke()
        raw_out = interpreter.get_tensor(output_details[0]["index"])
        output = raw_out[0] if getattr(raw_out, "ndim", 0) > 0 else raw_out

        if output_details[0]["dtype"] == np.int8:
            if out_scale and out_scale > 0:
                output = (output.astype(np.float32) - out_zero_point) * out_scale
            else:
                output = output.astype(np.float32)

        output = output.astype(np.float32)

        if architecture == "fomo":
            labels_str = [str(x) for x in labels]
            c = len(labels_str)
            if c == 0:
                return jsonify({"error": "Job has no labels"}), 400
            flat = np.reshape(output, (-1,))
            if flat.size % c != 0:
                return jsonify({"error": "Unexpected FOMO output size"}), 400
            cells = flat.size // c
            gh = int(round(np.sqrt(cells)))
            while gh > 0 and cells % gh != 0:
                gh -= 1
            if gh <= 0:
                gh = 1
            gw = cells // gh
            out_map = flat.reshape(gh, gw, c)
            thresh = 0.28
            predictions = []
            for ci, lab in enumerate(labels_str):
                plane = np.clip(out_map[:, :, ci], 0.0, 1.0)
                if float(np.max(plane)) < thresh:
                    continue
                ij = np.unravel_index(int(np.argmax(plane)), plane.shape)
                ii, jj = int(ij[0]), int(ij[1])
                v = float(plane[ii, jj])
                cx = (jj + 0.5) / max(gw, 1)
                cy = (ii + 0.5) / max(gh, 1)
                predictions.append({
                    "label": lab,
                    "cx": round(cx, 4),
                    "cy": round(cy, 4),
                    "confidence": round(v, 4),
                })
            predictions.sort(key=lambda p: p["confidence"], reverse=True)
            return jsonify({
                "predictions": predictions,
                "outputType": "fomo",
                "grid": {"h": int(gh), "w": int(gw)},
            })

        output = output.astype(float)
        # Softmax if not already (image classification heads)
        if output.min() < 0 or output.sum() < 0.5:
            exp_o = np.exp(output - np.max(output))
            output = exp_o / exp_o.sum()

        predictions = []
        for i, conf in enumerate(np.reshape(output, (-1,))):
            label = labels[i] if i < len(labels) else f"class_{i}"
            predictions.append({"label": label, "confidence": round(float(conf), 4)})
        predictions.sort(key=lambda x: x["confidence"], reverse=True)

        return jsonify({"predictions": predictions})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)[:300]}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
