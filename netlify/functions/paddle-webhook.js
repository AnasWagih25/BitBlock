const crypto = require("crypto");
const admin = require("firebase-admin");

const PRICE_TO_PLAN = {
  [process.env.PADDLE_PRICE_ID_MAKER || ""]: "maker",
  [process.env.PADDLE_PRICE_ID_PRO || ""]: "pro",
  [process.env.PADDLE_PRICE_ID_TEAM || ""]: "team",
};

function initAdmin() {
  if (!admin.apps.length) admin.initializeApp();
  return admin.firestore();
}

function timingSafeEq(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((x) => {
      const [k, v] = x.split("=");
      return [String(k || "").trim(), String(v || "").trim()];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  const signedPayload = `${ts}:${rawBody}`;
  const digest = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return timingSafeEq(digest, h1);
}

function extractPlanId(data) {
  const line = Array.isArray(data?.items) ? data.items[0] : null;
  const priceId = line?.price?.id || line?.price_id || "";
  return PRICE_TO_PLAN[priceId] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const rawBody = event.body || "";
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signatureHeader = event.headers?.["paddle-signature"] || event.headers?.["Paddle-Signature"] || "";

  if (!verifyPaddleSignature(rawBody, signatureHeader, secret)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid signature" }) };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  try {
    const db = initAdmin();
    const eventType = payload?.event_type;
    const data = payload?.data || {};
    const custom = data?.custom_data || {};
    const uid = custom?.uid;
    if (!uid) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

    const userRef = db.doc(`users/${uid}`);
    const basePatch = {
      billing: {
        paddleCustomerId: data?.customer_id || null,
        paddleSubscriptionId: data?.subscription_id || data?.id || null,
        lastWebhookEvent: eventType || null,
        lastWebhookAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    };

    if (eventType === "transaction.paid" || eventType === "subscription.created" || eventType === "subscription.updated") {
      const planId = extractPlanId(data) || custom?.requestedPlan || null;
      if (planId) {
        await userRef.set(
          {
            ...basePatch,
            plan: planId,
            planChangedAt: admin.firestore.FieldValue.serverTimestamp(),
            planStartedAt: admin.firestore.FieldValue.serverTimestamp(),
            billing: {
              ...basePatch.billing,
              status: "active",
              pendingPlan: admin.firestore.FieldValue.delete(),
            },
          },
          { merge: true }
        );
      } else {
        await userRef.set(basePatch, { merge: true });
      }
    } else if (eventType === "subscription.canceled" || eventType === "subscription.paused") {
      await userRef.set(
        {
          ...basePatch,
          billing: {
            ...basePatch.billing,
            status: "canceled",
          },
        },
        { merge: true }
      );
    } else {
      await userRef.set(basePatch, { merge: true });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err?.message || "Webhook handling failed" }) };
  }
};

