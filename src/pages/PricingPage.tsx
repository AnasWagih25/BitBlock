import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PLAN_ORDER, PLANS, formatJobTime, formatStorageSize, type PlanId } from "../lib/plans";
import { useAuth } from "../contexts/AuthContext";
import { useAppDialog } from "../contexts/DialogContext";
import { auth } from "../lib/firebase";
import { Check, ChevronDown, Zap, Shield, Cpu, BarChart3, HardDrive, Rocket } from "lucide-react";

/* ── FAQ Data ─────────────────────────────────────────────── */
const faqs = [
  { q: "Can I switch plans at any time?", a: "Yes — upgrade or downgrade from your Billing page instantly. When upgrading, you'll be prorated for the remainder of your billing cycle." },
  { q: "What happens when I hit a limit?", a: "You'll see a friendly notification. Compiles and training jobs pause until the next day/month resets, or you can upgrade for immediate access." },
  { q: "Is there a free trial for paid plans?", a: "Every account starts on the Free plan with no time limit. You can explore the IDE, compile code, and train small models before committing." },
  { q: "How does Team billing work?", a: "Team is priced per seat. Each member gets their own limits, but storage is shared across the team workspace." },
  { q: "Can I cancel anytime?", a: "Absolutely. Cancel from your Billing page — you'll keep your paid features until the end of the current billing period." },
];

/* ── Comparison Categories ────────────────────────────────── */
const comparisonRows: { label: string; icon: React.ReactNode; key: string; format: (plan: typeof PLANS.free) => string }[] = [
  { label: "Compiles / day", icon: <Zap size={15} />, key: "compilesPerDay", format: (p) => `${p.compilesPerDay}` },
  { label: "Compiles / month", icon: <BarChart3 size={15} />, key: "compilesPerMonth", format: (p) => p.compilesPerMonth === null ? "Unlimited" : `${p.compilesPerMonth}` },
  { label: "Training jobs / month", icon: <Cpu size={15} />, key: "trainingJobsPerMonth", format: (p) => `${p.trainingJobsPerMonth}` },
  { label: "Max job duration", icon: <Rocket size={15} />, key: "maxJobTimeSeconds", format: (p) => formatJobTime(p.maxJobTimeSeconds) },
  { label: "Dataset storage", icon: <HardDrive size={15} />, key: "datasetStorageBytes", format: (p) => formatStorageSize(p.datasetStorageBytes) },
  { label: "Model storage", icon: <HardDrive size={15} />, key: "modelStorageBytes", format: (p) => formatStorageSize(p.modelStorageBytes) },
  { label: "Deployed models", icon: <Shield size={15} />, key: "deployedModels", format: (p) => p.deployedModels === 0 ? "—" : `${p.deployedModels}` },
];

/* ── FAQ Accordion Item ───────────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(157,39,222,0.12)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setOpen(!open)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 0" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#F2F2F0" }}>{q}</span>
        <ChevronDown
          size={18}
          style={{
            color: "rgba(242,242,240,0.4)",
            transition: "transform 0.3s ease",
            transform: open ? "rotate(180deg)" : "rotate(0)",
            flexShrink: 0,
            marginLeft: 16,
          }}
        />
      </div>
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? 200 : 0,
          transition: "max-height 0.35s ease, opacity 0.3s ease",
          opacity: open ? 1 : 0,
        }}
      >
        <p style={{ fontSize: 14, color: "rgba(242,242,240,0.55)", lineHeight: 1.7, paddingBottom: 20 }}>{a}</p>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */
