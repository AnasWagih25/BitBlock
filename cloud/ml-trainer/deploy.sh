#!/bin/bash
# Deploy BitBlock ML Training Service to Google Cloud Run
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated: gcloud auth login
#   2. A GCP project: gcloud config set project YOUR_PROJECT_ID
#   3. Cloud Run API enabled: gcloud services enable run.googleapis.com
#
# This script also grants the Cloud Run service account access to
# Firestore and Storage automatically.
#
# Usage: ./deploy.sh

set -e

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="bitblock-ml-trainer"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# Auto-detect storage bucket from project ID
STORAGE_BUCKET="${PROJECT_ID}.firebasestorage.app"

echo "═══════════════════════════════════════════════"
echo "  BitBlock ML Trainer — Cloud Run Deployment"
echo "═══════════════════════════════════════════════"
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo "  Bucket:   $STORAGE_BUCKET"
echo ""

# Enable required APIs
echo "[1/5] Enabling APIs..."
gcloud services enable run.googleapis.com containerregistry.googleapis.com firestore.googleapis.com --quiet

# Build Docker image
echo "[2/5] Building Docker image (this takes ~8 min the first time)..."
gcloud builds submit --tag "$IMAGE" --timeout=1800 .

# Deploy to Cloud Run
echo "[3/5] Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 600 \
  --concurrency 2 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET" \
  --quiet

# Grant the Cloud Run service account access to Firestore and Storage
echo "[4/5] Granting service account permissions..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/datastore.user" \
  --quiet 2>/dev/null || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin" \
  --quiet 2>/dev/null || true

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo ""
echo "[5/5] Done!"
echo "═══════════════════════════════════════════════"
echo "  ML Trainer URL: $SERVICE_URL"
echo ""
echo "  Next steps:"
echo "  1. Set on Netlify: ML_TRAINING_SERVICE_URL=$SERVICE_URL"
echo "  2. Test: curl -X POST $SERVICE_URL/train \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"projectId\":\"test\",\"jobId\":\"test\",\"architecture\":\"cnn_1d_imu\"}'"
echo "═══════════════════════════════════════════════"
