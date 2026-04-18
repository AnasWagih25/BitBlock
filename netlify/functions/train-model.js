/**
 * Netlify Function: train-model
 * 
 * Receives a training job request, proxies it to the ML Training Cloud Run service.
 * The Cloud Run service handles:
 *   1. Fetching training samples from Firestore (projects/{pid}/ml_samples)
 *   2. Downloading images from Firebase Storage
 *   3. Running TensorFlow training with the specified architecture
 *   4. Updating Firestore job document with epoch/loss/acc in real-time
 *   5. Quantizing to TFLite and uploading the model
 *   6. Setting job status to 'completed' with model download URL
 * 
 * This function acts as a secure proxy — the actual training runs on Cloud Run
 * with Firebase Admin SDK credentials (not exposed to the client).
 * 
 * Environment variables required:
 *   - ML_TRAINING_SERVICE_URL: URL of the Cloud Run training container
 *   - ML_TRAINING_API_KEY: Shared secret for authenticating with the training service
 */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const trainingServiceUrl = process.env.ML_TRAINING_SERVICE_URL || "https://bitblock-ml-trainer-409440684176.us-central1.run.app";
  const apiKey = process.env.ML_TRAINING_API_KEY;

  if (!trainingServiceUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "ML_TRAINING_SERVICE_URL is not configured.",
        hint: "Set ML_TRAINING_SERVICE_URL in Netlify environment variables to point to your Cloud Run training service.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { projectId, jobId, architecture, task, hyperparameters } = body;

    if (!projectId || !jobId || !architecture) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required fields: projectId, jobId, architecture",
        }),
      };
    }

    // Forward the training request to Cloud Run
    const upstream = await fetch(`${trainingServiceUrl.replace(/\/+$/, "")}/train`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify({
        projectId,
        jobId,
        architecture,
        task: task || "classification",
        hyperparameters: hyperparameters || {},
      }),
    });

    const responseText = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: { "Content-Type": "application/json" },
      body: responseText,
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: error?.message || "Failed to reach ML training service.",
        hint: "Ensure ML_TRAINING_SERVICE_URL points to a running Cloud Run container.",
      }),
    };
  }
};
