exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const compilerServiceUrl = process.env.COMPILER_SERVICE_URL || "https://bitblock-compiler-409440684176.us-central1.run.app";
  if (!compilerServiceUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "COMPILER_SERVICE_URL is not configured on Netlify.",
      }),
    };
  }

  try {
    const upstream = await fetch(`${compilerServiceUrl.replace(/\/+$/, "")}/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: event.body || "{}",
    });

    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: { "content-type": "application/json" },
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({
        error: error?.message || "Failed to reach compiler service.",
      }),
    };
  }
};
