import { useState } from "react";
import { Link } from "react-router-dom";
import { PLANS, PLAN_ORDER, type PlanId, formatStorageSize } from "../lib/plans";
import { useAuth } from "../contexts/AuthContext";
import { useAppDialog } from "../contexts/DialogContext";
import { useUsage } from "../hooks/useUsage";
import { auth } from "../lib/firebase";
import {
  ArrowLeft, Crown, Zap, Shield, CreditCard, ArrowUpRight,
  BarChart3, Cpu, HardDrive, Rocket, ExternalLink,
} from "lucide-react";

/* ── Usage Bar ────────────────────────────────────────────── */
function UsageBar({ label, used, max, color, text, icon }: {
  label: string; used: number | null; max: number | null; color: string; text?: string; icon?: React.ReactNode;
}) {
  const pct = used != null && max != null ? Math.min(100, (used / max) * 100) : 0;
  const warn = pct > 85;
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "16px 18px",
      border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "rgba(242,242,240,0.5)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          {icon}{label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: warn ? "#f87171" : "#F2F2F0" }}>
          {text || `${used ?? 0} / ${max ?? "∞"}`}
        </span>
      </div>
      {used != null && max != null && (
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
          <div style={{
            height: 6, borderRadius: 3, width: `${pct}%`,
            transition: "width 0.5s cubic-bezier(0.23,1,0.32,1)",
            background: warn ? "linear-gradient(90deg, #EF4444, #f87171)" : `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: warn ? "0 0 12px rgba(239,68,68,0.4)" : `0 0 10px ${color}40`,
          }} />
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function BillingPage() {
  const { user, userPlan, signOut, isAdmin } = useAuth();
  const { alert } = useAppDialog();
  const currentPlan = (userPlan || "free") as PlanId;
  const plan = PLANS[currentPlan];
  const { usage } = useUsage(user?.uid, userPlan);
  const [cancelling, setCancelling] = useState(false);

  const currentIdx = PLAN_ORDER.indexOf(currentPlan);

  const handleCancel = async () => {
    if (currentPlan === "free") return;
    setCancelling(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing auth token");
      const res = await fetch("/.netlify/functions/cancel-paddle-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not cancel subscription");
      await alert("Your subscription has been cancelled. You'll keep access until the end of your current billing period.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await alert(`Cancellation failed. ${msg}`);
    } finally { setCancelling(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="glass-dark" style={{
        position: "sticky", top: 0, zIndex: 100,
        padding: "0 40px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link to={user ? "/dashboard" : "/"} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>
              BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
            </span>
          </Link>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              ...(user ? [{ label: "Projects", to: "/dashboard" }] : []),
              { label: "Marketplace", to: "/marketplace" },
              { label: "Pricing", to: "/pricing" },
            ].map((item) => (
              <Link key={item.label} to={item.to} className="btn-ghost">{item.label}</Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="btn-ghost" style={{ color: "#F59E0B" }}>Admin</Link>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" className="btn-ghost">Profile</Link>
          <button onClick={() => signOut()} className="btn-ghost" style={{ fontSize: 12 }}>Sign Out</button>
        </div>
      </nav>

      {/* ── Header ─────────────────────────────────────── */}
      <section className="grid-bg" style={{ position: "relative", overflow: "hidden", padding: "48px 40px 40px" }}>
        <div style={{ position: "absolute", top: "-15%", left: "15%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <Link to="/profile" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "rgba(242,242,240,0.6)", textDecoration: "none", fontSize: 14,
            marginBottom: 24, padding: "8px 16px", borderRadius: 999,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(242,242,240,0.6)"; }}
          >
            <ArrowLeft size={16} /> Back to Profile
          </Link>
          <h1 style={{
            fontFamily: "Superstar, fantasy", fontSize: "clamp(28px, 4vw, 44px)",
            letterSpacing: "0.05em", color: "#F2F2F0", marginBottom: 8,
          }}>
            MANAGE <span className="gradient-text">BILLING</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(242,242,240,0.5)", margin: 0 }}>
            View your subscription, usage, and manage your plan.
          </p>
        </div>
      </section>

      {/* ── Content ────────────────────────────────────── */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 40px 80px" }}>

        {/* ── Current Plan Card ─────────────────────────── */}
        <div style={{
          borderRadius: 20, padding: "32px",
          border: `1.5px solid ${plan.color}50`,
          background: `linear-gradient(170deg, ${plan.color}12 0%, rgba(16,4,24,0.95) 60%)`,
          boxShadow: `0 20px 50px ${plan.color}18`,
          marginBottom: 24, position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", width: 200, height: 200, right: -60, top: -60, borderRadius: "50%",
            background: `radial-gradient(circle, ${plan.color}20, transparent 70%)`, pointerEvents: "none",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Crown size={20} color={plan.color} />
                <span style={{ fontSize: 12, color: "rgba(242,242,240,0.45)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Current Plan</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "#F2F2F0" }}>{plan.icon} {plan.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: plan.color, border: `1px solid ${plan.color}66`, background: `${plan.color}20`, borderRadius: 999, padding: "4px 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Active
                </span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#F2F2F0" }}>{plan.priceLabel}</div>
              {plan.price > 0 && (
                <div style={{ fontSize: 12, color: "rgba(242,242,240,0.4)", marginTop: 2 }}>billed monthly</div>
              )}
            </div>
          </div>

          {/* Plan features summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24, position: "relative", zIndex: 1 }}>
            {[
              { label: "Compiles/day", value: `${plan.compilesPerDay}`, icon: <Zap size={14} /> },
              { label: "Training jobs/mo", value: `${plan.trainingJobsPerMonth}`, icon: <Cpu size={14} /> },
              { label: "Max job time", value: plan.maxJobTimeSeconds >= 60 ? `${Math.floor(plan.maxJobTimeSeconds / 60)} min` : `${plan.maxJobTimeSeconds}s`, icon: <Rocket size={14} /> },
            ].map((s) => (
              <div key={s.label} style={{
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(242,242,240,0.45)", fontSize: 11, marginBottom: 4 }}>{s.icon}{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#F2F2F0" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, position: "relative", zIndex: 1 }}>
            <Link to="/pricing" className="btn-primary" style={{ flex: 1, justifyContent: "center", padding: "12px 24px", fontSize: 14 }}>
              {currentPlan === "free" ? "Upgrade Plan" : "Change Plan"} <ArrowUpRight size={14} />
            </Link>
            {currentPlan !== "free" && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="btn-ghost"
                style={{
                  padding: "12px 24px", fontSize: 13,
                  color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 999,
                  cursor: cancelling ? "not-allowed" : "pointer",
                }}
              >
                {cancelling ? "Cancelling..." : "Cancel Subscription"}
              </button>
            )}
          </div>
        </div>

        {/* ── Usage Overview ───────────────────────────── */}
        <div style={{
          borderRadius: 20, padding: "28px",
          border: "1px solid rgba(157,39,222,0.12)",
          background: "linear-gradient(170deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Shield size={18} color="#9D27DE" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Usage This Period</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <UsageBar label="Compiles Today" used={usage.compilesToday} max={plan.compilesPerDay} color="#3B82F6" icon={<Zap size={12} />} />
            <UsageBar label="Compiles This Month" used={usage.compilesThisMonth} max={plan.compilesPerMonth} color="#22C55E" icon={<BarChart3 size={12} />} />
            <UsageBar label="Training Jobs" used={usage.trainingJobsThisMonth} max={plan.trainingJobsPerMonth} color="#9D27DE" icon={<Cpu size={12} />} />
            <UsageBar label="Max Job Time" used={null} max={null} color="#F59E0B" text={plan.maxJobTimeSeconds >= 60 ? `${Math.floor(plan.maxJobTimeSeconds / 60)} min` : `${plan.maxJobTimeSeconds}s`} icon={<Rocket size={12} />} />
            <UsageBar label="Dataset Storage" used={null} max={null} color="#3B82F6" text={formatStorageSize(plan.datasetStorageBytes)} icon={<HardDrive size={12} />} />
            <UsageBar label="Model Storage" used={null} max={null} color="#F59E0B" text={formatStorageSize(plan.modelStorageBytes)} icon={<HardDrive size={12} />} />
          </div>
        </div>

        {/* ── Plan Tiers Strip ─────────────────────────── */}
        <div style={{
          borderRadius: 20, padding: "28px",
          border: "1px solid rgba(157,39,222,0.12)",
          background: "linear-gradient(170deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <CreditCard size={18} color="#9D27DE" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Available Plans</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {PLAN_ORDER.map((pid, i) => {
              const p = PLANS[pid];
              const active = pid === currentPlan;
              const isUpgrade = i > currentIdx;
              return (
                <div key={pid} style={{
                  borderRadius: 14, padding: "16px",
                  border: active ? `1.5px solid ${p.color}` : "1px solid rgba(255,255,255,0.08)",
                  background: active ? `${p.color}12` : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s ease",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontSize: 14, color: "#F2F2F0", fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(242,242,240,0.45)", marginTop: 2, marginBottom: 10 }}>{p.priceLabel}</div>
                  {active ? (
                    <span style={{ fontSize: 10, color: p.color, fontWeight: 700, textTransform: "uppercase" }}>Current</span>
                  ) : (
                    <Link to="/pricing" style={{ fontSize: 11, color: isUpgrade ? "#9D27DE" : "rgba(242,242,240,0.4)", textDecoration: "none", fontWeight: 600 }}>
                      {isUpgrade ? "Upgrade →" : "View →"}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Payment Info ─────────────────────────────── */}
        <div style={{
          borderRadius: 20, padding: "28px",
          border: "1px solid rgba(157,39,222,0.12)",
          background: "linear-gradient(170deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ExternalLink size={18} color="#9D27DE" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Payment & Invoices</h2>
          </div>
          <p style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", lineHeight: 1.7, marginBottom: 16 }}>
            Payments are processed securely through Paddle. You can manage payment methods, view invoices, and update billing details from the Paddle customer portal.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(242,242,240,0.3)" }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ fontSize: 12, color: "rgba(242,242,240,0.35)" }}>
              All transactions are encrypted and PCI-compliant via Paddle.
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{
        padding: "32px 40px",
        borderTop: "1px solid rgba(157,39,222,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
      }}>
        <span style={{ fontFamily: "Superstar, fantasy", fontSize: 16, color: "#9D27DE" }}>BITBLOCK</span>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Terms", to: "/terms" },
            { label: "Privacy", to: "/privacy" },
            { label: "Refund Policy", to: "/refund-policy" },
            { label: "GitHub", href: "https://github.com/AnasWagih25/BitBlock" },
          ].map((l) =>
            "to" in l && l.to ? (
              <Link key={l.label} to={l.to} style={{ color: "rgba(242,242,240,0.4)", fontSize: 13, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#9D27DE")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.4)")}>{l.label}</Link>
            ) : (
              <a key={l.label} href={(l as any).href} style={{ color: "rgba(242,242,240,0.4)", fontSize: 13, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#9D27DE")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.4)")}>{l.label}</a>
            )
          )}
        </div>
        <span style={{ fontSize: 12, color: "rgba(242,242,240,0.25)" }}>© 2026 BitBlock. All rights reserved.</span>
      </footer>
    </div>
  );
}
