const admin = require("firebase-admin");

const PLAN_LIMITS = {
  free: { compilesPerDay: 3, compilesPerMonth: 20 },
  maker: { compilesPerDay: 60, compilesPerMonth: null },
  pro: { compilesPerDay: 120, compilesPerMonth: null },
  team: { compilesPerDay: 200, compilesPerMonth: null },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStr() {
  return new Date().toISOString().slice(0, 7);
}

function initAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
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
    initAdmin();
    const db = admin.firestore();
    const decoded = await verifyAuthToken(event);
    const userRef = db.doc(`users/${decoded.uid}`);
    const usageRef = db.doc(`users/${decoded.uid}/usage/current`);
    const [userSnap, usageSnap] = await Promise.all([userRef.get(), usageRef.get()]);
    const planId = String(userSnap.data()?.plan || "free").toLowerCase();
    const limitCfg = PLAN_LIMITS[planId] || PLAN_LIMITS.free;
    const nowDay = todayStr();
    const nowMonth = monthStr();
    const usage = usageSnap.exists ? usageSnap.data() : {};
    const compilesToday = usage?.lastCompileDate === nowDay ? Number(usage?.compilesToday || 0) : 0;
    const compilesThisMonth = usage?.lastCompileMonth === nowMonth ? Number(usage?.compilesThisMonth || 0) : 0;

    if (compilesToday >= limitCfg.compilesPerDay) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: `Daily compile limit reached (${limitCfg.compilesPerDay}/day on ${planId} plan).`,
        }),
      };
    }
    if (limitCfg.compilesPerMonth != null && compilesThisMonth >= limitCfg.compilesPerMonth) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: `Monthly compile limit reached (${limitCfg.compilesPerMonth}/month on ${planId} plan).`,
        }),
      };
    }

    await usageRef.set(
      {
        compilesToday: compilesToday + 1,
        compilesThisMonth: compilesThisMonth + 1,
        lastCompileDate: nowDay,
        lastCompileMonth: nowMonth,
        trainingJobsThisMonth: usage?.trainingJobsThisMonth || 0,
        lastTrainingMonth: usage?.lastTrainingMonth || "",
      },
      { merge: true }
    );

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
