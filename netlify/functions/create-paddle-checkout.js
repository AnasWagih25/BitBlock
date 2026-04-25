const admin = require("firebase-admin");

const PLAN_TO_ENV = {
  maker: "PADDLE_PRICE_ID_MAKER",
  pro: "PADDLE_PRICE_ID_PRO",
  team: "PADDLE_PRICE_ID_TEAM",
};

function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
}

async function verifyAuthToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Missing bearer token");
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    initAdmin();
    const decoded = await verifyAuthToken(event);
    const body = JSON.parse(event.body || "{}");
    const planId = String(body.planId || "").toLowerCase();
    if (!PLAN_TO_ENV[planId]) {
      return { statusCode: 400, body: JSON.stringify({ error: "Unsupported plan for checkout" }) };
    }

    const priceId = process.env[PLAN_TO_ENV[planId]];
    const apiKey = process.env.PADDLE_API_KEY;
    const baseUrl = process.env.PADDLE_API_BASE_URL || "https://api.paddle.com";
    const appUrl = process.env.APP_URL || "http://localhost:5173";
    if (!apiKey || !priceId) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Paddle is not configured. Missing API key or plan price id.",
        }),
      };
    }

    const db = admin.firestore();
    const userSnap = await db.doc(`users/${decoded.uid}`).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const email = userData?.email || decoded.email || "";

    // Paddle Billing API transaction checkout flow.
    const payload = {
      items: [{ price_id: priceId, quantity: 1 }],
      customer: email ? { email } : undefined,
      custom_data: {
        uid: decoded.uid,
        requestedPlan: planId,
      },
      checkout: {
        success_url: `${appUrl}/billing?checkout=success`,
        cancel_url: `${appUrl}/billing?checkout=cancel`,
      },
    };

    const txResp = await fetch(`${baseUrl.replace(/\/+$/, "")}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const txData = await txResp.json().catch(() => ({}));
    if (!txResp.ok) {
      return {
        statusCode: txResp.status,
        body: JSON.stringify({ error: txData?.error?.detail || txData?.error || "Failed to create transaction" }),
      };
    }

    const checkoutUrl = txData?.data?.checkout?.url;
    if (!checkoutUrl) {
      return { statusCode: 500, body: JSON.stringify({ error: "Paddle response missing checkout URL" }) };
    }

    await db.doc(`users/${decoded.uid}`).set(
      {
        billing: {
          pendingPlan: planId,
          pendingCheckoutAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ checkoutUrl }),
    };
  } catch (err) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: err?.message || "Unauthorized" }),
    };
  }
};

