import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import CassetteMascot from "../../components/ui/CassetteMascot";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
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

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif",
    }}>
      {/* Left panel */}
      <div className="grid-bg" style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 60, position: "relative", overflow: "hidden",
        borderRight: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{
          position: "absolute", top: "30%", left: "20%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(157,39,222,0.2) 0%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />
        <Link to="/" style={{ position: "absolute", top: 32, left: 40, textDecoration: "none" }}>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>
            BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
          </span>
        </Link>
        <CassetteMascot size={220} mood="happy" animate />
        <h2 style={{
          fontFamily: "Superstar, fantasy",
          fontSize: 28, letterSpacing: "0.06em",
          color: "#F2F2F0", marginTop: 24, textAlign: "center",
        }}>
          WELCOME BACK
        </h2>
        <p style={{ color: "rgba(242,242,240,0.45)", fontSize: 14, textAlign: "center", marginTop: 8 }}>
          Your circuits are waiting for you.
        </p>
      </div>

      {/* Right: Form */}
      <div style={{
        width: 480, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "60px 48px",
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F2F2F0", marginBottom: 8 }}>Sign In</h1>
          <p style={{ fontSize: 14, color: "rgba(242,242,240,0.4)", marginBottom: 32 }}>
            Don't have an account? <Link to="/signup" style={{ color: "#9D27DE", textDecoration: "none" }}>Sign up free</Link>
          </p>

          {/* Google */}
          <button
            id="google-signin-btn"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="btn-secondary"
            style={{ width: "100%", justifyContent: "center", marginBottom: 20, position: "relative" }}
          >
            {googleLoading ? (
              <Spinner />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="divider" style={{ margin: "16px 0", position: "relative" }}>
            <span style={{
              position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
              background: "#0A0A0A", padding: "0 12px",
              fontSize: 12, color: "rgba(242,242,240,0.3)",
            }}>or continue with email</span>
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
              <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Email</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Password</label>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: "#9D27DE", textDecoration: "none" }}>Forgot password?</Link>
            </div>
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "13px" }}
            >
              {loading ? <Spinner /> : "Sign In →"}
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
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Try again.",
    "auth/invalid-email": "That doesn't look like a valid email.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Try again.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-api-key": "Firebase API key is invalid in this deployment.",
    "auth/app-not-authorized": "This app origin is not authorized in Firebase Auth settings.",
    "auth/unauthorized-domain": "This domain is not authorized for Google sign-in in Firebase.",
    "auth/requests-from-this-origin-are-blocked": "Requests from this domain are blocked by Firebase/Auth API key restrictions.",
    "auth/operation-not-allowed": "This sign-in method is disabled in Firebase Auth.",
    "auth/network-request-failed": "Network error while contacting Firebase. Check connection and CORS/domain settings.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
