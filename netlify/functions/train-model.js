const admin = require("firebase-admin");

const PLAN_LIMITS = {
  free: { trainingJobsPerMonth: 2 },
  maker: { trainingJobsPerMonth: 12 },
  pro: { trainingJobsPerMonth: 30 },
  team: { trainingJobsPerMonth: 40 },
};

function monthStr() {
  return new Date().toISOString().slice(0, 7);
}

function initAdmin() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

async function verifyAuthToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Missing bearer token");
  return admin.auth().verifyIdToken(token);
}

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
    initAdmin();
    const db = admin.firestore();
    const decoded = await verifyAuthToken(event);
    const body = JSON.parse(event.body || "{}");
    const { projectId, jobId, architecture, task, hyperparameters, datasetIds, sampleIds } = body;

    if (!projectId || !jobId || !architecture) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required fields: projectId, jobId, architecture",
        }),
      };
    }

    const projectRef = db.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists || projectSnap.data()?.ownerId !== decoded.uid) {
      return { statusCode: 403, body: JSON.stringify({ error: "Not allowed to train this project" }) };
    }

    const userRef = db.doc(`users/${decoded.uid}`);
    const usageRef = db.doc(`users/${decoded.uid}/usage/current`);
    const [userSnap, usageSnap] = await Promise.all([userRef.get(), usageRef.get()]);
    const userPlan = String(userSnap.data()?.plan || "free").toLowerCase();
    const limitCfg = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
    const nowMonth = monthStr();
    const usage = usageSnap.exists ? usageSnap.data() : {};
    const trainingJobsThisMonth =
      usage?.lastTrainingMonth === nowMonth ? Number(usage?.trainingJobsThisMonth || 0) : 0;

    if (trainingJobsThisMonth >= limitCfg.trainingJobsPerMonth) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: `Monthly training limit reached (${limitCfg.trainingJobsPerMonth}/month on ${userPlan} plan).`,
        }),
      };
    }

    await usageRef.set(
      {
        compilesToday: usage?.compilesToday || 0,
        compilesThisMonth: usage?.compilesThisMonth || 0,
        lastCompileDate: usage?.lastCompileDate || "",
        lastCompileMonth: usage?.lastCompileMonth || "",
        trainingJobsThisMonth: trainingJobsThisMonth + 1,
        lastTrainingMonth: nowMonth,
      },
      { merge: true }
    );

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
        datasetIds: Array.isArray(datasetIds) ? datasetIds : [],
        sampleIds: Array.isArray(sampleIds) ? sampleIds : [],
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
