import React, { useState, useMemo, useCallback } from "react";
import { Layout, RefreshCw, Cpu, Clock, Radar, Lightbulb, Settings, Wifi, HardDrive, MapPin, Network, Volume2, Sliders, Battery, BrainCircuit, Terminal, Code } from "lucide-react";
import { HELP_SECTIONS } from "./QuickHelpData";
import type { HelpSection, HelpBlock } from "./QuickHelpData";

/* ── Markdown & Highlight helper ──────────────────────── */
function renderText(text: string, query: string): React.ReactNode {
  // First, parse bold markdown **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const innerText = part.slice(2, -2);
      return <strong key={index} style={{ color: "#fff", fontWeight: 600 }}>{highlightText(innerText, query)}</strong>;
    }
    return <React.Fragment key={index}>{highlightText(part, query)}</React.Fragment>;
  });
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((p, i) =>
    regex.test(p) ? (
      <mark key={i} style={{ background: "#9D27DE", color: "#fff", borderRadius: 2, padding: "0 2px" }}>{p}</mark>
    ) : p
  );
}

/* ── Icon mapping ─────────────────────────────────────── */
const ICON_MAP: Record<string, React.ReactNode> = {
  "Layout": <Layout size={16} />,
  "RefreshCw": <RefreshCw size={16} />,
  "Cpu": <Cpu size={16} />,
  "Clock": <Clock size={16} />,
  "Radar": <Radar size={16} />,
  "Lightbulb": <Lightbulb size={16} />,
  "Settings": <Settings size={16} />,
  "Wifi": <Wifi size={16} />,
  "HardDrive": <HardDrive size={16} />,
  "MapPin": <MapPin size={16} />,
  "Network": <Network size={16} />,
  "Volume2": <Volume2 size={16} />,
  "Sliders": <Sliders size={16} />,
  "Battery": <Battery size={16} />,
  "BrainCircuit": <BrainCircuit size={16} />,
  "Terminal": <Terminal size={16} />,
  "Code": <Code size={16} />
};

