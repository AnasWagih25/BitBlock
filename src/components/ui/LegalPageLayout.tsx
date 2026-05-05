import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { FileText, Shield, CreditCard, ChevronRight } from "lucide-react";
import MobileMenuButton from "./MobileMenuButton";

interface LegalSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const legalPages = [
  { label: "Terms of Service", to: "/terms", icon: <FileText size={14} /> },
  { label: "Privacy Policy", to: "/privacy", icon: <Shield size={14} /> },
  { label: "Refund Policy", to: "/refund-policy", icon: <CreditCard size={14} /> },
];

export default function LegalPageLayout({
  title,
  effectiveDate,
  icon,
  sections,
  currentPath,
}: {
  title: string;
  effectiveDate: string;
  icon: React.ReactNode;
  sections: LegalSection[];
  currentPath: string;
}) {
  const { user, signOut, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div data-page="legal" style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>
      {/* Nav */}
      <nav className="glass-dark" style={{
        position: "sticky", top: 0, zIndex: 100, padding: "0 40px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link to={user ? "/dashboard" : "/"} style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>
              BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
            </span>
          </Link>
          <MobileMenuButton targetId="legal-nav-links" />
          <div id="legal-nav-links" className="nav-links" style={{ display: "flex", gap: 4 }}>
            {user && <Link to="/dashboard" className="btn-ghost">Projects</Link>}
            <Link to="/marketplace" className="btn-ghost">Marketplace</Link>
            <Link to="/pricing" className="btn-ghost">Pricing</Link>
            {isAdmin && <Link to="/admin" className="btn-ghost" style={{ color: "#F59E0B" }}>Admin</Link>}
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

      {/* Hero */}
      <section className="grid-bg legal-hero" style={{
        padding: "60px 40px 40px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-20%", left: "30%", width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(157,39,222,0.12) 0%, transparent 70%)",
          filter: "blur(50px)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(157,39,222,0.15)", border: "1px solid rgba(157,39,222,0.3)",
          }}>
            {icon}
          </div>
          <h1 style={{
            fontFamily: "Superstar, fantasy", fontSize: "clamp(28px, 4vw, 42px)",
            letterSpacing: "0.05em", color: "#F2F2F0", marginBottom: 8,
          }}>
            {title}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(242,242,240,0.4)" }}>Effective date: {effectiveDate}</p>
        </div>
      </section>

      {/* Content */}
      <div className="legal-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 40px 80px", display: "grid", gridTemplateColumns: "220px 1fr", gap: 40 }}>
        {/* TOC Sidebar */}
        <aside className="legal-sidebar" style={{ position: "sticky", top: 88, alignSelf: "start" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(242,242,240,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            On this page
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  fontSize: 12, padding: "6px 12px", borderRadius: 6,
                  textDecoration: "none", transition: "all 0.15s ease",
                  color: activeSection === s.id ? "#E9D5FF" : "rgba(242,242,240,0.45)",
                  background: activeSection === s.id ? "rgba(157,39,222,0.12)" : "transparent",
                  borderLeft: activeSection === s.id ? "2px solid #9D27DE" : "2px solid transparent",
                }}
              >
                {s.title}
              </a>
            ))}
          </div>

          {/* Cross-links */}
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(157,39,222,0.1)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(242,242,240,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Related
            </div>
            {legalPages.filter((p) => p.to !== currentPath).map((p) => (
              <Link
                key={p.to}
                to={p.to}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  fontSize: 12, color: "rgba(242,242,240,0.5)", textDecoration: "none",
                  borderRadius: 6, transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#E9D5FF"; e.currentTarget.style.background = "rgba(157,39,222,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(242,242,240,0.5)"; e.currentTarget.style.background = "transparent"; }}
              >
                {p.icon}
                {p.label}
                <ChevronRight size={12} style={{ marginLeft: "auto", opacity: 0.4 }} />
              </Link>
            ))}
          </div>
        </aside>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              style={{
                borderRadius: 16, padding: "24px 28px",
                border: "1px solid rgba(157,39,222,0.12)",
                background: "linear-gradient(170deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                backdropFilter: "blur(6px)",
                scrollMarginTop: 100,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 8, fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(157,39,222,0.15)", color: "#B94FF0", flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#F2F2F0" }}>{s.title}</h2>
              </div>
              <div style={{ color: "rgba(242,242,240,0.72)", lineHeight: 1.75, fontSize: 14 }}>
                {s.content}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        padding: "32px 40px", borderTop: "1px solid rgba(157,39,222,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
      }}>
        <span style={{ fontFamily: "Superstar, fantasy", fontSize: 16, color: "#9D27DE" }}>BITBLOCK</span>
        <div className="footer-links" style={{ display: "flex", gap: 24 }}>
          {legalPages.map((l) => (
            <Link key={l.to} to={l.to} style={{
              color: l.to === currentPath ? "#9D27DE" : "rgba(242,242,240,0.4)",
              fontSize: 13, textDecoration: "none",
            }}
              onMouseEnter={(e) => { if (l.to !== currentPath) e.currentTarget.style.color = "#9D27DE"; }}
              onMouseLeave={(e) => { if (l.to !== currentPath) e.currentTarget.style.color = "rgba(242,242,240,0.4)"; }}
            >{l.label}</Link>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "rgba(242,242,240,0.25)" }}>© 2026 BitBlock. All rights reserved.</span>
      </footer>
    </div>
  );
}
