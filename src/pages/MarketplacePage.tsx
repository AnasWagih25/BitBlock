import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle2, Star, Search, Puzzle } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import CassetteMascot from "../components/ui/CassetteMascot";

const CATEGORIES = ["All", "GPIO", "Sensors", "Display", "Communication", "ML / AI", "Actuators", "Networking"];

const BOARD_COLORS: Record<string, string> = {
  "ESP32": "#E53E3E", "Arduino Uno": "#38A169", "Arduino Nano": "#38A169",
  "RP2040 Pico": "#3182CE", "STM32": "#D69E2E", "ESP8266": "#E53E3E",
};

export default function MarketplacePage() {
  const { user, signOut } = useAuth();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("downloads");
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filtered = blocks
    .filter((b) => category === "All" || b.category === category)
    .filter((b) => (b.name || "").toLowerCase().includes(search.toLowerCase()) || (b.desc || b.description || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "downloads" ? (b.downloads || 0) - (a.downloads || 0) : sort === "rating" ? (b.rating || 0) - (a.rating || 0) : 0);

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
            <Link to="/marketplace" className="btn-ghost" style={{ color: "#9D27DE", background: "rgba(157,39,222,0.1)" }}>Marketplace</Link>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/profile" className="btn-ghost" style={{ fontSize: 12 }}>
            {user?.displayName || user?.email}
          </Link>
          <button onClick={() => signOut()} className="btn-ghost" style={{ fontSize: 12 }}>Sign Out</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="dot-bg" style={{
        padding: "60px 40px 40px", borderBottom: "1px solid rgba(157,39,222,0.1)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, right: 0, width: 400, height: 300,
          background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />
        <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
          <div className="badge badge-purple" style={{ marginBottom: 16 }}>
            <Puzzle size={12} /> Community Marketplace
          </div>
          <h1 style={{ fontFamily: "Superstar, fantasy", fontSize: "clamp(28px,4vw,48px)", color: "#F2F2F0", letterSpacing: "0.05em", marginBottom: 12 }}>
            DISCOVER BLOCKS
          </h1>
          <p style={{ fontSize: 16, color: "rgba(242,242,240,0.5)", marginBottom: 32, maxWidth: 520 }}>
            Extend BitBlock with community-built custom blocks. Install with one click.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={16} color="rgba(242,242,240,0.4)" style={{ position: "absolute", left: 12 }} />
              <input
                id="marketplace-search"
                type="text"
                className="input"
                placeholder="Search blocks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 320, paddingLeft: 36 }}
              />
            </div>
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ maxWidth: 180, cursor: "pointer" }}
            >
              <option value="downloads">Most Downloaded</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px", display: "flex", gap: 32 }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: "rgba(242,242,240,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Categories</p>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              id={`cat-${cat.toLowerCase().replace(/[\s/]/g, "-")}`}
              onClick={() => setCategory(cat)}
              style={{
                width: "100%", textAlign: "left", padding: "8px 12px",
                background: category === cat ? "rgba(157,39,222,0.15)" : "transparent",
                border: "none", borderRadius: 8,
                color: category === cat ? "#9D27DE" : "rgba(242,242,240,0.5)",
                cursor: "pointer", fontSize: 13, fontFamily: "Space Grotesk, sans-serif",
                fontWeight: category === cat ? 600 : 400,
                borderLeft: category === cat ? "2px solid #9D27DE" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: "rgba(242,242,240,0.4)", marginBottom: 20 }}>
            {filtered.length} block{filtered.length !== 1 ? "s" : ""} found
          </p>
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{
                  height: 180, borderRadius: 16,
                  background: "rgba(42,10,61,0.4)", border: "1px solid rgba(157,39,222,0.1)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              ))}
            </div>
          ) : filtered.length === 0 && blocks.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", textAlign: "center" }}>
              <CassetteMascot size={120} mood="thinking" animate />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F2F2F0", marginTop: 24 }}>Marketplace Empty</h2>
              <p style={{ color: "rgba(242,242,240,0.4)", fontSize: 14, marginTop: 8, maxWidth: 300 }}>
                No blocks have been published to the community marketplace yet. Be the first!
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {filtered.map((block) => (
                <div key={block.id} className="card" style={{ padding: 20, cursor: "default" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <span className="tag">{block.category}</span>
                      {block.verified && (
                        <span className="badge badge-success" style={{ marginLeft: 6 }}>
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <span style={{ fontSize: 12, color: "#F2F2F0" }}>{block.rating || 0}</span>
                    </div>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F2F2F0", marginBottom: 8, lineHeight: 1.3 }}>{block.name}</h3>
                  <p style={{ fontSize: 12, color: "rgba(242,242,240,0.5)", lineHeight: 1.6, marginBottom: 12 }}>{block.desc || block.description}</p>

                  {/* Board compatibility */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {(block.boards || []).map((b: string) => (
                      <span key={b} style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: `${BOARD_COLORS[b] || "#9D27DE"}15`,
                        color: BOARD_COLORS[b] || "#9D27DE",
                        border: `1px solid ${BOARD_COLORS[b] || "#9D27DE"}30`,
                      }}>{b}</span>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "rgba(242,242,240,0.3)" }}>
                      by <span style={{ color: "#9D27DE" }}>{block.author || "Unknown"}</span> · {(block.downloads || 0).toLocaleString()} installs
                    </span>
                    <button
                      id={`install-block-${block.id}`}
                      className="btn-primary"
                      style={{ padding: "5px 14px", fontSize: 11 }}
                      onClick={() => alert(`Installing "${block.name}"... (Marketplace backend coming soon!)`)}
                    >
                      Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
