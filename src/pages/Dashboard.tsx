import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, deleteDoc, doc, updateDoc, increment
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Shield, FolderOpen, Plus, Trash2, Cpu, Clock, Layers } from "lucide-react";
import { useAppDialog } from "../contexts/DialogContext";
import CassetteMascot from "../components/ui/CassetteMascot";

interface Project {
  id: string;
  name: string;
  board: string;
  updatedAt: any;
  blockCount: number;
  isPublic: boolean;
}

import { BOARDS } from "../boards/registry";

export default function Dashboard() {
  const { user, signOut, isAdmin, isBetaMode } = useAuth();
  const { confirm } = useAppDialog();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBoard, setNewBoard] = useState("ESP32");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "projects"),
        where("ownerId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const projectList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      projectList.sort((a, b) => {
        const tA = a.updatedAt?.toMillis?.() || 0;
        const tB = b.updatedAt?.toMillis?.() || 0;
        return tB - tA;
      });
      setProjects(projectList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "projects"), {
        name: newName.trim(),
        board: newBoard,
        ownerId: user.uid,
        blockCount: 0,
        isPublic: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        blocksXml: "",
      });
      await updateDoc(doc(db, "users", user.uid), {
        projectCount: increment(1)
      });
      setShowNew(false);
      setNewName("");
      navigate(`/ide/${ref.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    
    const isConfirmed = await confirm("Delete this project? This cannot be undone.");
    if (!isConfirmed) return;
    
    await deleteDoc(doc(db, "projects", id));
    await updateDoc(doc(db, "users", user.uid), {
      projectCount: increment(-1)
    });
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const timeAgo = (ts: any) => {
    if (!ts) return "just now";
    const d = ts.toDate?.() ?? new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Top nav */}
      <nav className="glass-dark" style={{
        height: 64, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 40px",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE" }}>
            BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { label: "Projects", to: "/dashboard" },
              { label: "Marketplace", to: "/marketplace" },
              ...(!isBetaMode ? [{ label: "Pricing", to: "/pricing" }] : []),
            ].map((item) => (
              <Link key={item.label} to={item.to} className="btn-ghost" style={{
                color: item.to === "/dashboard" ? "#9D27DE" : undefined,
                background: item.to === "/dashboard" ? "rgba(157,39,222,0.1)" : undefined,
              }}>
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="btn-ghost" style={{ color: "#F59E0B", display: "flex", alignItems: "center", gap: 4 }}>
                <Shield size={14} /> Admin
              </Link>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }} className="hover:opacity-80 transition-opacity">
            {user?.photoURL ? (
              <img src={user.photoURL} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(157,39,222,0.5)", objectFit: "cover" }} alt="avatar" />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #9D27DE, #B94FF0)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "white",
              }}>
                {(user?.displayName || user?.email || "U")[0].toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 13, color: "rgba(242,242,240,0.7)", fontWeight: 500 }}>{user?.displayName || user?.email}</span>
          </Link>
          <button onClick={() => signOut()} className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px" }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 40px" }}>
        {/* Header Section */}
        <div style={{ 
          marginBottom: 40, 
          position: "relative",
          padding: "32px 40px",
          borderRadius: 20,
          border: "1px solid rgba(157,39,222,0.15)",
          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
          backdropFilter: "blur(10px)",
          overflow: "hidden"
        }}>
          {/* Decorative background glow */}
          <div style={{
            position: "absolute",
            top: -100, right: -50,
            width: 300, height: 300,
            background: "radial-gradient(circle, rgba(157,39,222,0.2) 0%, transparent 70%)",
            filter: "blur(40px)",
            pointerEvents: "none"
          }} />
          
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <FolderOpen size={28} color="#9D27DE" />
                <h1 style={{ fontSize: 32, fontWeight: 800, color: "#F2F2F0", margin: 0, letterSpacing: "-0.02em" }}>
                  My Projects
                </h1>
              </div>
              <p style={{ fontSize: 15, color: "rgba(242,242,240,0.5)", margin: 0, fontWeight: 500 }}>
                {projects.length} project{projects.length !== 1 ? "s" : ""} • Manage your firmware builds
              </p>
            </div>
            
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
               {projects.length > 0 && (
                <input
                  id="project-search"
                  type="text"
                  className="input"
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 240, background: "rgba(0,0,0,0.2)" }}
                />
              )}
              <button
                id="new-project-btn"
                onClick={() => setShowNew(true)}
                className="btn-primary"
                style={{ padding: "10px 24px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}
              >
                <Plus size={18} />
                New Project
              </button>
            </div>
          </div>
        </div>

        {/* New Project Modal */}
        {showNew && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={() => setShowNew(false)}>
            <div className="glass-dark" style={{
              borderRadius: 24, padding: 40, width: 460,
              animation: "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              border: "1px solid rgba(157,39,222,0.3)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset",
              position: "relative", overflow: "hidden"
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ position: "absolute", top: -50, left: -50, width: 200, height: 200, background: "radial-gradient(circle, rgba(157,39,222,0.2) 0%, transparent 70%)", filter: "blur(30px)", pointerEvents: "none" }} />
              
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F2F2F0", marginBottom: 8, position: "relative" }}>Create New Project</h2>
              <p style={{ fontSize: 14, color: "rgba(242,242,240,0.5)", marginBottom: 32, position: "relative" }}>Set up your workspace and choose a target board.</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.7)", display: "block", marginBottom: 8, fontWeight: 500 }}>Project Name</label>
                  <input
                    id="new-project-name"
                    type="text"
                    className="input"
                    placeholder="e.g. Smart Weather Station"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && createProject()}
                    style={{ fontSize: 15, padding: "12px 16px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.7)", display: "block", marginBottom: 8, fontWeight: 500 }}>Target Board</label>
                  <select
                    id="new-project-board"
                    className="input"
                    value={newBoard}
                    onChange={(e) => setNewBoard(e.target.value)}
                    style={{ cursor: "pointer", fontSize: 15, padding: "12px 16px" }}
                  >
                    {BOARDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button onClick={() => setShowNew(false)} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>Cancel</button>
                  <button
                    id="create-project-confirm"
                    onClick={createProject}
                    disabled={!newName.trim() || creating}
                    className="btn-primary"
                    style={{ flex: 1, justifyContent: "center", padding: "12px" }}
                  >
                    {creating ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: 180, borderRadius: 20,
                background: "rgba(42,10,61,0.4)", border: "1px solid rgba(157,39,222,0.1)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        ) : filtered.length === 0 && projects.length === 0 ? (
          /* Empty state */
          <div style={{ 
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
            padding: "80px 0", textAlign: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)",
            borderRadius: 24, border: "1px dashed rgba(157,39,222,0.2)"
          }}>
            <CassetteMascot size={160} mood="thinking" animate />
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F2F2F0", marginTop: 24 }}>No projects yet</h2>
            <p style={{ color: "rgba(242,242,240,0.5)", fontSize: 15, marginTop: 8, marginBottom: 32, maxWidth: 400, lineHeight: 1.6 }}>
              Create your first project to start building firmware visually with blocks.
            </p>
            <button onClick={() => setShowNew(true)} className="btn-primary" style={{ padding: "12px 28px", fontSize: 15 }}>
              Create First Project
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
            {filtered.map((p) => {
              const boardColor = BOARDS.find((b) => b.id === p.board)?.color || "#9D27DE";
              return (
                <Link
                  key={p.id}
                  to={`/ide/${p.id}`}
                  id={`project-card-${p.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div className="card" style={{ 
                    cursor: "pointer", 
                    padding: "24px", 
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minHeight: 180,
                    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.borderColor = `${boardColor}50`;
                    e.currentTarget.style.boxShadow = `0 12px 24px -10px ${boardColor}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.boxShadow = "none";
                  }}>
                    
                    {/* Header: Board Badge & Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "4px 12px", borderRadius: 999,
                        background: `${boardColor}15`,
                        border: `1px solid ${boardColor}30`,
                      }}>
                        <Cpu size={12} color={boardColor} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: boardColor, letterSpacing: "0.02em" }}>
                          {BOARDS.find((b) => b.id === p.board)?.name || p.board}
                        </span>
                      </div>
                      
                      <button
                        onClick={(e) => deleteProject(p.id, e)}
                        style={{
                          background: "transparent", border: "none", cursor: "pointer",
                          color: "rgba(242,242,240,0.3)", padding: 6, borderRadius: 8,
                          transition: "all 0.2s",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginTop: -4, marginRight: -4
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#ef4444";
                          e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "rgba(242,242,240,0.3)";
                          e.currentTarget.style.background = "transparent";
                        }}
                        title="Delete project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F2F2F0", marginBottom: "auto", lineHeight: 1.4 }}>
                      {p.name}
                    </h3>

                    {/* Footer Stats */}
                    <div style={{ 
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(242,242,240,0.45)" }}>
                        <Clock size={13} />
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{timeAgo(p.updatedAt)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(242,242,240,0.45)" }}>
                        <Layers size={13} />
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{p.blockCount || 0} blocks</span>
                      </div>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
