import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle2, Star, Search, Puzzle, Download, Trash2, Settings, ChevronRight } from "lucide-react";
import { collection, getDocs, query, orderBy, doc, setDoc, updateDoc, increment, deleteDoc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";
import CassetteMascot from "../components/ui/CassetteMascot";

const CATEGORIES = ["All", "GPIO", "Sensors", "Display", "Communication", "ML / AI", "Actuators", "Networking"];

const BOARD_COLORS: Record<string, string> = {
  "ESP32": "#E53E3E", "Arduino Uno": "#38A169", "Arduino Nano": "#38A169",
  "RP2040 Pico": "#3182CE", "STM32": "#D69E2E", "ESP8266": "#E53E3E",
};

export default function MarketplacePage() {
  const { user, signOut, isAdmin } = useAuth();
  const [viewTab, setViewTab] = useState<"discover" | "installed" | "published">("discover");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("downloads");
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Fetch marketplace blocks
  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        setLoading(true);
        const q = query(collection(db, "marketplace"), orderBy("downloads", "desc"));
        const snap = await getDocs(q);
        const fetchedBlocks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBlocks(fetchedBlocks);
      } catch (error) {
        console.error("Error fetching marketplace blocks:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBlocks();
  }, []);

  // Fetch user's installed blocks
  useEffect(() => {
    if (!user) return;
    const fetchInstalled = async () => {
      try {
        const snap = await getDocs(collection(db, "users", user.uid, "installedBlocks"));
        setInstalledIds(new Set(snap.docs.map(d => d.id)));
      } catch (err) {
        console.error("Failed to fetch installed blocks:", err);
      }
    };
    fetchInstalled();
  }, [user]);

  useEffect(() => {
    if (!user || blocks.length === 0) {
      setUserRatings({});
      return;
    }
    const fetchRatings = async () => {
      try {
        const entries: Array<readonly [string, number]> = [];
        for (const b of blocks) {
          try {
            const rSnap = await getDoc(doc(db, "marketplace", b.id, "ratings", user.uid));
            const value = rSnap.exists() ? Number((rSnap.data() as any).value || 0) : 0;
            entries.push([b.id, value] as const);
          } catch (readErr: any) {
            const msg = String(readErr?.message || "");
            if (msg.toLowerCase().includes("missing or insufficient permissions")) {
              continue;
            }
            throw readErr;
          }
        }
        setUserRatings(Object.fromEntries(entries.filter(([, v]) => v > 0)));
      } catch (err) {
        console.warn("Failed to fetch some user ratings:", err);
      }
    };
    fetchRatings();
  }, [user, blocks]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleInstall = async (block: any) => {
    if (!user) return;
    setInstallingId(block.id);
    try {
      const latestSnap = await getDoc(doc(db, "marketplace", block.id));
      const latest = latestSnap.exists() ? ({ id: latestSnap.id, ...latestSnap.data() } as any) : block;

      await setDoc(doc(db, "users", user.uid, "installedBlocks", block.id), {
        blockId: block.id,
        name: latest.name || block.name,
        category: latest.category || block.category,
        blocksXml: latest.blocksXml || latest.projectBlocksXml || "",
        projectBlocksXml: latest.projectBlocksXml || "",
        blockJSON: latest.blockJSON || latest.blockJson || "",
        generatorCode: latest.generatorCode || latest.generator || "",
        installedAt: new Date(),
      }, { merge: true });

      await updateDoc(doc(db, "marketplace", block.id), { downloads: increment(1) });

      setInstalledIds(prev => new Set([...prev, block.id]));
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, ...(latest || {}), downloads: (b.downloads || 0) + 1 } : b));
      const hasWorkspaceImport = Boolean(latest.blocksXml || latest.projectBlocksXml);
      showToast(
        hasWorkspaceImport
          ? `✓ "${latest.name || block.name}" installed! Use "Import Installed Items" in IDE.`
          : `✓ "${latest.name || block.name}" installed, but missing workspace data.`
      );
    } catch (err: any) {
      console.error("Install failed:", err);
      showToast(`✗ Install failed: ${err?.message || "Unknown error"}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstall = async (block: any) => {
    if (!user) return;
    setInstallingId(block.id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "installedBlocks", block.id));
      setInstalledIds(prev => { const next = new Set(prev); next.delete(block.id); return next; });
      showToast(`"${block.name}" uninstalled.`);
    } catch (err: any) {
      console.error("Uninstall failed:", err);
      showToast(`✗ Uninstall failed: ${err?.message || "Unknown error"}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleDeletePublished = async (block: any) => {
    if (!user || block.authorId !== user.uid) return;
    if (!window.confirm(`Delete "${block.name}" from marketplace?`)) return;
    setDeletingId(block.id);
    try {
      await deleteDoc(doc(db, "marketplace", block.id));
      setBlocks((prev) => prev.filter((b) => b.id !== block.id));
      setInstalledIds((prev) => {
        const next = new Set(prev);
        next.delete(block.id);
        return next;
      });
      showToast(`"${block.name}" deleted from marketplace.`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      showToast(`✗ Delete failed: ${err?.message || "Unknown error"}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRate = async (block: any, value: number) => {
    if (!user) return;
    setRatingId(block.id);
    try {
      const blockRef = doc(db, "marketplace", block.id);
      const ratingRef = doc(db, "marketplace", block.id, "ratings", user.uid);
      await runTransaction(db, async (tx) => {
        const blockSnap = await tx.get(blockRef);
        if (!blockSnap.exists()) throw new Error("Marketplace item no longer exists.");
        const ratingSnap = await tx.get(ratingRef);
        const prev = ratingSnap.exists() ? Number((ratingSnap.data() as any).value || 0) : 0;
        const current = blockSnap.data() as any;
        const nextSum = Number(current.ratingSum || 0) - prev + value;
        const nextCount = Number(current.ratingCount || 0) + (prev > 0 ? 0 : 1);
        const nextAvg = nextCount > 0 ? Number((nextSum / nextCount).toFixed(2)) : 0;

        tx.set(ratingRef, { userId: user.uid, value, updatedAt: new Date() }, { merge: true });
        tx.update(blockRef, { rating: nextAvg, ratingSum: nextSum, ratingCount: nextCount });
      });

      setUserRatings((prev) => ({ ...prev, [block.id]: value }));
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== block.id) return b;
          const prevMine = userRatings[b.id] || 0;
          const nextSum = Number(b.ratingSum || 0) - prevMine + value;
          const nextCount = Number(b.ratingCount || 0) + (prevMine > 0 ? 0 : 1);
          const nextAvg = nextCount > 0 ? Number((nextSum / nextCount).toFixed(2)) : 0;
          return { ...b, rating: nextAvg, ratingSum: nextSum, ratingCount: nextCount };
        }),
      );
      showToast(`Rated "${block.name}" ${value}/5`);
    } catch (err: any) {
      console.error("Rating failed:", err);
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("missing or insufficient permissions")) {
        showToast("✗ Rating blocked by rules. Try again later.");
      } else {
        showToast(`✗ Rating failed: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setRatingId(null);
    }
  };

  const handleRepairSnapshot = async (block: any) => {
    if (!user || block.authorId !== user.uid) return;
    if (!block.projectId) {
      showToast("✗ Cannot repair snapshot: missing source project reference.");
      return;
    }
    setRepairingId(block.id);
    try {
      const projectSnap = await getDoc(doc(db, "projects", block.projectId));
      if (!projectSnap.exists()) {
        showToast("✗ Cannot repair snapshot: source project not found.");
        return;
      }
      const projectData = projectSnap.data() as any;
      const xml = typeof projectData.blocksXml === "string" ? projectData.blocksXml : "";
      if (!xml.trim()) {
        showToast("✗ Cannot repair snapshot: source project has no blocks XML.");
        return;
      }
      await updateDoc(doc(db, "marketplace", block.id), { blocksXml: xml });
      setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, blocksXml: xml } : b)));
      showToast(`✓ Snapshot repaired for "${block.name}".`);
    } catch (err: any) {
      console.error("Snapshot repair failed:", err);
      showToast(`✗ Snapshot repair failed: ${err?.message || "Unknown error"}`);
    } finally {
      setRepairingId(null);
    }
  };

  const filtered = blocks
    .filter((b) => category === "All" || b.category === category)
    .filter((b) => (b.name || "").toLowerCase().includes(search.toLowerCase()) || (b.desc || b.description || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "downloads" ? (b.downloads || 0) - (a.downloads || 0) : sort === "rating" ? (b.rating || 0) - (a.rating || 0) : 0);
  const installedBlocks = blocks.filter((b) => installedIds.has(b.id));
  const publishedBlocks = user ? blocks.filter((b) => b.authorId === user.uid) : [];
  const visibleBlocks = viewTab === "installed" ? installedBlocks : viewTab === "published" ? publishedBlocks : filtered;

  const renderRating = (block: any) => {
    const mine = userRatings[block.id] || 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => handleRate(block, n)}
            disabled={!user || ratingId === block.id}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", opacity: !user || ratingId === block.id ? 0.5 : 1 }}
            title={`Rate ${n} stars`}
          >
            <Star size={16} color={n <= mine ? "#F59E0B" : "rgba(242,242,240,0.2)"} fill={n <= mine ? "#F59E0B" : "transparent"} />
          </button>
        ))}
      </div>
    );
  };

  const renderBlockCard = (block: any) => {
    const isInstalled = installedIds.has(block.id);
    const isProcessing = installingId === block.id;
    const isMine = !!user && block.authorId === user.uid;
    const hasImportPayload = Boolean(block.blocksXml || block.projectBlocksXml);
    return (
      <div key={block.id} className="card" style={{ 
        padding: 24, cursor: "default", display: "flex", flexDirection: "column", height: "100%",
        border: "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative", overflow: "hidden"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = "rgba(157,39,222,0.3)";
        e.currentTarget.style.boxShadow = "0 12px 24px -10px rgba(157,39,222,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
        e.currentTarget.style.boxShadow = "none";
      }}>
        
        {/* Subtle background glow on hover */}
        <div style={{ position: "absolute", top: -50, right: -50, width: 150, height: 150, background: "radial-gradient(circle, rgba(157,39,222,0.1) 0%, transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />

        {/* Header: Category & Rating */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ 
              fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, 
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(242,242,240,0.8)"
            }}>
              {block.category}
            </span>
            {block.verified && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#22C55E" }}>
                <CheckCircle2 size={13} /> Verified
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.1)", padding: "4px 8px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.2)" }}>
            <Star size={13} color="#F59E0B" fill="#F59E0B" />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FDE68A" }}>{Number(block.rating || 0).toFixed(1)}</span>
            <span style={{ fontSize: 11, color: "rgba(245,158,11,0.6)" }}>({block.ratingCount || 0})</span>
          </div>
        </div>

        {/* Content */}
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#F2F2F0", marginBottom: 6, lineHeight: 1.3 }}>{block.name}</h3>
        
        {block.functionality && (
          <p style={{ fontSize: 12, fontWeight: 600, color: "#B94FF0", marginBottom: 12 }}>
            <span style={{ opacity: 0.6, fontWeight: 500 }}>Func:</span> {block.functionality}
          </p>
        )}
        
        <p style={{ fontSize: 13, color: "rgba(242,242,240,0.5)", lineHeight: 1.6, marginBottom: 16, flex: 1 }}>
          {block.desc || block.description}
        </p>

        {/* Boards */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {(block.boards || []).map((b: string) => (
            <span key={b} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
              background: `${BOARD_COLORS[b] || "#9D27DE"}15`,
              color: BOARD_COLORS[b] || "#9D27DE",
              border: `1px solid ${BOARD_COLORS[b] || "#9D27DE"}30`,
            }}>{b}</span>
          ))}
        </div>

        {/* Footer Area */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16, marginTop: "auto" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", marginBottom: 4 }}>Your Rating</div>
              {renderRating(block)}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", marginBottom: 2 }}>Installs</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F2F2F0" }}>{(block.downloads || 0).toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "rgba(242,242,240,0.4)" }}>
              by <strong style={{ color: "#F2F2F0" }}>{block.author || "Unknown"}</strong>
            </span>
            
            <div style={{ display: "flex", gap: 8 }}>
              {isMine && (
                <>
                  {!hasImportPayload && (
                    <button
                      className="btn-ghost"
                      disabled={repairingId === block.id}
                      onClick={() => handleRepairSnapshot(block)}
                      style={{ padding: "6px 10px", fontSize: 12 }}
                      title="Repair Snapshot"
                    >
                      <Settings size={14} />
                    </button>
                  )}
                  <button
                    className="btn-ghost"
                    disabled={deletingId === block.id}
                    onClick={() => handleDeletePublished(block)}
                    style={{ padding: "6px 10px", fontSize: 12, color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                    title="Delete Block"
                  >
                    {deletingId === block.id ? "..." : <Trash2 size={14} />}
                  </button>
                </>
              )}
              
              {isInstalled ? (
                <button
                  className="btn-secondary"
                  disabled={isProcessing}
                  style={{ padding: "8px 16px", fontSize: 12, opacity: isProcessing ? 0.7 : 1 }}
                  onClick={() => handleUninstall(block)}
                >
                  {isProcessing ? "Uninstalling..." : "Uninstall"}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={isProcessing}
                  style={{ padding: "8px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: isProcessing ? 0.7 : 1 }}
                  onClick={() => handleInstall(block)}
                >
                  <Download size={14} /> {isProcessing ? "Installing..." : "Install"}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", fontFamily: "Space Grotesk, sans-serif" }}>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 80, right: 32, zIndex: 200,
          background: "rgba(20,5,30,0.9)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(157,39,222,0.4)", borderRadius: 12,
          padding: "14px 24px", color: "#F2F2F0", fontSize: 14, fontWeight: 500,
          boxShadow: "0 12px 32px rgba(157,39,222,0.2)", animation: "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <nav className="glass-dark" style={{
        height: 64, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 40px",
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
            {[
              { label: "Projects", to: "/dashboard" },
              { label: "Marketplace", to: "/marketplace" },
              { label: "Pricing", to: "/pricing" },
            ].map((item) => (
              <Link key={item.label} to={item.to} className="btn-ghost" style={{
                color: item.to === "/marketplace" ? "#9D27DE" : undefined,
                background: item.to === "/marketplace" ? "rgba(157,39,222,0.1)" : undefined,
              }}>
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="btn-ghost" style={{ color: "#F59E0B" }}>
                Admin
              </Link>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }} className="hover:opacity-80 transition-opacity">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(157,39,222,0.5)", objectFit: "cover" }}
                alt="avatar"
              />
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

      {/* Hero */}
      <div style={{
        padding: "60px 40px", borderBottom: "1px solid rgba(157,39,222,0.1)",
        position: "relative", overflow: "hidden",
        background: "linear-gradient(180deg, rgba(157,39,222,0.05) 0%, transparent 100%)"
      }}>
        <div style={{
          position: "absolute", top: -50, right: "10%", width: 500, height: 500,
          background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(157,39,222,0.1)", border: "1px solid rgba(157,39,222,0.2)", color: "#B94FF0", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>
              <Puzzle size={14} /> Community Marketplace
            </div>
            <h1 style={{ fontFamily: "Superstar, fantasy", fontSize: 48, color: "#F2F2F0", letterSpacing: "0.02em", marginBottom: 12, lineHeight: 1.1 }}>
              DISCOVER BLOCKS
            </h1>
            <p style={{ fontSize: 16, color: "rgba(242,242,240,0.6)", margin: 0, lineHeight: 1.6 }}>
              Extend BitBlock with powerful community-built components. Find sensors, actuators, and ML blocks, and install them with one click.
            </p>
          </div>

          {/* Search Bar - Moved to right side of hero */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={18} color="rgba(242,242,240,0.4)" style={{ position: "absolute", left: 16 }} />
              <input
                id="marketplace-search"
                type="text"
                className="input"
                placeholder="Search blocks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 280, paddingLeft: 44, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, border: "none", background: "rgba(255,255,255,0.03)" }}
              />
            </div>
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ width: 160, cursor: "pointer", paddingTop: 12, paddingBottom: 12, fontSize: 14, border: "none", background: "rgba(255,255,255,0.03)" }}
            >
              <option value="downloads">Most Downloaded</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px", display: "flex", gap: 40 }}>
        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ position: "sticky", top: 100 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(242,242,240,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>Views</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 32 }}>
              {[
                { id: "discover", label: "Discover" },
                { id: "installed", label: `Installed (${installedBlocks.length})` },
                { id: "published", label: `Published (${publishedBlocks.length})` },
              ].map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setViewTab(v.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: viewTab === v.id ? "linear-gradient(90deg, rgba(157,39,222,0.15), rgba(157,39,222,0.05))" : "transparent",
                    border: "none", borderRadius: 8,
                    color: viewTab === v.id ? "#E9D5FF" : "rgba(242,242,240,0.6)",
                    cursor: "pointer", fontSize: 14, fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: viewTab === v.id ? 600 : 500,
                    borderLeft: viewTab === v.id ? "3px solid #9D27DE" : "3px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (viewTab !== v.id) {
                      e.currentTarget.style.color = "#F2F2F0";
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewTab !== v.id) {
                      e.currentTarget.style.color = "rgba(242,242,240,0.6)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {v.label}
                  {viewTab === v.id && <ChevronRight size={14} color="#B94FF0" />}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(242,242,240,0.4)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 16 }}>Categories</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  id={`cat-${cat.toLowerCase().replace(/[\s/]/g, "-")}`}
                  onClick={() => setCategory(cat)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", textAlign: "left", padding: "10px 14px",
                    background: category === cat ? "linear-gradient(90deg, rgba(157,39,222,0.15), rgba(157,39,222,0.05))" : "transparent",
                    border: "none", borderRadius: 8,
                    color: category === cat ? "#E9D5FF" : "rgba(242,242,240,0.6)",
                    cursor: "pointer", fontSize: 14, fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: category === cat ? 600 : 500,
                    borderLeft: category === cat ? "3px solid #9D27DE" : "3px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (category !== cat) {
                      e.currentTarget.style.color = "#F2F2F0";
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (category !== cat) {
                      e.currentTarget.style.color = "rgba(242,242,240,0.6)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {cat}
                  {category === cat && <ChevronRight size={14} color="#B94FF0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid Area */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#F2F2F0", margin: 0 }}>
              {viewTab === "installed" ? "Installed Blocks" : viewTab === "published" ? "Published Blocks" : `${category === "All" ? "All" : category} Blocks`}
            </h2>
            <p style={{ fontSize: 14, color: "rgba(242,242,240,0.5)", margin: 0, fontWeight: 500 }}>
              Showing {visibleBlocks.length} item{visibleBlocks.length !== 1 ? "s" : ""}
            </p>
          </div>
          
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  height: 280, borderRadius: 20,
                  background: "rgba(42,10,61,0.4)", border: "1px solid rgba(157,39,222,0.1)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              ))}
            </div>
          ) : visibleBlocks.length === 0 ? (
            <div style={{ 
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
              padding: "100px 0", textAlign: "center",
              background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)",
              borderRadius: 24, border: "1px dashed rgba(157,39,222,0.2)"
            }}>
              <CassetteMascot size={140} mood="thinking" animate />
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#F2F2F0", marginTop: 24 }}>
                {viewTab === "discover" ? "No blocks found" : "No items here"}
              </h2>
              <p style={{ color: "rgba(242,242,240,0.5)", fontSize: 15, marginTop: 8, maxWidth: 350, lineHeight: 1.6 }}>
                {viewTab === "discover"
                  ? "Try adjusting your search or category filters to find what you're looking for."
                  : viewTab === "installed"
                    ? "Install blocks from the Discover tab to see them here."
                    : "You haven't published any blocks to the community marketplace yet."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
              {visibleBlocks.map((block) => renderBlockCard(block))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
