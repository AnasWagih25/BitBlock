import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle2 } from "lucide-react";

export default function PricingPage() {
  const { user } = useAuth();

  return (
    <div data-page="pricing" style={{ background: "#0A0A0A", minHeight: "100vh", fontFamily: "Space Grotesk, sans-serif" }}>
      {/* Nav */}
      <nav className="glass-dark" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE", letterSpacing: "0.08em" }}>
              BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
            </span>
          </Link>
        </div>
        <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <Link to="/dashboard" className="btn-primary" style={{ padding: "8px 20px" }}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost" style={{ padding: "8px 20px" }}>Log In</Link>
              <Link to="/signup" className="btn-primary" style={{ padding: "8px 20px" }}>Get Started Free</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        padding: "160px 40px 80px",
        position: "relative",
        overflow: "hidden",
        textAlign: "center"
      }}>
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
          <div className="badge badge-purple" style={{ marginBottom: 24, padding: "8px 16px", fontSize: 13 }}>
            100% Free & Open Source
          </div>
          <h1 style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(32px, 5vw, 56px)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginBottom: 24,
            color: "#F2F2F0",
          }}>
            No Paywalls. <br />
            <span className="gradient-text">Just Building.</span>
          </h1>
          <p style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            lineHeight: 1.6,
            color: "rgba(242,242,240,0.65)",
            marginBottom: 40, maxWidth: 650, margin: "0 auto 40px",
          }}>
            BitBlock is a fully open-source project. Everyone gets generous default limits for cloud compilation and ML training, absolutely free.
          </p>
        </div>
      </section>

      {/* Limits Info */}
      <section style={{ padding: "40px 40px 100px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{
            background: "linear-gradient(180deg, rgba(157,39,222,0.05) 0%, rgba(10,10,10,0.5) 100%)",
            border: "1px solid rgba(157,39,222,0.2)",
            borderRadius: 24,
            padding: 40,
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
               <h3 style={{ fontSize: 24, fontWeight: 700, color: "#F2F2F0" }}>Default Quotas</h3>
               <p style={{ color: "rgba(242,242,240,0.5)", marginTop: 8 }}>Included for every user</p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
              {[
                "6 Cloud Compiles / Day",
                "40 Cloud Compiles / Month",
                "4 Cloud ML Training Jobs / Month",
                "2 Minutes Max Job Time",
                "30MB Dataset Storage",
                "30MB Model Storage",
                "1 Deployed Model",
                "Unlimited Projects",
                "Marketplace Access"
              ].map((feature, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CheckCircle2 size={20} color="#9D27DE" />
                  <span style={{ color: "#F2F2F0", fontSize: 15, fontWeight: 500 }}>{feature}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 40,
              padding: 20,
              background: "rgba(245,158,11,0.05)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 12,
              textAlign: "center"
            }}>
              <h4 style={{ color: "#FDE68A", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Need more resources?</h4>
              <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 14, lineHeight: 1.5 }}>
                Since BitBlock is open-source, there are no paid plans. If you are working on an extensive project or educational program and need your limits increased, an administrator can manually adjust your quotas from the admin dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "40px",
        borderTop: "1px solid rgba(157,39,222,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 24,
      }}>
        <div>
           <span style={{ fontFamily: "Superstar, fantasy", fontSize: 20, color: "#9D27DE" }}>BITBLOCK</span>
           <div style={{ fontSize: 13, color: "rgba(242,242,240,0.4)", marginTop: 8 }}>The visual programming language for hardware.</div>
        </div>
        <div className="footer-links" style={{ display: "flex", gap: 32 }}>
          {[
            { label: "Marketplace", to: "/marketplace" },
            { label: "Privacy Policy", to: "/privacy" },
            { label: "Terms", to: "/terms" },
            { label: "GitHub", href: "https://github.com/AnasWagih25/BitBlock" }
          ].map((l) => (
            l.to ? (
              <Link key={l.label} to={l.to} style={{ color: "rgba(242,242,240,0.6)", fontSize: 14, textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.6)")}>
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} style={{ color: "rgba(242,242,240,0.6)", fontSize: 14, textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.6)")}>
                {l.label}
              </a>
            )
          ))}
        </div>
      </footer>
    </div>
  );
}
