import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { PLANS, PLAN_ORDER, getPlanConfig, formatStorageSize, formatJobTime } from "../lib/plans";
import type { PlanId } from "../lib/plans";
import { Crown, Users, Zap, Shield, Search, ChevronDown, X, BarChart3, CreditCard, Activity, Calendar, Clock, Database, Server } from "lucide-react";

interface UserRow {
  uid: string; email: string; displayName: string; photoURL?: string;
  role: string; plan: PlanId; createdAt: any; planStartedAt?: any; planChangedAt?: any;
  projectCount?: number; compilationCount?: number; publishedBlocks?: number;
  usage?: { compilesToday: number; compilesThisMonth: number; trainingJobsThisMonth: number };
}

export default function AdminPage() {
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [updating, setUpdating] = useState("");

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const rows: UserRow[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        let usage = { compilesToday: 0, compilesThisMonth: 0, trainingJobsThisMonth: 0 };
        try {
          const uSnap = await getDoc(doc(db, "users", d.id, "usage", "current"));
          if (uSnap.exists()) { const u = uSnap.data(); usage = { compilesToday: u.compilesToday || 0, compilesThisMonth: u.compilesThisMonth || 0, trainingJobsThisMonth: u.trainingJobsThisMonth || 0 }; }
        } catch {}
        rows.push({ uid: d.id, email: data.email || "", displayName: data.displayName || "", photoURL: data.photoURL, role: data.role || "user", plan: data.plan || "free", createdAt: data.createdAt, planStartedAt: data.planStartedAt, planChangedAt: data.planChangedAt, projectCount: data.projectCount || 0, compilationCount: data.compilationCount || 0, publishedBlocks: data.publishedBlocks || 0, usage });
      }
      rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setUsers(rows);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const changePlan = async (uid: string, newPlan: PlanId) => {
    setUpdating(uid);
    try {
      await updateDoc(doc(db, "users", uid), { plan: newPlan, planChangedAt: serverTimestamp() });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, plan: newPlan } : u));
      if (selectedUser?.uid === uid) setSelectedUser(prev => prev ? { ...prev, plan: newPlan } : null);
    } catch (e) { console.error(e); }
    setUpdating("");
  };

  const toggleAdmin = async (uid: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setUpdating(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role: newRole });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      if (selectedUser?.uid === uid) setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
    } catch (e) { console.error(e); }
    setUpdating("");
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.displayName.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "all" || u.plan === planFilter;
    return matchSearch && matchPlan;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === "admin").length,
    paid: users.filter(u => u.plan !== "free").length,
    mrr: users.reduce((s, u) => s + getPlanConfig(u.plan).price, 0),
  };

  const timeAgo = (ts: any) => {
    if (!ts) return "—";
    const d = ts.toDate?.() ?? new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const PlanBadge = ({ plan }: { plan: PlanId }) => {
    const cfg = getPlanConfig(plan);
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30`, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cfg.icon} {cfg.name}</span>;
  };

  const RoleBadge = ({ role }: { role: string }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: role === "admin" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)", color: role === "admin" ? "#F59E0B" : "rgba(242,242,240,0.5)", border: `1px solid ${role === "admin" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {role === "admin" && <Crown size={12} />}{role}
    </span>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>
      {/* Nav */}
      <nav className="glass-dark" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", borderBottom: "1px solid rgba(157,39,222,0.15)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link to="/dashboard" style={{ textDecoration: "none" }}><span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span></span></Link>
          <div style={{ display: "flex", gap: 4 }}>
            <Link to="/dashboard" className="btn-ghost">Projects</Link>
            <Link to="/marketplace" className="btn-ghost">Marketplace</Link>
            <span className="btn-ghost" style={{ color: "#F59E0B", background: "rgba(245,158,11,0.1)" }}>
              <Shield size={14} /> Admin
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }} className="hover:opacity-80 transition-opacity">
            {user?.photoURL ? (
              <img src={user.photoURL} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(157,39,222,0.5)", objectFit: "cover" }} alt="avatar" />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #F59E0B, #D97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>{(user?.displayName || user?.email || "A")[0].toUpperCase()}</div>
            )}
            <span style={{ fontSize: 13, color: "rgba(242,242,240,0.7)", fontWeight: 500 }}>{user?.displayName || user?.email}</span>
          </Link>
          <button onClick={() => signOut()} className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px" }}>Sign Out</button>
        </div>
      </nav>

      {/* Hero Header */}
      <div style={{
        padding: "60px 40px 40px", borderBottom: "1px solid rgba(157,39,222,0.1)",
        position: "relative", overflow: "hidden",
        background: "linear-gradient(180deg, rgba(245,158,11,0.05) 0%, transparent 100%)"
      }}>
        <div style={{
          position: "absolute", top: -100, right: "20%", width: 600, height: 600,
          background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 20 }}>
            <Shield size={14} /> Control Center
          </div>
          <h1 style={{ fontFamily: "Superstar, fantasy", fontSize: 48, color: "#F2F2F0", letterSpacing: "0.02em", marginBottom: 12, lineHeight: 1.1 }}>
            ADMIN DASHBOARD
          </h1>
          <p style={{ fontSize: 16, color: "rgba(242,242,240,0.6)", margin: 0, lineHeight: 1.6, maxWidth: 600 }}>
            Manage users, monitor platform usage, and oversee subscription plans across the entire BitBlock ecosystem.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "40px" }}>
        {/* KPI Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 40 }}>
          {[
            { label: "Total Users", value: stats.total, icon: <Users size={24} />, color: "#3B82F6" },
            { label: "Platform Admins", value: stats.admins, icon: <Crown size={24} />, color: "#F59E0B" },
            { label: "Paid Subscribers", value: stats.paid, icon: <CreditCard size={24} />, color: "#22C55E" },
            { label: "Estimated MRR", value: `$${stats.mrr}`, icon: <BarChart3 size={24} />, color: "#9D27DE" },
          ].map(s => (
            <div key={s.label} className="card" style={{ 
              padding: "24px", display: "flex", alignItems: "center", gap: 20,
              border: "1px solid rgba(255,255,255,0.05)",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              cursor: "default"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = `${s.color}40`;
              e.currentTarget.style.boxShadow = `0 12px 24px -10px ${s.color}30`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
              e.currentTarget.style.boxShadow = "none";
            }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: 16, 
                background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", 
                color: s.color, flexShrink: 0,
                border: `1px solid ${s.color}30`
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#F2F2F0", fontFamily: "Superstar, fantasy", lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Plan Overview Cards */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#F2F2F0", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}><Zap size={18} color="#F59E0B" /> Plan Distribution</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {PLAN_ORDER.map(pid => {
              const p = PLANS[pid];
              const count = users.filter(u => u.plan === pid).length;
              const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={pid} className="card" style={{ padding: "20px", position: "relative", overflow: "hidden", border: `1px solid ${p.color}30` }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${p.color}, ${p.color}60)` }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 800, color: p.color, display: "flex", alignItems: "center", gap: 6 }}>{p.icon} {p.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(242,242,240,0.4)", marginTop: 4, display: "block" }}>{p.priceLabel}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#F2F2F0", fontFamily: "Superstar, fantasy" }}>{count}</div>
                      <div style={{ fontSize: 11, color: "rgba(242,242,240,0.4)" }}>users ({percentage}%)</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters Toolbar */}
        <div style={{ 
          display: "flex", gap: 16, marginBottom: 24, alignItems: "center", flexWrap: "wrap",
          background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)"
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#F2F2F0", margin: 0, marginRight: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={18} color="#3B82F6" /> User Management
          </h2>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 360 }}>
            <Search size={16} style={{ position: "absolute", left: 14, top: 11, color: "rgba(242,242,240,0.4)" }} />
            <input className="input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40, paddingRight: 16, fontSize: 14 }} />
          </div>
          <div style={{ position: "relative" }}>
            <select className="input" value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ width: 160, cursor: "pointer", appearance: "none", paddingRight: 36, fontSize: 14 }}>
              <option value="all">All Plans</option>
              {PLAN_ORDER.map(p => <option key={p} value={p}>{PLANS[p].name}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: "absolute", right: 14, top: 12, color: "rgba(242,242,240,0.4)", pointerEvents: "none" }} />
          </div>
          <div style={{ fontSize: 13, color: "rgba(242,242,240,0.4)", fontWeight: 500, padding: "0 8px" }}>
            Showing {filtered.length} of {users.length}
          </div>
        </div>

        {/* Users Table */}
        <div style={{ background: "#12031C", border: "1px solid rgba(157,39,222,0.2)", borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(157,39,222,0.05)", borderBottom: "1px solid rgba(157,39,222,0.2)" }}>
                  {["User", "Plan", "Role", "Compiles", "Training", "Joined", "Actions"].map(h => (
                    <th key={h} style={{ padding: "16px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "rgba(242,242,240,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 60, textAlign: "center", color: "rgba(242,242,240,0.4)", fontSize: 15 }}>Loading user data...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 60, textAlign: "center", color: "rgba(242,242,240,0.4)", fontSize: 15 }}>No users matched your search</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.uid} style={{ borderBottom: "1px solid rgba(157,39,222,0.1)", cursor: "pointer", transition: "background 0.2s ease" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(157,39,222,0.08)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")} onClick={() => setSelectedUser(u)}>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {u.photoURL ? <img src={u.photoURL} style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(157,39,222,0.4)" }} alt="" /> : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #9D27DE, #B94FF0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", border: "2px solid rgba(157,39,222,0.4)" }}>{(u.displayName || u.email || "?")[0].toUpperCase()}</div>}
                        <div><div style={{ fontWeight: 700, color: "#F2F2F0", marginBottom: 2 }}>{u.displayName || "—"}</div><div style={{ fontSize: 12, color: "rgba(242,242,240,0.4)" }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}><PlanBadge plan={u.plan} /></td>
                    <td style={{ padding: "16px 20px" }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: "16px 20px", color: "rgba(242,242,240,0.6)", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "#F2F2F0", fontWeight: 700 }}>{u.usage?.compilesToday || 0}</span><span style={{ color: "rgba(242,242,240,0.4)", fontSize: 11 }}>/day</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <span>{u.usage?.compilesThisMonth || 0}</span><span style={{ color: "rgba(242,242,240,0.4)", fontSize: 11 }}>/mo</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", color: "rgba(242,242,240,0.6)", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "#F2F2F0", fontWeight: 700 }}>{u.usage?.trainingJobsThisMonth || 0}</span><span style={{ color: "rgba(242,242,240,0.4)", fontSize: 11 }}>/mo</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", color: "rgba(242,242,240,0.4)", fontSize: 13, fontWeight: 500 }}>{timeAgo(u.createdAt)}</td>
                    <td style={{ padding: "16px 20px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value={u.plan} onChange={e => changePlan(u.uid, e.target.value as PlanId)} disabled={updating === u.uid} style={{ padding: "6px 12px", fontSize: 12, background: "rgba(255,255,255,0.05)", color: "#F2F2F0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", outline: "none" }}>
                          {PLAN_ORDER.map(p => <option key={p} value={p} style={{ background: "#0A0A0A" }}>{PLANS[p].name}</option>)}
                        </select>
                        <button onClick={() => toggleAdmin(u.uid, u.role)} disabled={updating === u.uid || u.uid === user?.uid} title={u.uid === user?.uid ? "Can't remove own admin" : u.role === "admin" ? "Remove admin" : "Make admin"} style={{ padding: "6px", background: u.role === "admin" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: u.role === "admin" ? "#F59E0B" : "rgba(242,242,240,0.4)", border: `1px solid ${u.role === "admin" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, cursor: u.uid === user?.uid ? "not-allowed" : "pointer", opacity: u.uid === user?.uid ? 0.3 : 1, transition: "all 0.2s ease" }}>
                          <Crown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSelectedUser(null)}>
          <div className="glass-dark" style={{ borderRadius: 24, padding: 40, width: 600, maxHeight: "90vh", overflowY: "auto", animation: "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)", border: "1px solid rgba(157,39,222,0.3)", boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                {selectedUser.photoURL ? <img src={selectedUser.photoURL} style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid #9D27DE" }} alt="" /> : <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #9D27DE, #B94FF0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "#fff", border: "3px solid rgba(157,39,222,0.5)" }}>{(selectedUser.displayName || "?")[0].toUpperCase()}</div>}
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F2F2F0", margin: 0, marginBottom: 4 }}>{selectedUser.displayName || "—"}</h2>
                  <p style={{ fontSize: 14, color: "rgba(242,242,240,0.5)", margin: 0, marginBottom: 12 }}>{selectedUser.email}</p>
                  <div style={{ display: "flex", gap: 8 }}><PlanBadge plan={selectedUser.plan} /><RoleBadge role={selectedUser.role} /></div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", color: "rgba(242,242,240,0.6)", padding: 6, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#F2F2F0"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(242,242,240,0.6)"; }}><X size={20} /></button>
            </div>

            {/* Lifetime Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Total Projects", value: selectedUser.projectCount || 0, color: "#3B82F6" },
                { label: "Total Compiles", value: selectedUser.compilationCount || 0, color: "#22C55E" },
                { label: "Published Blocks", value: selectedUser.publishedBlocks || 0, color: "#9D27DE" },
              ].map(s => (
                <div key={s.label} style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 16, padding: "20px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color, fontFamily: "Superstar, fantasy", marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(242,242,240,0.5)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Current Period Usage */}
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#F2F2F0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Activity size={16} color="#F59E0B" /> Current Period Usage</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Compiles Today", value: selectedUser.usage?.compilesToday || 0, max: getPlanConfig(selectedUser.plan).compilesPerDay },
                { label: "Compiles This Month", value: selectedUser.usage?.compilesThisMonth || 0, max: getPlanConfig(selectedUser.plan).compilesPerMonth || "∞" },
                { label: "Training Jobs (Mo)", value: selectedUser.usage?.trainingJobsThisMonth || 0, max: getPlanConfig(selectedUser.plan).trainingJobsPerMonth },
                { label: "Max Job Time", value: formatJobTime(getPlanConfig(selectedUser.plan).maxJobTimeSeconds), max: "" },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "16px" }}>
                  <div style={{ fontSize: 12, color: "rgba(242,242,240,0.4)", fontWeight: 500, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#F2F2F0" }}>{s.value}{s.max !== "" && <span style={{ fontSize: 14, color: "rgba(242,242,240,0.3)", fontWeight: 500 }}> / {s.max}</span>}</div>
                </div>
              ))}
            </div>

            {/* Plan Info */}
            <h3 style={{ fontSize: 14, fontWeight: 800, color: "#F2F2F0", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}><Database size={16} color="#3B82F6" /> Subscription & Limits</h3>
            <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "20px", marginBottom: 32 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Calendar size={14} color="rgba(242,242,240,0.4)" /><span style={{ fontSize: 13, color: "rgba(242,242,240,0.5)" }}>Joined:</span> <span style={{ fontSize: 13, color: "#F2F2F0", fontWeight: 600 }}>{selectedUser.createdAt?.toDate?.()?.toLocaleDateString() || "—"}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock size={14} color="rgba(242,242,240,0.4)" /><span style={{ fontSize: 13, color: "rgba(242,242,240,0.5)" }}>Plan start:</span> <span style={{ fontSize: 13, color: "#F2F2F0", fontWeight: 600 }}>{selectedUser.planStartedAt ? (selectedUser.planStartedAt.toDate?.()?.toLocaleDateString() || "—") : "—"}</span></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Database size={14} color="rgba(242,242,240,0.4)" /><span style={{ fontSize: 13, color: "rgba(242,242,240,0.5)" }}>Storage:</span> <span style={{ fontSize: 13, color: "#F2F2F0", fontWeight: 600 }}>{formatStorageSize(getPlanConfig(selectedUser.plan).datasetStorageBytes)} / {formatStorageSize(getPlanConfig(selectedUser.plan).modelStorageBytes)}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Server size={14} color="rgba(242,242,240,0.4)" /><span style={{ fontSize: 13, color: "rgba(242,242,240,0.5)" }}>Models:</span> <span style={{ fontSize: 13, color: "#F2F2F0", fontWeight: 600 }}>{getPlanConfig(selectedUser.plan).deployedModels} max</span></div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(242,242,240,0.5)", marginBottom: 8, display: "block" }}>Change Plan</label>
                <select value={selectedUser.plan} onChange={e => changePlan(selectedUser.uid, e.target.value as PlanId)} disabled={updating === selectedUser.uid} className="input" style={{ width: "100%", cursor: "pointer", fontSize: 14 }}>
                  {PLAN_ORDER.map(p => <option key={p} value={p}>{PLANS[p].name} — {PLANS[p].priceLabel}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(242,242,240,0.5)", marginBottom: 8, display: "block" }}>Manage Role</label>
                <button onClick={() => toggleAdmin(selectedUser.uid, selectedUser.role)} disabled={updating === selectedUser.uid || selectedUser.uid === user?.uid} className="btn-secondary" style={{ width: "100%", padding: "12px", fontSize: 14, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <Crown size={16} /> {selectedUser.role === "admin" ? "Demote to User" : "Promote to Admin"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
