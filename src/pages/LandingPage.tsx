import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import CassetteMascot from "../components/ui/CassetteMascot";
import { Zap, Puzzle, CloudLightning, Usb, Cpu, Globe } from "lucide-react";
import DemoModal from "../components/ui/DemoModal";
import MobileMenuButton from "../components/ui/MobileMenuButton";

const features = [
  {
    icon: <Zap size={32} color="#B94FF0" />,
    title: "Zero Installation",
    desc: "Everything runs in your browser. No software, no drivers, no IDE setup — ever.",
  },
  {
    icon: <Puzzle size={32} color="#B94FF0" />,
    title: "Visual Block Editor",
    desc: "Drag and connect blocks to build real firmware. No code required.",
  },
  {
    icon: <CloudLightning size={32} color="#B94FF0" />,
    title: "Cloud Compilation",
    desc: "We compile your firmware in the cloud on powerful build servers — instantly.",
  },
  {
    icon: <Usb size={32} color="#B94FF0" />,
    title: "Direct USB Flashing",
    desc: "Flash your microcontroller directly from the browser via WebSerial API.",
  },
  {
    icon: <Cpu size={32} color="#B94FF0" />,
    title: "Edge AI / ML Blocks",
    desc: "Run machine learning models on your microcontroller with drag-and-drop blocks.",
  },
  {
    icon: <Globe size={32} color="#B94FF0" />,
    title: "Community Marketplace",
    desc: "Discover, share, and install custom block extensions from the community.",
  },
];

const boards = [
  { name: "ESP32", color: "#E53E3E", sub: "WROOM / S3 / C3 / CAM" },
  { name: "ESP8266", color: "#3182CE", sub: "NodeMCU" },
  { name: "Arduino", color: "#38A169", sub: "UNO / NANO / MEGA" },
];

const stats = [
  { value: "6+", label: "Supported Boards" },
  { value: "100+", label: "Block Categories" },
  { value: "0", label: "Dependencies" },
  { value: "∞", label: "Possibilities" },
];

