exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const trainingServiceUrl =
    process.env.ML_TRAINING_SERVICE_URL ||
    "https://bitblock-ml-trainer-409440684176.us-central1.run.app";
  const apiKey = process.env.ML_TRAINING_API_KEY;

  try {
    const contentType =
      event.headers?.["content-type"] ||
      event.headers?.["Content-Type"] ||
      "application/octet-stream";

    const bodyBuffer = Buffer.from(
      event.body || "",
      event.isBase64Encoded ? "base64" : "utf8"
    );

    const upstream = await fetch(`${trainingServiceUrl.replace(/\/+$/, "")}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
      // Native fetch requires Blob or Uint8Array, raw Buffer corrupts multipart
      body: new Blob([bodyBuffer], { type: contentType }),
    });

    const responseText = await upstream.text();
    const upstreamType = upstream.headers.get("content-type") || "application/json";

    return {
      statusCode: upstream.status,
      headers: {
        "Content-Type": upstreamType,
      },
      body: responseText,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error?.message || "Failed to reach prediction service.",
        hint: "Ensure ML_TRAINING_SERVICE_URL points to a running Cloud Run container.",
      }),
    };
  }
};

