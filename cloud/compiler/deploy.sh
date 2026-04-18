#!/bin/bash
# Deploy BitBlock Compiler Service to Google Cloud Run
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated: gcloud auth login
#   2. A GCP project: gcloud config set project YOUR_PROJECT_ID
#   3. Cloud Run API enabled: gcloud services enable run.googleapis.com
#   4. Artifact Registry enabled: gcloud services enable artifactregistry.googleapis.com
#
# Usage: ./deploy.sh

set -e

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="bitblock-compiler"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "═══════════════════════════════════════════════"
echo "  BitBlock Compiler — Cloud Run Deployment"
echo "═══════════════════════════════════════════════"
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "  Service:  $SERVICE_NAME"
echo ""

# Enable required APIs
echo "[1/4] Enabling APIs..."
gcloud services enable run.googleapis.com containerregistry.googleapis.com --quiet

# Build Docker image
echo "[2/4] Building Docker image (this takes ~5 min the first time)..."
gcloud builds submit --tag "$IMAGE" --timeout=1200 .

# Deploy to Cloud Run
echo "[3/4] Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 5 \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')

echo ""
echo "[4/4] Done!"
echo "═══════════════════════════════════════════════"
echo "  Compiler URL: $SERVICE_URL"
echo ""
echo "  Next steps:"
echo "  1. Set on Netlify: COMPILER_SERVICE_URL=$SERVICE_URL"
echo "  2. Test: curl -X POST $SERVICE_URL/compile \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"code\":\"void setup(){pinMode(13,OUTPUT);}void loop(){digitalWrite(13,HIGH);delay(500);digitalWrite(13,LOW);delay(500);}\",\"fqbn\":\"arduino:avr:uno\"}'"
echo "═══════════════════════════════════════════════"