export default function PricingPage() {
  const { user, userPlan, signOut, isAdmin } = useAuth();
  const { alert } = useAppDialog();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [updating, setUpdating] = useState<PlanId | null>(null);
  const currentPlan = (userPlan || "free") as PlanId;

  /* Intersection observer for card entrance animations */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-idx"));
            setVisibleCards((prev) => new Set(prev).add(idx));
          }
        });
      },
      { threshold: 0.15 }
    );
    cardsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const startCheckout = async (nextPlan: PlanId) => {
    if (!user) return;
    if (nextPlan === currentPlan) return;
    setUpdating(nextPlan);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing auth token");
      const res = await fetch("/.netlify/functions/create-paddle-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: nextPlan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.checkoutUrl) throw new Error(data?.error || "Could not create Paddle checkout");
      window.location.href = data.checkoutUrl as string;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await alert(`Could not start checkout. ${msg}`);
    } finally { setUpdating(null); }
  };

  const choosePlan = (planId: PlanId) => {
    if (user) { startCheckout(planId); return; }
    localStorage.setItem("signup_plan", planId);
    navigate("/signup");
  };

  const displayPrice = (plan: typeof PLANS.free) => {
    if (plan.price === 0) return "Free";
    const p = annual ? Math.round(plan.price * 10) / 12 : plan.price;
    return `$${p % 1 === 0 ? p : p.toFixed(2)}`;
  };

  const renderPlanCard = (id: PlanId, idx: number, extraStyle: React.CSSProperties = {}) => {
    const plan = PLANS[id];
    const popular = id === "pro";
    const visible = visibleCards.has(idx);
    const isCurrent = user ? id === currentPlan : false;

    return (
      <div
        key={id}
        ref={(el) => { cardsRef.current[idx] = el; }}
        data-idx={idx}
        style={{
          borderRadius: 24,
          border: isCurrent ? `2px solid ${plan.color}` : popular ? "1.5px solid rgba(157,39,222,0.6)" : "1px solid rgba(255,255,255,0.08)",
          background: isCurrent
            ? `linear-gradient(170deg, ${plan.color}20 0%, rgba(16,4,24,0.95) 50%)`
            : popular
            ? "linear-gradient(170deg, rgba(157,39,222,0.2) 0%, rgba(16,4,24,0.95) 50%)"
            : "linear-gradient(170deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          boxShadow: isCurrent ? `0 24px 60px ${plan.color}30` : popular ? "0 24px 60px rgba(157,39,222,0.25), 0 0 0 1px rgba(157,39,222,0.1) inset" : "0 12px 40px rgba(0,0,0,0.3)",
          padding: "32px 24px 28px",
          position: "relative",
          overflow: "hidden",
          backdropFilter: "blur(12px)",
          transform: visible ? (popular ? "translateY(-12px) scale(1)" : "translateY(0) scale(1)") : "translateY(30px) scale(0.97)",
          opacity: visible ? 1 : 0,
          transition: `all 0.6s cubic-bezier(0.23, 1, 0.32, 1) ${idx * 0.1}s`,
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
          ...extraStyle
        }}
      >
        {/* Decorative glow orb */}
        <div style={{
          position: "absolute", width: 200, height: 200, right: -80, top: -80, borderRadius: "50%",
          background: popular
            ? "radial-gradient(circle, rgba(157,39,222,0.3), transparent 70%)"
            : `radial-gradient(circle, ${plan.color}18, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Popular badge */}
        {popular && !isCurrent && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: "linear-gradient(90deg, #9D27DE, #B94FF0, #9D27DE)",
            borderRadius: "24px 24px 0 0",
          }} />
        )}
        {popular && !isCurrent && (
          <span style={{
            position: "absolute", top: 16, right: 16,
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
            background: "linear-gradient(135deg, rgba(157,39,222,0.3), rgba(185,79,240,0.2))",
            border: "1px solid rgba(157,39,222,0.5)", color: "#E9D5FF",
            borderRadius: 999, padding: "5px 12px",
          }}>
            ⭐ Most Popular
          </span>
        )}

        {/* Plan icon & name */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{plan.icon}</div>
            <h2 style={{ margin: 0, color: "#F2F2F0", fontSize: 22, fontWeight: 700 }}>{plan.name}</h2>
          </div>
          {isCurrent && (
            <span style={{ fontSize: 11, fontWeight: 700, color: plan.color, border: `1px solid ${plan.color}66`, background: `${plan.color}20`, borderRadius: 999, padding: "4px 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Current
            </span>
          )}
        </div>

        {/* Price */}
        <div style={{ marginTop: 0, marginBottom: 20 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: "#F2F2F0", letterSpacing: "-0.03em" }}>
            {displayPrice(plan)}
          </span>
          {plan.price > 0 && (
            <span style={{ fontSize: 14, color: "rgba(242,242,240,0.4)", marginLeft: 4 }}>
              /{id === "team" ? "seat/mo" : "mo"}
            </span>
          )}
          {annual && plan.price > 0 && (
            <div style={{ fontSize: 12, color: "#4ade80", marginTop: 4 }}>
              Save ${Math.round(plan.price * 12 - plan.price * 10)}/yr
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(157,39,222,0.2), transparent)", marginBottom: 20 }} />

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {plan.features.map((feature) => (
            <div key={feature} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "rgba(242,242,240,0.78)" }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${plan.color}18`, border: `1px solid ${plan.color}30`,
              }}>
                <Check size={11} color={plan.color} strokeWidth={3} />
              </div>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => choosePlan(id)}
          disabled={isCurrent || updating !== null}
          className={isCurrent ? "btn-ghost" : id === "free" && !user ? "btn-secondary" : "btn-primary"}
          style={{
            width: "100%", justifyContent: "center", marginTop: 24,
            padding: "14px 24px", fontSize: 14,
            opacity: isCurrent ? 0.75 : 1,
            cursor: isCurrent || updating !== null ? "not-allowed" : "pointer",
            ...(popular && !isCurrent ? { boxShadow: "0 8px 30px rgba(157,39,222,0.35)" } : {}),
          }}
        >
          {isCurrent ? "Current Plan" : updating === id ? "Redirecting..." : user ? `Subscribe to ${plan.name}` : id === "free" ? "Start Free" : `Choose ${plan.name}`}
        </button>
      </div>
    );
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
              ...(user ? [{ label: "Projects", to: "/dashboard" }, { label: "Marketplace", to: "/marketplace" }] : []),
              { label: "Pricing", to: "/pricing" },
            ].map((item) => (
              <Link key={item.label} to={item.to} className="btn-ghost" style={{
                color: item.to === "/pricing" ? "#9D27DE" : undefined,
                background: item.to === "/pricing" ? "rgba(157,39,222,0.1)" : undefined,
              }}>
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="btn-ghost" style={{ color: "#F59E0B" }}>Admin</Link>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <>
              <Link to="/profile" className="btn-ghost">Profile</Link>
              <button onClick={() => signOut()} className="btn-ghost" style={{ fontSize: 12 }}>Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">Log In</Link>
              <Link to="/signup" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13 }}>Get Started Free</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────── */}
      <section className="grid-bg" style={{
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
        padding: "100px 40px 60px",
      }}>
        {/* Orbs */}
        <div style={{ position: "absolute", top: "-10%", left: "20%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(157,39,222,0.18) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "0%", right: "10%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(185,79,240,0.1) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto" }}>
          <div className="badge badge-purple" style={{ marginBottom: 20 }}>💎 Simple, Transparent Pricing</div>
          <h1 style={{
            fontFamily: "Superstar, fantasy",
            fontSize: "clamp(32px, 5vw, 56px)",
            lineHeight: 1.1,
            letterSpacing: "0.05em",
            color: "#F2F2F0",
            marginBottom: 20,
          }}>
            SCALE YOUR<br />
            <span className="gradient-text">CREATIONS</span>
          </h1>
          <p style={{ fontSize: 17, color: "rgba(242,242,240,0.55)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 36px" }}>
            Start free, upgrade when you need more power. Every plan includes the full BitBlock IDE, cloud compilation, and WebSerial flashing.
          </p>

          {/* ── Billing Toggle ─────────────────────────── */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(26,6,40,0.6)", border: "1px solid rgba(157,39,222,0.2)", borderRadius: 999, padding: "6px 8px" }}>
            <span style={{ fontSize: 13, fontWeight: annual ? 400 : 700, color: annual ? "rgba(242,242,240,0.45)" : "#F2F2F0", padding: "6px 14px", borderRadius: 999, background: !annual ? "rgba(157,39,222,0.2)" : "transparent", cursor: "pointer", transition: "all 0.25s ease" }} onClick={() => setAnnual(false)}>Monthly</span>
            <span style={{ fontSize: 13, fontWeight: annual ? 700 : 400, color: !annual ? "rgba(242,242,240,0.45)" : "#F2F2F0", padding: "6px 14px", borderRadius: 999, background: annual ? "rgba(157,39,222,0.2)" : "transparent", cursor: "pointer", transition: "all 0.25s ease", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setAnnual(true)}>
              Annual
              <span style={{ fontSize: 10, background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 999, padding: "2px 7px", fontWeight: 700 }}>-17%</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── Plan Cards ──────────────────────────────────── */}
      <section style={{ padding: "0 40px 80px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "stretch", marginBottom: 60 }}>
          {PLAN_ORDER.filter(id => id !== "team").map((id, idx) => renderPlanCard(id, idx))}
        </div>

        {/* Teams Section */}
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#F2F2F0", margin: "0 0 12px" }}>For Teams & Organizations</h2>
          <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 16, margin: "0 0 32px" }}>
            Scale your development with shared storage, expanded compile limits, and more powerful AI instances.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            {renderPlanCard("team", 3, { width: "100%", maxWidth: 450 })}
          </div>
        </div>
      </section>

      {/* ── Feature Comparison Table ────────────────────── */}
      <section style={{ padding: "60px 40px 80px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "Superstar, fantasy", fontSize: "clamp(24px, 3vw, 36px)", letterSpacing: "0.05em", color: "#F2F2F0", textAlign: "center", marginBottom: 8 }}>
            COMPARE <span className="gradient-text">PLANS</span>
          </h2>
          <p style={{ textAlign: "center", color: "rgba(242,242,240,0.45)", fontSize: 15, marginBottom: 48 }}>
            See exactly what each tier includes
          </p>

          <div style={{ borderRadius: 20, border: "1px solid rgba(157,39,222,0.15)", overflow: "hidden", background: "rgba(26,6,40,0.3)" }}>
            {/* Header row */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr repeat(4, 1fr)", borderBottom: "1px solid rgba(157,39,222,0.15)", background: "rgba(26,6,40,0.5)" }}>
              <div style={{ padding: "16px 24px", fontSize: 13, fontWeight: 600, color: "rgba(242,242,240,0.4)" }}>Feature</div>
              {PLAN_ORDER.map((id) => (
                <div key={id} style={{ padding: "16px 12px", textAlign: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: PLANS[id].color }}>{PLANS[id].icon} {PLANS[id].name}</span>
                </div>
              ))}
            </div>
            {/* Data rows */}
            {comparisonRows.map((row, ri) => (
              <div key={row.key} style={{
                display: "grid", gridTemplateColumns: "1.6fr repeat(4, 1fr)",
                borderBottom: ri < comparisonRows.length - 1 ? "1px solid rgba(157,39,222,0.08)" : "none",
                transition: "background 0.15s ease",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(157,39,222,0.06)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ padding: "14px 24px", fontSize: 13, color: "rgba(242,242,240,0.7)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "rgba(157,39,222,0.6)" }}>{row.icon}</span>
                  {row.label}
                </div>
                {PLAN_ORDER.map((id) => (
                  <div key={id} style={{ padding: "14px 12px", textAlign: "center", fontSize: 13, fontWeight: 600, color: id === "pro" ? "#E9D5FF" : "rgba(242,242,240,0.6)" }}>
                    {row.format(PLANS[id])}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ─────────────────────────────────── */}
      <section style={{ padding: "40px 40px 80px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "Superstar, fantasy", fontSize: "clamp(22px, 3vw, 32px)", letterSpacing: "0.05em", color: "#F2F2F0", textAlign: "center", marginBottom: 8 }}>
            FREQUENTLY <span className="gradient-text">ASKED</span>
          </h2>
          <p style={{ textAlign: "center", color: "rgba(242,242,240,0.45)", fontSize: 15, marginBottom: 40 }}>
            Everything you need to know about our plans
          </p>
          <div style={{ borderTop: "1px solid rgba(157,39,222,0.12)" }}>
            {faqs.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────── */}
      <section style={{ padding: "0 40px 100px" }}>
        <div style={{
          maxWidth: 800, margin: "0 auto",
          background: "linear-gradient(135deg, rgba(157,39,222,0.15), rgba(42,10,61,0.8))",
          border: "1px solid rgba(157,39,222,0.3)",
          borderRadius: 24, padding: "60px 40px",
          textAlign: "center", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(157,39,222,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontFamily: "Superstar, fantasy", fontSize: "clamp(22px, 3vw, 36px)", letterSpacing: "0.06em", color: "#F2F2F0", marginBottom: 16 }}>
              READY TO <span className="gradient-text">LEVEL UP</span>?
            </h2>
            <p style={{ color: "rgba(242,242,240,0.55)", fontSize: 16, marginBottom: 32, maxWidth: 460, margin: "0 auto 32px" }}>
              Join makers, students, and engineers building the future with BitBlock.
            </p>
            <Link to={user ? "/billing" : "/signup"} className="btn-primary" style={{ fontSize: 16, padding: "16px 40px" }}>
              {user ? "Upgrade Your Plan →" : "Create Free Account →"}
            </Link>
          </div>
        </div>
      </section>

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
