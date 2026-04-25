"""
Cloud Run Job entrypoint for BitBlock ML training.

This runs one Firestore training job execution end-to-end, then exits.
The `/train` HTTP endpoint in server.py schedules this job and returns quickly.
"""

import json
import os
import sys

from server import training_worker


def main():
    project_id = os.environ.get("PROJECT_ID")
    job_id = os.environ.get("JOB_ID")
    architecture = os.environ.get("ARCHITECTURE")
    task = os.environ.get("TASK", "classification")
    raw_hyper = os.environ.get("HYPERPARAMETERS_JSON", "{}")

    if not project_id or not job_id or not architecture:
        print("[Job] Missing PROJECT_ID, JOB_ID, or ARCHITECTURE env vars", flush=True)
        return 2

    try:
        hyperparams = json.loads(raw_hyper) if raw_hyper else {}
        if not isinstance(hyperparams, dict):
            hyperparams = {}
    except Exception:
        hyperparams = {}

    raw_ds = os.environ.get("DATASET_IDS_JSON", "[]")
    try:
        dataset_ids = json.loads(raw_ds) if raw_ds else []
        if not isinstance(dataset_ids, list):
            dataset_ids = []
    except Exception:
        dataset_ids = []

    print(
        f"[Job] Starting training job_id={job_id} project_id={project_id} arch={architecture} task={task}",
        flush=True,
    )
    for line in training_worker(project_id, job_id, architecture, task, hyperparams, dataset_ids):
        print(line.strip(), flush=True)

    print("[Job] Training execution finished.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

