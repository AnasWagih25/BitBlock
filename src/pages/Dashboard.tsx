import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, deleteDoc, doc, updateDoc, increment
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
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
  const { user, signOut } = useAuth();
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
        height: 60, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 32px",
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
            ].map((item) => (
              <Link key={item.label} to={item.to} className="btn-ghost" style={{
                color: item.to === "/dashboard" ? "#9D27DE" : undefined,
                background: item.to === "/dashboard" ? "rgba(157,39,222,0.1)" : undefined,
              }}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            {user?.photoURL ? (
              <img src={user.photoURL} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(157,39,222,0.5)" }} alt="avatar" />
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
            <span style={{ fontSize: 13, color: "rgba(242,242,240,0.7)" }}>{user?.displayName || user?.email}</span>
          </Link>
          <button onClick={() => signOut()} className="btn-ghost" style={{ fontSize: 12 }}>Sign Out</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#F2F2F0" }}>
              My Projects
            </h1>
            <p style={{ fontSize: 14, color: "rgba(242,242,240,0.4)", marginTop: 4 }}>
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            id="new-project-btn"
            onClick={() => setShowNew(true)}
            className="btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </div>

        {/* Search */}
        {projects.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <input
              id="project-search"
              type="text"
              className="input"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>
        )}

        {/* New Project Modal */}
        {showNew && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={() => setShowNew(false)}>
            <div className="glass" style={{
              borderRadius: 20, padding: 36, width: 420,
              animation: "slide-up 0.25s ease",
            }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F2F2F0", marginBottom: 24 }}>New Project</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Project Name</label>
                  <input
                    id="new-project-name"
                    type="text"
                    className="input"
                    placeholder="My LED Blinker"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && createProject()}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "rgba(242,242,240,0.6)", display: "block", marginBottom: 6 }}>Target Board</label>
                    <select
                      id="new-project-board"
                      className="input"
                      value={newBoard}
                      onChange={(e) => setNewBoard(e.target.value)}
                      style={{ cursor: "pointer" }}
                    >
                      {BOARDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button onClick={() => setShowNew(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button
                    id="create-project-confirm"
                    onClick={createProject}
                    disabled={!newName.trim() || creating}
                    className="btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {creating ? "Creating..." : "Create →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                height: 160, borderRadius: 16,
                background: "rgba(42,10,61,0.4)", border: "1px solid rgba(157,39,222,0.1)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            ))}
          </div>
        ) : filtered.length === 0 && projects.length === 0 ? (
          /* Empty state */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 0", textAlign: "center" }}>
            <CassetteMascot size={160} mood="thinking" animate />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F2F2F0", marginTop: 24 }}>No projects yet</h2>
            <p style={{ color: "rgba(242,242,240,0.4)", fontSize: 14, marginTop: 8, marginBottom: 32 }}>
              Create your first project to start building firmware visually.
            </p>
            <button onClick={() => setShowNew(true)} className="btn-primary">
              Create First Project →
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/ide/${p.id}`}
                id={`project-card-${p.id}`}
                style={{ textDecoration: "none" }}
              >
                <div className="card" style={{ cursor: "pointer", padding: "20px", position: "relative" }}>
                  {/* Board badge */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "3px 10px", borderRadius: 6,
                    background: `${BOARDS.find((b) => b.id === p.board)?.color || "#9D27DE"}20`,
                    border: `1px solid ${BOARDS.find((b) => b.id === p.board)?.color || "#9D27DE"}40`,
                    marginBottom: 12,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: BOARDS.find((b) => b.id === p.board)?.color || "#9D27DE" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: BOARDS.find((b) => b.id === p.board)?.color || "#9D27DE" }}>
                      {BOARDS.find((b) => b.id === p.board)?.name || p.board}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", marginBottom: 8, lineHeight: 1.3 }}>
                    {p.name}
                  </h3>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "rgba(242,242,240,0.35)" }}>
                      {timeAgo(p.updatedAt)}
                    </span>
                    <span style={{ fontSize: 12, color: "rgba(242,242,240,0.35)" }}>
                      {p.blockCount || 0} blocks
                    </span>
                  </div>

                  {/* Delete btn */}
                  <button
                    onClick={(e) => deleteProject(p.id, e)}
                    style={{
                      position: "absolute", top: 14, right: 14,
                      background: "transparent", border: "none", cursor: "pointer",
                      color: "rgba(242,242,240,0.2)", padding: 4, borderRadius: 6,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.2)")}
                    title="Delete project"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6" /><path d="M19,6l-1,14H6L5,6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
