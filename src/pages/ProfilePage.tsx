import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import CassetteMascot from "../components/ui/CassetteMascot";
import { Edit2, Crown, Wrench, FolderOpen, Puzzle, Camera } from "lucide-react";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user) return;
    const file = e.target.files[0];
    
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || "png";
      const storageRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}.${ext}`);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: url });
      await updateDoc(doc(db, "users", user.uid), { photoURL: url });

      setProfile((p: any) => ({ ...p, photoURL: url }));
    } catch (err: any) {
      console.error("Avatar upload failed:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setDisplayName(data.displayName || user.displayName || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const lastChanged = profile?.nameLastChangedAt?.toDate?.() || profile?.nameLastChangedAt;
  const daysSinceChange = lastChanged ? (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24) : null;
  const canChangeName = daysSinceChange === null || daysSinceChange >= 30;
  const daysLeft = daysSinceChange !== null ? Math.ceil(30 - daysSinceChange) : 0;

  const saveProfile = async () => {
    if (!user || !canChangeName) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { 
        displayName,
        nameLastChangedAt: serverTimestamp()
      });
      setProfile((p: any) => ({ ...p, displayName, nameLastChangedAt: new Date() }));
    } catch (e: any) {
      console.error(e);
      alert("Failed to update profile. " + (e.message || "Ensure you're not trying to bypass the 30-day limit."));
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile?.displayName || user?.email || "U")[0].toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>
      {/* Nav */}
      <nav className="glass-dark" style={{
        height: 60, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 32px",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link to="/dashboard" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>
              BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
            </span>
          </Link>
          <div style={{ display: "flex", gap: 4 }}>
            <Link to="/dashboard" className="btn-ghost">Projects</Link>
            <Link to="/marketplace" className="btn-ghost">Marketplace</Link>
          </div>
        </div>
        <button onClick={() => signOut()} className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px" }}>
          Sign Out
        </button>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 32px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
            <CassetteMascot size={120} mood="thinking" animate />
          </div>
        ) : (
          <>
            {/* Profile header */}
            <div className="glass" style={{ borderRadius: 24, padding: "40px", marginBottom: 24, display: "flex", gap: 32, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <label style={{ cursor: uploadingAvatar ? "wait" : "pointer", position: "relative", display: "block" }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                  {profile?.photoURL || user?.photoURL ? (
                    <img
                      src={profile?.photoURL || user?.photoURL}
                      style={{ width: 100, height: 100, borderRadius: "50%", border: "3px solid #9D27DE", objectFit: "cover", opacity: uploadingAvatar ? 0.5 : 1 }}
                      alt="avatar"
                    />
                  ) : (
                    <div style={{
                      width: 100, height: 100, borderRadius: "50%",
                      background: "linear-gradient(135deg, #9D27DE, #B94FF0)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 40, fontWeight: 700, color: "white",
                      border: "3px solid rgba(157,39,222,0.5)",
                      boxShadow: "0 0 30px rgba(157,39,222,0.4)",
                      opacity: uploadingAvatar ? 0.5 : 1
                    }}>
                      {initials}
                    </div>
                  )}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
                    opacity: 0, transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                    <Camera color="#fff" size={24} />
                  </div>
                </label>
                {!uploadingAvatar && (
                  <div style={{
                    position: "absolute", bottom: 2, right: 2,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#22C55E", border: "3px solid #0A0A0A", pointerEvents: "none"
                  }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 700, color: "#F2F2F0" }}>
                    {profile?.displayName || user?.displayName || "BitBuilder"}
                  </h1>
                </div>
                <p style={{ fontSize: 14, color: "rgba(242,242,240,0.4)" }}>{user?.email}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <span className="badge badge-purple" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {profile?.role === "admin" ? <><Crown size={12} /> Admin</> : <><Wrench size={12} /> Maker</>}
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(242,242,240,0.3)" }}>
                    Joined {profile?.createdAt?.toDate?.()?.getFullYear() || new Date().getFullYear()}
                  </span>
                </div>
              </div>

              <CassetteMascot size={80} mood="happy" animate />
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Projects", value: profile?.projectCount || 0, icon: <FolderOpen size={28} /> },
                { label: "Published Blocks", value: profile?.publishedBlocks || 0, icon: <Puzzle size={28} /> },
                { label: "Compilations", value: "—", icon: <Wrench size={28} /> },
              ].map((stat) => (
                <div key={stat.label} className="card" style={{ textAlign: "center", padding: 24 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
                  <div style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: "rgba(242,242,240,0.4)", marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Settings Layout */}
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <Edit2 size={18} color="#9D27DE" />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0" }}>Profile Settings</h2>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 8 }}>Display Name</label>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input
                      id="profile-name-input"
                      type="text"
                      className="input"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      style={{ flex: 1, maxWidth: 320 }}
                      placeholder="Your Display Name"
                      disabled={!canChangeName}
                    />
                    <button onClick={saveProfile} disabled={saving || !canChangeName || !displayName.trim() || displayName === (profile?.displayName || user?.displayName)} className="btn-primary" style={{ padding: "0 24px", fontSize: 13 }} title={!canChangeName ? `Please wait ${daysLeft} more day(s)` : ""}>
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                  {!canChangeName && (
                    <p style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>
                      * You can change your name again in {daysLeft} day{daysLeft !== 1 ? "s" : ""}.
                    </p>
                  )}
                </div>
              </div>
              
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(157,39,222,0.1)", display: "flex", gap: 12 }}>
                <Link to="/dashboard" className="btn-secondary" style={{ flex: 1, justifyContent: "center", fontSize: 13 }}>
                  Go to Projects
                </Link>
                <button
                  onClick={() => signOut()}
                  className="btn-ghost"
                  style={{ flex: 1, justifyContent: "center", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 100 }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
