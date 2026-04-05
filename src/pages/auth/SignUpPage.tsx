import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import CassetteMascot from "../../components/ui/CassetteMascot";

export default function SignUpPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      navigate("/dashboard");
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate("/dashboard");
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setGoogleLoading(false);
    }
  };

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthColors = ["", "#EF4444", "#F59E0B", "#22C55E"];
  const strengthLabels = ["", "Weak", "Good", "Strong"];

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif",
    }}>
      {/* Left branding */}
      <div className="dot-bg" style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 60, position: "relative", overflow: "hidden",
        borderRight: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{
          position: "absolute", bottom: "20%", right: "10%",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(157,39,222,0.18) 0%, transparent 70%)",
          filter: "blur(50px)", pointerEvents: "none",
        }} />
        <Link to="/" style={{ position: "absolute", top: 32, left: 40, textDecoration: "none" }}>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>
            BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
          </span>
        </Link>
        <CassetteMascot size={220} mood="excited" animate />
        <h2 style={{
          fontFamily: "Superstar, fantasy", fontSize: 24,
          letterSpacing: "0.06em", color: "#F2F2F0",
          marginTop: 24, textAlign: "center",
        }}>
          JOIN THE MAKERS
        </h2>
        <p style={{ color: "rgba(242,242,240,0.45)", fontSize: 14, textAlign: "center", marginTop: 8, maxWidth: 280 }}>
          Build firmware visually. Flash it directly. No coding experience needed.
        </p>
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
          {["✓ Free forever on Spark plan", "✓ Cloud compilation included", "✓ Community marketplace access"].map((t) => (
            <p key={t} style={{ fontSize: 13, color: "rgba(242,242,240,0.5)" }}>{t}</p>
          ))}
        </div>
      </div>

      {/* Right: Form */}
      <div style={{
        width: 500, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "60px 48px",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F2F2F0", marginBottom: 8 }}>Create Account</h1>
          <p style={{ fontSize: 14, color: "rgba(242,242,240,0.4)", marginBottom: 32 }}>
            Already have one? <Link to="/login" style={{ color: "#9D27DE", textDecoration: "none" }}>Sign in</Link>
          </p>

          <button
            id="google-signup-btn"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "center", marginBottom: 20 }}
          >
            {googleLoading ? <Spinner /> : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign up with Google
              </>
            )}
          </button>

          <div className="divider" style={{ margin: "16px 0", position: "relative" }}>
            <span style={{
              position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
              background: "#0A0A0A", padding: "0 12px",
              fontSize: 12, color: "rgba(242,242,240,0.3)",
            }}>or with email</span>
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
              fontSize: 13, color: "#f87171",
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Display Name</label>
              <input
                id="signup-name"
                type="text"
                className="input"
                placeholder="BitBuilder42"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Email</label>
              <input
                id="signup-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Password</label>
              <input
                id="signup-password"
                type="password"
                className="input"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {password.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: i <= strength ? strengthColors[strength] : "rgba(255,255,255,0.1)",
                      transition: "background 0.3s",
                    }} />
                  ))}
                  <span style={{ fontSize: 11, color: strengthColors[strength], marginLeft: 8, minWidth: 40 }}>
                    {strengthLabels[strength]}
                  </span>
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: "rgba(242,242,240,0.3)", lineHeight: 1.5 }}>
              By creating an account you agree to our{" "}
              <a href="#" style={{ color: "#9D27DE", textDecoration: "none" }}>Terms of Service</a> and{" "}
              <a href="#" style={{ color: "#9D27DE", textDecoration: "none" }}>Privacy Policy</a>.
            </p>
            <button
              id="signup-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "13px" }}
            >
              {loading ? <Spinner /> : "Create Account →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: "spin-slow 0.8s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "That doesn't look like a valid email.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