/* ── Block illustration ───────────────────────────────── */
function BlockIllustration({ block, query }: { block: HelpBlock; query: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)", border: `1px solid ${block.color}40`,
      borderRadius: 8, padding: "10px 12px", marginBottom: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {/* Block shape */}
        <div style={{
          background: block.color, borderRadius: block.output ? 12 : 4,
          padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#fff",
          fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap",
          boxShadow: `0 1px 4px ${block.color}60`,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {block.output && <span style={{ fontSize: 8 }}>◆</span>}
          {highlightText(block.label, query)}
        </div>
        {block.output && (
          <span style={{ fontSize: 9, color: "rgba(242,242,240,0.4)", fontStyle: "italic" }}>
            → {block.output}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "rgba(242,242,240,0.6)", margin: 0, lineHeight: 1.5 }}>
        {renderText(block.desc, query)}
      </p>
      {block.inputs && (
        <div style={{ marginTop: 4, fontSize: 10, color: "rgba(242,242,240,0.35)" }}>
          Inputs: {renderText(block.inputs, query)}
        </div>
      )}
    </div>
  );
}

/* ── Section renderer ─────────────────────────────────── */
function SectionView({ section, query, expanded, onToggle }: {
  section: HelpSection; query: string; expanded: boolean; onToggle: () => void;
}) {
  const matchedBlocks = useMemo(() => {
    if (!query || query.length < 2) return section.blocks || [];
    const q = query.toLowerCase();
    return (section.blocks || []).filter(b =>
      b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) || (b.inputs || "").toLowerCase().includes(q)
    );
  }, [section, query]);

  const contentMatches = useMemo(() => {
    if (!query || query.length < 2) return true;
    const q = query.toLowerCase();
    return (section.content || "").toLowerCase().includes(q) ||
      section.title.toLowerCase().includes(q) ||
      section.intro.toLowerCase().includes(q);
  }, [section, query]);

  const hasResults = query.length >= 2 ? (matchedBlocks.length > 0 || contentMatches) : true;
  if (!hasResults) return null;

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          background: expanded ? "rgba(157,39,222,0.08)" : "transparent",
          border: "none", padding: "8px 12px", borderRadius: 6,
          cursor: "pointer", textAlign: "left", transition: "0.15s",
        }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.background = "rgba(157,39,222,0.05)"; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, color: section.color || "rgba(242,242,240,0.7)" }}>
          {ICON_MAP[section.icon] || <Settings size={16} />}
        </span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#F2F2F0" }}>
          {renderText(section.title, query)}
        </span>
        {query.length >= 2 && matchedBlocks.length > 0 && (
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 8,
            background: "rgba(157,39,222,0.2)", color: "#B94FF0", fontWeight: 700,
          }}>
            {matchedBlocks.length}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(242,242,240,0.4)" strokeWidth="2"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "0.2s" }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: "4px 12px 8px 34px", animation: "fade-in 0.15s ease" }}>
          <p style={{ fontSize: 11, color: "rgba(242,242,240,0.45)", lineHeight: 1.6, margin: "0 0 8px" }}>
            {renderText(section.intro, query)}
          </p>
          {section.content && (
            <div style={{
              fontSize: 11, color: "rgba(242,242,240,0.55)", lineHeight: 1.7,
              whiteSpace: "pre-wrap", marginBottom: 8,
            }}>
              {section.content.split("\n").map((line, i) => (
                <div key={i} style={{
                  marginBottom: line.startsWith("•") ? 2 : 4,
                  paddingLeft: line.startsWith("•") ? 8 : 0,
                }}>
                  {renderText(line, query)}
                </div>
              ))}
            </div>
          )}
          {(query.length >= 2 ? matchedBlocks : (section.blocks || [])).map((b) => (
            <BlockIllustration key={b.type} block={b} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main QuickHelpPanel ──────────────────────────────── */
export default function QuickHelpPanel() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const totalResults = useMemo(() => {
    if (search.length < 2) return -1;
    const q = search.toLowerCase();
    let count = 0;
    for (const s of HELP_SECTIONS) {
      if (s.title.toLowerCase().includes(q) || s.intro.toLowerCase().includes(q) ||
          (s.content || "").toLowerCase().includes(q)) count++;
      for (const b of s.blocks || []) {
        if (b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) ||
            b.type.toLowerCase().includes(q) || (b.inputs || "").toLowerCase().includes(q)) count++;
      }
    }
    return count;
  }, [search]);

  // Auto-expand matching sections during search
  const expandedState = useMemo(() => {
    if (search.length < 2) return expanded;
    const auto: Record<string, boolean> = {};
    const q = search.toLowerCase();
    for (const s of HELP_SECTIONS) {
      const hasMatch = s.title.toLowerCase().includes(q) || s.intro.toLowerCase().includes(q) ||
        (s.content || "").toLowerCase().includes(q) ||
        (s.blocks || []).some(b =>
          b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q) || (b.inputs || "").toLowerCase().includes(q)
        );
      if (hasMatch) auto[s.id] = true;
    }
    return auto;
  }, [search, expanded]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Search bar */}
      <div style={{ padding: "0 12px 8px", position: "relative" }}>
        <div style={{ position: "relative" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(242,242,240,0.35)" strokeWidth="2"
            style={{ position: "absolute", left: 8, top: 8, pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search blocks, features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(0,0,0,0.3)", border: "1px solid rgba(157,39,222,0.15)",
              borderRadius: 6, padding: "6px 8px 6px 28px", fontSize: 11,
              color: "#F2F2F0", outline: "none", fontFamily: "Space Grotesk, sans-serif",
            }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(157,39,222,0.4)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(157,39,222,0.15)"; }}
          />
          {search.length > 0 && (
            <button onClick={() => setSearch("")} style={{
              position: "absolute", right: 4, top: 4, background: "none", border: "none",
              color: "rgba(242,242,240,0.4)", cursor: "pointer", padding: "2px 4px", fontSize: 12,
            }}>✕</button>
          )}
        </div>
        {totalResults >= 0 && (
          <div style={{
            fontSize: 10, color: totalResults > 0 ? "#B94FF0" : "rgba(242,242,240,0.35)",
            marginTop: 4, fontWeight: 600,
          }}>
            {totalResults > 0 ? `${totalResults} result${totalResults !== 1 ? "s" : ""} found` : "No results found"}
          </div>
        )}
      </div>

      {/* Sections list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 4px" }}>
        {HELP_SECTIONS.map((s) => (
          <SectionView
            key={s.id}
            section={s}
            query={search}
            expanded={expandedState[s.id] || false}
            onToggle={() => toggle(s.id)}
          />
        ))}
        {totalResults === 0 && (
          <div style={{ textAlign: "center", padding: "24px 12px", color: "rgba(242,242,240,0.3)", fontSize: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            No matches for "{search}"
          </div>
        )}
      </div>
    </div>
  );
}