export default function LandingPage() {
  const { isBetaMode } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2.5;
      el.style.transform = `perspective(1200px) rotateX(${-y}deg) rotateY(${x}deg)`;
    };
    const reset = () => { el.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg)"; };
    window.addEventListener("mousemove", handle);
    window.addEventListener("mouseleave", reset);
    return () => { window.removeEventListener("mousemove", handle); window.removeEventListener("mouseleave", reset); };
  }, []);

  return (
    <div data-page="landing" style={{ background: "#0A0A0A", minHeight: "100vh", fontFamily: "Space Grotesk, sans-serif" }}>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="glass-dark" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE", letterSpacing: "0.08em" }}>
            BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
          </span>
          <span className="badge badge-purple" style={{ marginLeft: 4 }}>BETA</span>
          <MobileMenuButton targetId="landing-nav-links" />
        </div>
        <div id="landing-nav-links" className="nav-links" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isBetaMode && <Link to="/pricing" className="btn-ghost">Pricing</Link>}
          <Link to="/login" className="btn-ghost">Log In</Link>
          <Link to="/signup" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13 }}>
            {isBetaMode ? "Join the Beta" : "Get Started Free"}
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="grid-bg hero-section" style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 40px 80px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background orbs */}
        <div style={{
          position: "absolute", top: "20%", left: "10%",
          width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", right: "5%",
          width: 300, height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(185,79,240,0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />

        <div className="hero-grid" style={{
          maxWidth: 1100, width: "100%",
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 80, alignItems: "center",
        }}>
          {/* Left: Text */}
          <div className="animate-slide-up hero-text">
            <div className="badge badge-purple" style={{ marginBottom: 24 }}>
              🎛 Visual Firmware Builder
            </div>
            <h1 style={{
              fontFamily: "Superstar, fantasy",
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.1,
              letterSpacing: "0.05em",
              marginBottom: 24,
              color: "#F2F2F0",
            }}>
              BUILD FIRMWARE
              <br />
              <span className="gradient-text">WITHOUT CODE</span>
            </h1>
            <p style={{
              fontSize: 18, lineHeight: 1.7,
              color: "rgba(242,242,240,0.65)",
              marginBottom: 40, maxWidth: 480,
            }}>
              Drag blocks, connect logic, compile in the cloud — then flash your microcontroller
              directly from the browser. Zero installation. Zero IDE. Pure creation.
            </p>
            <div className="hero-cta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link to="/signup" className="btn-primary" style={{ fontSize: 15, padding: "14px 32px" }}>
                {isBetaMode ? "Join the Beta →" : "Start Building Free →"}
              </Link>
              <button 
                onClick={() => setShowDemo(true)}
                className="btn-secondary" style={{ fontSize: 15, padding: "14px 32px", cursor: "pointer" }}
              >
                View Demo
              </button>
            </div>
            <p style={{ marginTop: 20, fontSize: 13, color: "rgba(242,242,240,0.35)" }}>
              ⚡ Chrome / Edge only (WebSerial API) · No account needed to explore
            </p>

            {/* Board badges */}
            <div className="hero-boards" style={{ display: "flex", gap: 10, marginTop: 32, flexWrap: "wrap" }}>
              {boards.map((b) => (
                <div key={b.name} style={{
                  background: "rgba(26,6,40,0.8)",
                  border: `1px solid ${b.color}40`,
                  borderRadius: 8, padding: "6px 12px",
                  display: "flex", flexDirection: "column",
                }}>
                  <span style={{ color: b.color, fontSize: 12, fontWeight: 700 }}>{b.name}</span>
                  <span style={{ color: "rgba(242,242,240,0.4)", fontSize: 10 }}>{b.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Mascot + minicard */}
          <div ref={heroRef} className="hero-mascot-area" style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            transition: "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)",
          }}>
            <CassetteMascot size={280} mood="excited" animate />

            {/* Mock IDE mini-preview */}
            <div className="glass" style={{
              marginTop: -20, borderRadius: 16, padding: "16px 20px",
              maxWidth: 320, width: "100%",
            }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(242,242,240,0.4)" }}>BitBlock IDE</span>
              </div>
              {["🟣 On Start", "  🔵 Set LED Pin 2", "  🟠 Wait 1000ms", "  🔵 Toggle LED"].map((line, i) => (
                <div key={i} style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11, color: "rgba(224,216,240,0.8)",
                  padding: "3px 0",
                  paddingLeft: line.startsWith("  ") ? 16 : 0,
                  borderLeft: line.startsWith("  ") ? "2px solid rgba(157,39,222,0.4)" : "none",
                  marginLeft: line.startsWith("  ") ? 8 : 0,
                }}>
                  {line.trim()}
                </div>
              ))}
              <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(34,197,94,0.1)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.3)" }}>
                <span style={{ fontSize: 11, color: "#4ade80" }}>✓ Compiled successfully · 12.4KB</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────── */}
      <section className="stats-section" style={{ padding: "60px 40px", borderTop: "1px solid rgba(157,39,222,0.1)" }}>
        <div className="stats-grid" style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Superstar, fantasy", fontSize: 42, color: "#9D27DE", letterSpacing: "0.05em" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="features-section" style={{ padding: "80px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{
              fontFamily: "Superstar, fantasy",
              fontSize: "clamp(28px, 4vw, 48px)",
              letterSpacing: "0.06em", color: "#F2F2F0",
              marginBottom: 16,
            }}>
              EVERYTHING IN <span className="gradient-text">THE BROWSER</span>
            </h2>
            <p style={{ color: "rgba(242,242,240,0.5)", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
              No installs. No setup. Just open BitBlock and start building.
            </p>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{ cursor: "default" }}>
                <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(242,242,240,0.55)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────── */}
      <section className="cta-section" style={{ padding: "80px 40px" }}>
        <div className="cta-card" style={{
          maxWidth: 800, margin: "0 auto",
          background: "linear-gradient(135deg, rgba(157,39,222,0.15), rgba(42,10,61,0.8))",
          border: "1px solid rgba(157,39,222,0.3)",
          borderRadius: 24, padding: "60px 40px",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(157,39,222,0.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <CassetteMascot size={100} mood="happy" animate />
            <h2 style={{
              fontFamily: "Superstar, fantasy",
              fontSize: "clamp(24px, 3.5vw, 40px)",
              letterSpacing: "0.06em", color: "#F2F2F0",
              marginTop: 24, marginBottom: 16,
            }}>
              READY TO BUILD?
            </h2>
            <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 16, marginBottom: 32 }}>
              Join thousands of makers, students, and engineers building with BitBlock.
            </p>
            <Link to="/signup" className="btn-primary" style={{ fontSize: 16, padding: "16px 40px" }}>
              {isBetaMode ? "Join the Beta →" : "Create Free Account →"}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer style={{
        padding: "32px 40px",
        borderTop: "1px solid rgba(157,39,222,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
      }}>
        <span style={{ fontFamily: "Superstar, fantasy", fontSize: 16, color: "#9D27DE" }}>BITBLOCK</span>
        <div className="footer-links" style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Docs", href: "#" },
            { label: "Marketplace", to: "/marketplace" },
            { label: "Privacy Policy", to: "/privacy" },
            { label: "Terms", to: "/terms" },
            { label: "GitHub", href: "https://github.com/AnasWagih25/BitBlock" },
            { label: "Discord", href: "#" }
          ].map((l) => (
            l.to ? (
              <Link key={l.label} to={l.to} style={{ color: "rgba(242,242,240,0.4)", fontSize: 13, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#9D27DE")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.4)")}>
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} style={{ color: "rgba(242,242,240,0.4)", fontSize: 13, textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#9D27DE")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.4)")}>
                {l.label}
              </a>
            )
          ))}
        </div>
        <span style={{ fontSize: 12, color: "rgba(242,242,240,0.25)" }}>© 2026 8BitLab. Property and development of 8bitlab.org.</span>
      </footer>

      <DemoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />
    </div>
  );
}
