import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, getCountFromServer, collection, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useAppDialog } from "../contexts/DialogContext";
import CassetteMascot from "../components/ui/CassetteMascot";
import { useUsage } from "../hooks/useUsage";
import { Edit2, Crown, Wrench, FolderOpen, Puzzle, Camera, Shield, Globe, ExternalLink } from "lucide-react";
import MobileMenuButton from "../components/ui/MobileMenuButton";

export default function ProfilePage() {
  const { user, signOut, updateUserProfile, isAdmin, customLimits } = useAuth();
  const { alert } = useAppDialog();
  const { usage, plan } = useUsage(user?.uid, customLimits);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [github, setGithub] = useState("");
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [publicProfile, setPublicProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) { await alert("Image is too large. Maximum size is 5MB."); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || "png";
      const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateUserProfile({ photoURL: url });
      await updateDoc(doc(db, "users", user.uid), { photoURL: url });
      setProfile((p: any) => ({ ...p, photoURL: url }));
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      await alert("Failed to upload image. Please try again.");
    } finally { setUploadingAvatar(false); }
  };

  useEffect(() => { if (user) fetchProfile(); }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const q2 = query(collection(db, "projects"), where("ownerId", "==", user.uid));
      const countSnap = await getCountFromServer(q2);
      const projectCount = countSnap.data().count;
      if (snap.exists()) {
        const data = snap.data();
        setProfile({ ...data, projectCount });
        setDisplayName(data.displayName || user.displayName || "");
        setBio(data.bio || ""); setWebsite(data.website || ""); setGithub(data.github || "");
        setEmailUpdates(typeof data.emailUpdates === "boolean" ? data.emailUpdates : true);
        setPublicProfile(Boolean(data.publicProfile));
      } else { setProfile({ projectCount }); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const lastChanged = profile?.nameLastChangedAt?.toDate?.() || profile?.nameLastChangedAt;
  const daysSinceChange = lastChanged ? (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24) : null;
  const canChangeName = isAdmin || daysSinceChange === null || daysSinceChange >= 30;
  const daysLeft = daysSinceChange !== null ? Math.ceil(30 - daysSinceChange) : 0;

  const saveProfile = async () => {
    if (!user || (!isAdmin && !canChangeName)) return;
    setSaving(true);
    try {
      await updateUserProfile({ displayName });
      await updateDoc(doc(db, "users", user.uid), { displayName, nameLastChangedAt: serverTimestamp() });
      setProfile((p: any) => ({ ...p, displayName, nameLastChangedAt: new Date() }));
    } catch (e: any) {
      console.error(e);
      await alert("Failed to update profile. " + (e.message || "Ensure you're not trying to bypass the 30-day limit."));
    } finally { setSaving(false); }
  };

  const savePreferences = async () => {
    if (!user) return;
    const tw = website.trim(), tg = github.trim(), tb = bio.trim();
    const urlOk = (v: string) => !v || /^https?:\/\/.+/i.test(v);
    if (!urlOk(tw) || !urlOk(tg)) { await alert("Website/GitHub links must start with http:// or https://"); return; }
    setSavingPrefs(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { bio: tb, website: tw, github: tg, emailUpdates, publicProfile, updatedAt: serverTimestamp() });
      setProfile((p: any) => ({ ...p, bio: tb, website: tw, github: tg, emailUpdates, publicProfile }));
      await alert("Profile settings saved.");
    } catch (e: any) { console.error(e); await alert("Failed to save settings. " + (e.message || "Please try again.")); }
    finally { setSavingPrefs(false); }
  };

  const initials = (profile?.displayName || user?.email || "U")[0].toUpperCase();

  /* ── Progress bar helper ── */
  const UsageBar = ({ label, used, max, color, text }: { label: string; used: number | null; max: number | null; color: string; text?: string }) => {
    const pct = used != null && max != null ? Math.min(100, (used / max) * 100) : 0;
    const warn = pct > 85;
    return (
      <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 14, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "rgba(242,242,240,0.5)", fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: warn ? "#f87171" : "#F2F2F0" }}>{text || `${used} / ${max ?? "∞"}`}</span>
        </div>
        {used != null && max != null && (
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
            <div style={{
              height: 6, borderRadius: 3, width: `${pct}%`, transition: "width 0.5s cubic-bezier(0.23,1,0.32,1)",
              background: warn ? "linear-gradient(90deg, #EF4444, #f87171)" : `linear-gradient(90deg, ${color}, ${color}cc)`,
              boxShadow: warn ? "0 0 12px rgba(239,68,68,0.4)" : `0 0 10px ${color}40`,
            }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-page="profile" style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>
      {/* ── Nav ── */}
      <nav className="glass-dark" style={{
        position: "sticky", top: 0, zIndex: 100, height: 64, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 40px", borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link to="/dashboard" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span></span>
          </Link>
          <MobileMenuButton targetId="profile-nav-links" />
          <div id="profile-nav-links" className="nav-links" style={{ display: "flex", gap: 4 }}>
            {[{ label: "Projects", to: "/dashboard" }, { label: "Marketplace", to: "/marketplace" }].map((item) => (
              <Link key={item.label} to={item.to} className="btn-ghost">{item.label}</Link>
            ))}
            {isAdmin && <Link to="/admin" className="btn-ghost" style={{ color: "#F59E0B", display: "flex", alignItems: "center", gap: 4 }}><Shield size={14} /> Admin</Link>}
          </div>
        </div>
        <button onClick={() => signOut()} className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px" }}>Sign Out</button>
      </nav>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}>
          <CassetteMascot size={120} mood="thinking" animate />
        </div>
      ) : (
        <>
          {/* ── Hero Header ── */}
          <section className="grid-bg profile-hero" style={{ position: "relative", overflow: "hidden", padding: "48px 40px 40px" }}>
            <div style={{ position: "absolute", top: "-15%", left: "15%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-10%", right: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(185,79,240,0.08) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

            <div className="profile-hero-inner" style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 32, alignItems: "center", position: "relative", zIndex: 1 }}>
              {/* Avatar */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 120, height: 120, borderRadius: "50%", padding: 3,
                  background: "linear-gradient(135deg, #9D27DE, #B94FF0, #9D27DE)",
                  boxShadow: "0 0 40px rgba(157,39,222,0.35)",
                }}>
                  <label style={{ cursor: uploadingAvatar ? "wait" : "pointer", display: "block", borderRadius: "50%", overflow: "hidden", width: "100%", height: "100%", position: "relative" }}>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    {profile?.photoURL || user?.photoURL ? (
                      <img src={profile?.photoURL || user?.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: uploadingAvatar ? 0.5 : 1 }} alt="avatar" />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#1A0628", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700, color: "#B94FF0", opacity: uploadingAvatar ? 0.5 : 1 }}>{initials}</div>
                    )}
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = "1"} onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                      <Camera color="#fff" size={24} />
                    </div>
                  </label>
                </div>
                {!uploadingAvatar && (
                  <div style={{ position: "absolute", bottom: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: "#22C55E", border: "3px solid #0A0A0A" }} />
                )}
              </div>

              {/* Identity */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F2F2F0", margin: 0, lineHeight: 1.2 }}>
                  {profile?.displayName || user?.displayName || "BitBuilder"}
                </h1>
                <p style={{ fontSize: 14, color: "rgba(242,242,240,0.4)", margin: "4px 0 12px" }}>{user?.email}</p>
                <div className="profile-badges" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {isAdmin && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Crown size={11} /> Admin
                    </span>
                  )}
                  {customLimits && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <Shield size={11} /> Custom Limits
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "rgba(242,242,240,0.3)" }}>
                    Joined {profile?.createdAt?.toDate?.()?.getFullYear() || new Date().getFullYear()}
                  </span>
                </div>
              </div>

              <CassetteMascot size={72} mood="happy" animate />
            </div>
          </section>

          <div className="profile-content" style={{ maxWidth: 900, margin: "0 auto", padding: "32px 40px 64px" }}>
            {/* ── Stats ── */}
            <div className="profile-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Projects", value: profile?.projectCount || 0, icon: <FolderOpen size={22} color="#9D27DE" />, color: "#9D27DE" },
                { label: "Published Blocks", value: profile?.publishedBlocks || 0, icon: <Puzzle size={22} color="#3B82F6" />, color: "#3B82F6" },
                { label: "Compilations", value: profile?.compilationCount || 0, icon: <Wrench size={22} color="#22C55E" />, color: "#22C55E" },
              ].map((stat) => (
                <div key={stat.label} style={{
                  borderRadius: 16, padding: "20px 24px", textAlign: "center",
                  border: "1px solid rgba(157,39,222,0.12)",
                  background: "linear-gradient(170deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                }}>
                  <div style={{ marginBottom: 8, display: "flex", justifyContent: "center" }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                      background: `${stat.color}15`, border: `1px solid ${stat.color}25`,
                    }}>{stat.icon}</div>
                  </div>
                  <div style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: "rgba(242,242,240,0.4)", marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* ── Usage Card ── */}
            <div style={{ borderRadius: 16, padding: "24px", border: "1px solid rgba(157,39,222,0.12)", background: "linear-gradient(170deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Shield size={18} color="#9D27DE" />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Usage & Limits</h2>
                <span style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", borderRadius: 999, background: `rgba(242,242,240,0.1)`, color: "rgba(242,242,240,0.8)", border: `1px solid rgba(242,242,240,0.2)`, fontWeight: 600 }}>Open Source Free Tier</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <UsageBar label="Compiles Today" used={usage.compilesToday} max={plan.compilesPerDay} color="#3B82F6" />
                <UsageBar label="Compiles This Month" used={usage.compilesThisMonth} max={plan.compilesPerMonth || null} color="#22C55E" />
                <UsageBar label="Training Jobs" used={usage.trainingJobsThisMonth} max={plan.trainingJobsPerMonth} color="#9D27DE" />
                <UsageBar label="Max Job Time" used={null} max={null} color="#F59E0B" text={plan.maxJobTimeSeconds >= 60 ? `${Math.floor(plan.maxJobTimeSeconds / 60)} min` : `${plan.maxJobTimeSeconds}s`} />
              </div>
            </div>

            {/* ── Profile Settings ── */}
            <div style={{ borderRadius: 16, padding: "28px", border: "1px solid rgba(157,39,222,0.12)", background: "linear-gradient(170deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                <Edit2 size={18} color="#9D27DE" />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Profile Settings</h2>
              </div>

              {/* Display Name */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", display: "block", marginBottom: 8, fontWeight: 500 }}>Display Name</label>
                <div style={{ display: "flex", gap: 12 }}>
                  <input id="profile-name-input" type="text" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    style={{ flex: 1, maxWidth: 340 }} placeholder="Your Display Name" disabled={!canChangeName} />
                  <button onClick={saveProfile} disabled={saving || !canChangeName || !displayName.trim() || displayName === (profile?.displayName || user?.displayName)}
                    className="btn-primary" style={{ padding: "0 24px", fontSize: 13 }} title={!canChangeName ? `Wait ${daysLeft} more day(s)` : ""}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
                {!canChangeName && !isAdmin && <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>* You can change your name again in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.</p>}
              </div>

              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(157,39,222,0.15), transparent)", margin: "0 0 20px" }} />

              {/* Bio */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", display: "block", marginBottom: 8, fontWeight: 500 }}>Bio</label>
                <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell the community what you build" style={{ minHeight: 78, resize: "vertical" }} />
              </div>

              {/* Links */}
              <div className="profile-links-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", display: "flex", alignItems: "center", gap: 4, marginBottom: 8, fontWeight: 500 }}><Globe size={13} /> Website</label>
                  <input type="text" className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://your-site.com" />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", display: "flex", alignItems: "center", gap: 4, marginBottom: 8, fontWeight: 500 }}><ExternalLink size={13} /> GitHub</label>
                  <input type="text" className="input" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/username" />
                </div>
              </div>

              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(157,39,222,0.15), transparent)", margin: "0 0 20px" }} />

              {/* Preferences */}
              <div className="profile-prefs-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#F2F2F0", fontSize: 13 }}>
                  <input type="checkbox" checked={emailUpdates} onChange={(e) => setEmailUpdates(e.target.checked)} />
                  Email updates for marketplace activity
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#F2F2F0", fontSize: 13 }}>
                  <input type="checkbox" checked={publicProfile} onChange={(e) => setPublicProfile(e.target.checked)} />
                  Public community profile
                </label>
              </div>

              <button onClick={savePreferences} disabled={savingPrefs} className="btn-secondary" style={{ padding: "10px 24px", fontSize: 13 }}>
                {savingPrefs ? "Saving settings..." : "Save Settings"}
              </button>

              {/* Footer actions */}
              <div className="profile-footer-actions" style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(157,39,222,0.1)", display: "flex", gap: 12 }}>
                <Link to="/dashboard" className="btn-secondary" style={{ flex: 1, justifyContent: "center", fontSize: 13 }}>Go to Projects</Link>
                <button onClick={() => signOut()} className="btn-ghost" style={{ flex: 1, justifyContent: "center", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 100 }}>Sign Out</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
