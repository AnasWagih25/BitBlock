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

import firebase_admin
from firebase_admin import credentials, firestore, storage

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


def update_job(project_id: str, job_id: str, data: dict):
    """Update a training job document in Firestore."""
    db.document(f"projects/{project_id}/jobs/{job_id}").update(data)


def training_worker(project_id: str, job_id: str, architecture: str, task: str, hyperparams: dict):
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

        if expected_data == "image":
            samples = [s for s in all_samples if s.get("imageUrl")]
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
        labels = sorted(set(s.get("label", "unknown") for s in samples))

        # Log label distribution for debugging
        label_counts = {}
        for s in samples:
            l = s.get("label", "unknown")
            label_counts[l] = label_counts.get(l, 0) + 1
        print(f"[Data] Label distribution: {label_counts}")
        print(f"[Data] Sorted labels: {labels} ({len(labels)} classes, {len(samples)} samples)")

        # For classification tasks, require at least 2 different labels
        is_anomaly = expected_data == "anomaly"
        if not is_anomaly and len(labels) < 2:
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

        tflite_bytes, c_header = run_training(
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

        # 5. Mark job complete
        update_job(project_id, job_id, {
            "status": "completed",
            "modelUrl": tflite_url,
            "headerUrl": header_url,
            "modelSizeBytes": len(tflite_bytes),
            "labels": labels,
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

    if not project_id or not job_id or not architecture:
        return jsonify({"error": "Missing projectId, jobId, or architecture"}), 400

    if architecture not in ARCH_CONFIG:
        return jsonify({"error": f"Unknown architecture: {architecture}. "
                        f"Valid: {list(ARCH_CONFIG.keys())}"}), 400

    # Run training SYNCHRONOUSLY via a streaming response.
    # This keeps the HTTP connection open → Cloud Run keeps CPU allocated
    # for the full duration of training.  The frontend does NOT depend on
    # this response; it uses a Firestore onSnapshot listener for progress.
    return Response(
        stream_with_context(training_worker(project_id, job_id, architecture, task, hyperparams)),
        content_type="text/plain",
        status=200,
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
