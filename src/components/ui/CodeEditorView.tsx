import { useState, useRef, useCallback } from "react";
import {
  getLibrariesForBoard,
  getAllCategories,
  parseCommunityLibraryUrl,
  type ArduinoLibrary,
  type LibraryCategory,
} from "../../data/arduinoLibraries";
import { getBoardConfig } from "../../boards/registry";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CodeEditorViewProps {
  code: string;
  onChange: (code: string) => void;
  boardId: string;
  projectName: string;
  // Sync
  syncEnabled: boolean;
  onToggleSync: () => void;
  syncedCode: string; // code from blockly
  codeOverridesBlocks: boolean;
  onResetToBlocks: () => void;
  // Actions
  onCompile: () => void;
  onFlash: () => void;
  compiling: boolean;
  compileStatus: "idle" | "compiling" | "success" | "error";
  compileMessage: string;
  compileProgress: number;
  firmwareReady: boolean;
  canCompile: boolean;
  compileBlockReason?: string;
}

// ── Syntax Highlighter ────────────────────────────────────────────────────────

function highlightCpp(code: string): string {
  let h = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Order matters — process from most specific to least
  h = h.replace(
    /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(#\w+[^\n]*)|(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*')|(\b(?:void|int|float|double|bool|char|byte|long|short|unsigned|signed|const|static|return|if|else|for|while|do|break|continue|switch|case|default|class|struct|public|private|protected|new|delete|nullptr|true|false|sizeof|typedef|enum|inline|volatile|extern|auto|register|goto|throw|try|catch|this|template|typename|namespace|using|operator|virtual|override|final)(?=\W|$))|(\b(?:Serial|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|millis|micros|delayMicroseconds|map|constrain|random|min|max|abs|sqrt|pow|setup|loop|Wire|SPI|begin|end|print|println|write|read|available|flush)(?=\W|$))|(\b\d+(?:\.\d+)?(?:f|L|UL|u|U)?\b)|(\b(?:HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|INPUT_PULLDOWN|LED_BUILTIN|true|false|NULL|A0|A1|A2|A3|A4|A5|A6|A7|D0|D1|D2|D3|D4|D5|D6|D7|D8|D9|D10|D11|D12|D13)(?=\W|$))/g,
    (_, cmt, cmt2, prep, str, kw1, kw2, num, macro) => {
      if (cmt) return `<span class="hl-comment">${cmt}</span>`;
      if (cmt2) return `<span class="hl-comment">${cmt2}</span>`;
      if (prep) return `<span class="hl-preprocessor">${prep}</span>`;
      if (str) return `<span class="hl-string">${str}</span>`;
      if (kw1) return `<span class="hl-keyword">${kw1}</span>`;
      if (kw2) return `<span class="hl-builtin">${kw2}</span>`;
      if (num) return `<span class="hl-number">${num}</span>`;
      if (macro) return `<span class="hl-macro">${macro}</span>`;
      return _;
    }
  );
  return h;
}

// ── Line Number Component ─────────────────────────────────────────────────────

function LineNumbers({ code, scrollTop }: { code: string; scrollTop: number }) {
  const count = (code.match(/\n/g) || []).length + 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 48,
        paddingTop: 14,
        paddingBottom: 14,
        paddingRight: 8,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 12,
        lineHeight: "20px",
        color: "rgba(157,39,222,0.4)",
        textAlign: "right",
        userSelect: "none",
        pointerEvents: "none",
        transform: `translateY(-${scrollTop}px)`,
        background: "transparent",
        zIndex: 2,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

// ── Library Manager ───────────────────────────────────────────────────────────

function LibraryManager({
  boardId,
  onInsert,
  onClose,
}: {
  boardId: string;
  onInsert: (lib: ArduinoLibrary) => void;
  onClose: () => void;
}) {
  const board = getBoardConfig(boardId);
  const compatible = getLibrariesForBoard(board.platform, !!board.isAVR);
  const allCats = getAllCategories();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<LibraryCategory | "All">("All");
  const [githubUrl, setGithubUrl] = useState("");
  const [customLibs, setCustomLibs] = useState<ArduinoLibrary[]>([]);
  const [githubError, setGithubError] = useState("");
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"browse" | "community">("browse");

  const filtered = [...compatible, ...customLibs].filter((lib) => {
    const matchesSearch =
      !search ||
      lib.name.toLowerCase().includes(search.toLowerCase()) ||
      lib.description.toLowerCase().includes(search.toLowerCase()) ||
      lib.include.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === "All" || lib.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleAddGithub = () => {
    setGithubError("");
    const meta = parseCommunityLibraryUrl(githubUrl);
    if (!meta) {
      setGithubError("Invalid GitHub URL. Use: https://github.com/user/repo");
      return;
    }
    if (customLibs.find((l) => l.id === meta.id)) {
      setGithubError("Library already added.");
      return;
    }
    setCustomLibs((prev) => [...prev, { ...meta, boards: ["all"] }]);
    setGithubUrl("");
    setTab("browse");
    setActiveCategory("Community");
  };

  const handleInsert = (lib: ArduinoLibrary) => {
    setInstalledIds((prev) => new Set([...prev, lib.id]));
    onInsert(lib);
  };

  const tabBtn = (key: "browse" | "community", label: string) => (
    <button
      onClick={() => setTab(key)}
      style={{
        background: tab === key ? "rgba(157,39,222,0.2)" : "transparent",
        border: "none",
        borderBottom: tab === key ? "2px solid #9D27DE" : "2px solid transparent",
        color: tab === key ? "#F2F2F0" : "rgba(242,242,240,0.45)",
        padding: "8px 14px",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "Space Grotesk, sans-serif",
        fontWeight: tab === key ? 600 : 400,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 350,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fade-in 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(160deg, #1A0628 0%, #0D0018 100%)",
          border: "1px solid rgba(157,39,222,0.4)",
          borderRadius: 16,
          width: 820,
          maxWidth: "95vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(157,39,222,0.1)",
          animation: "slide-up 0.3s ease",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(157,39,222,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(157,39,222,0.04)",
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>
              📦 Library Manager
            </h2>
            <p style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", marginTop: 3 }}>
              {board.name} · {compatible.length} compatible libraries
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: "6px 10px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(157,39,222,0.1)", padding: "0 16px" }}>
          {tabBtn("browse", "Browse Libraries")}
          {tabBtn("community", "Add from GitHub")}
        </div>

        {tab === "browse" && (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* Category sidebar */}
            <div
              style={{
                width: 160,
                borderRight: "1px solid rgba(157,39,222,0.1)",
                padding: "12px 8px",
                overflowY: "auto",
                flexShrink: 0,
              }}
            >
              {(["All", ...allCats, "Community"] as (LibraryCategory | "All" | "Community")[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as any)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: activeCategory === cat ? "rgba(157,39,222,0.2)" : "transparent",
                    color: activeCategory === cat ? "#F2F2F0" : "rgba(242,242,240,0.5)",
                    fontSize: 11,
                    cursor: "pointer",
                    marginBottom: 2,
                    transition: "all 0.15s",
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: activeCategory === cat ? 600 : 400,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Library list */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Search */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(157,39,222,0.08)" }}>
                <div style={{ position: "relative" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(157,39,222,0.5)"
                    strokeWidth="2"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search libraries..."
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(157,39,222,0.2)",
                      borderRadius: 8,
                      padding: "8px 12px 8px 32px",
                      color: "#F2F2F0",
                      fontSize: 12,
                      outline: "none",
                      fontFamily: "Space Grotesk, sans-serif",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#9D27DE")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(157,39,222,0.2)")}
                  />
                </div>
              </div>

              {/* Results */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "rgba(242,242,240,0.3)", fontSize: 13 }}>
                    No libraries found
                  </div>
                ) : (
                  filtered.map((lib) => {
                    const installed = installedIds.has(lib.id);
                    return (
                      <div
                        key={lib.id}
                        style={{
                          padding: "12px 14px",
                          marginBottom: 6,
                          borderRadius: 8,
                          border: "1px solid rgba(157,39,222,0.12)",
                          background: "rgba(0,0,0,0.25)",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          transition: "all 0.15s",
                          cursor: "default",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(157,39,222,0.4)";
                          (e.currentTarget as HTMLDivElement).style.background = "rgba(157,39,222,0.06)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(157,39,222,0.12)";
                          (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.25)";
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#F2F2F0" }}>
                              {lib.name}
                            </span>
                            {lib.isCustom && (
                              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                                Community
                              </span>
                            )}
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "rgba(157,39,222,0.12)", color: "rgba(157,39,222,0.7)", marginLeft: "auto" }}>
                              {lib.category}
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: "rgba(242,242,240,0.5)", margin: "0 0 6px", lineHeight: 1.4 }}>
                            {lib.description}
                          </p>
                          <code style={{ fontSize: 10, color: "#38A169", fontFamily: "JetBrains Mono, monospace", background: "rgba(56,161,105,0.08)", padding: "1px 6px", borderRadius: 4 }}>
                            {lib.include}
                          </code>
                          {lib.author && (
                            <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", marginLeft: 8 }}>
                              by {lib.author}
                            </span>
                          )}
                          {lib.url && (
                            <a
                              href={lib.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 10, color: "rgba(157,39,222,0.6)", marginLeft: 8, textDecoration: "none" }}
                            >
                              GitHub →
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => handleInsert(lib)}
                          style={{
                            flexShrink: 0,
                            padding: "6px 14px",
                            borderRadius: 6,
                            border: "none",
                            background: installed ? "rgba(34,197,94,0.12)" : "rgba(157,39,222,0.2)",
                            color: installed ? "#4ade80" : "#B94FF0",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            fontFamily: "Space Grotesk, sans-serif",
                          }}
                          onMouseEnter={(e) => {
                            if (!installed) (e.currentTarget as HTMLButtonElement).style.background = "rgba(157,39,222,0.35)";
                          }}
                          onMouseLeave={(e) => {
                            if (!installed) (e.currentTarget as HTMLButtonElement).style.background = "rgba(157,39,222,0.2)";
                          }}
                        >
                          {installed ? "✓ Added" : "+ Include"}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "community" && (
          <div style={{ flex: 1, padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 15, color: "#F2F2F0", fontWeight: 700, marginBottom: 6 }}>
                Add Community Library from GitHub
              </h3>
              <p style={{ fontSize: 12, color: "rgba(242,242,240,0.5)", lineHeight: 1.6 }}>
                Paste any GitHub repository URL to add a community library. The <code>#include</code> line will be auto-guessed from the repo name — you can adjust it after inserting.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                GitHub Repository URL
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={githubUrl}
                  onChange={(e) => { setGithubUrl(e.target.value); setGithubError(""); }}
                  placeholder="https://github.com/user/repository"
                  style={{
                    flex: 1,
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${githubError ? "#ef4444" : "rgba(157,39,222,0.25)"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    color: "#F2F2F0",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddGithub(); }}
                  onFocus={(e) => (e.target.style.borderColor = "#9D27DE")}
                  onBlur={(e) => (e.target.style.borderColor = githubError ? "#ef4444" : "rgba(157,39,222,0.25)")}
                />
                <button
                  onClick={handleAddGithub}
                  disabled={!githubUrl.trim()}
                  className="btn-primary"
                  style={{ padding: "10px 20px", fontSize: 12, opacity: !githubUrl.trim() ? 0.5 : 1, flexShrink: 0 }}
                >
                  Add Library
                </button>
              </div>
              {githubError && (
                <p style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>{githubError}</p>
              )}
            </div>

            {/* Examples */}
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: 16, border: "1px solid rgba(157,39,222,0.1)" }}>
              <p style={{ fontSize: 11, color: "rgba(242,242,240,0.35)", marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Example GitHub URLs
              </p>
              {[
                "https://github.com/adafruit/Adafruit_DHT_sensor_library",
                "https://github.com/bblanchon/ArduinoJson",
                "https://github.com/knolleary/pubsubclient",
                "https://github.com/FastLED/FastLED",
              ].map((url) => (
                <div
                  key={url}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(157,39,222,0.06)" }}
                >
                  <code style={{ fontSize: 11, color: "rgba(157,39,222,0.7)", fontFamily: "JetBrains Mono, monospace" }}>
                    {url}
                  </code>
                  <button
                    onClick={() => setGithubUrl(url)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(157,39,222,0.5)",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    Use →
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "auto", padding: "12px 16px", borderRadius: 8, background: "rgba(157,39,222,0.06)", border: "1px solid rgba(157,39,222,0.15)", fontSize: 12, color: "rgba(242,242,240,0.5)", lineHeight: 1.6 }}>
              <strong style={{ color: "rgba(242,242,240,0.7)" }}>Note:</strong> Community libraries are added locally for this session. The <code>#include</code> line is auto-generated — you may need to adjust it to match the library's actual header file name. Always verify in the library's README.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Code Editor View ─────────────────────────────────────────────────────

export default function CodeEditorView({
  code,
  onChange,
  boardId,
  projectName,
  syncEnabled,
  onToggleSync,
  codeOverridesBlocks,
  onResetToBlocks,
  compileStatus,
  compileMessage,
  compileProgress,
  firmwareReady,
}: CodeEditorViewProps) {
  const board = getBoardConfig(boardId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showLibManager, setShowLibManager] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showMinimap, setShowMinimap] = useState(true);
  const [fontSize, setFontSize] = useState(12);
  const [wordWrap, setWordWrap] = useState(true);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    if (preRef.current) {
      preRef.current.scrollTop = el.scrollTop;
      preRef.current.scrollLeft = el.scrollLeft;
    }
  }, []);

  // Update cursor position
  const updateCursor = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.substring(0, el.selectionStart);
    const lines = text.split("\n");
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  }, []);

  // Handle tab key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const newCode = code.substring(0, start) + "  " + code.substring(end);
        onChange(newCode);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + 2;
        });
      }
      // Ctrl+S — noop (just prevent browser save dialog)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
      }
      // Ctrl+/ — toggle line comment
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart;
        const text = code;
        const lineStart = text.lastIndexOf("\n", start - 1) + 1;
        const lineContent = text.substring(lineStart, text.indexOf("\n", start) === -1 ? text.length : text.indexOf("\n", start));
        let newCode: string;
        if (lineContent.trimStart().startsWith("//")) {
          newCode = text.substring(0, lineStart) + lineContent.replace(/^(\s*)\/\/\s?/, "$1") + text.substring(lineStart + lineContent.length);
        } else {
          newCode = text.substring(0, lineStart) + "//" + lineContent + text.substring(lineStart + lineContent.length);
        }
        onChange(newCode);
      }
      // Ctrl+F — find
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowFindReplace(true);
      }
    },
    [code, onChange]
  );

  // Auto-close brackets
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Insert library
  const handleInsertLibrary = useCallback(
    (lib: ArduinoLibrary) => {
      const lines = code.split("\n");
      const includes = [...(lib.extraIncludes || []), lib.include];
      const alreadyIn = includes.filter((inc) => code.includes(inc));
      const toInsert = includes.filter((inc) => !code.includes(inc));

      if (toInsert.length === 0) {
        // All already present
        return;
      }

      // Find last #include line to insert after
      let lastIncludeIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#include") || lines[i].startsWith("// Generated")) {
          lastIncludeIdx = i;
        }
      }
      const insertAt = lastIncludeIdx + 1;
      const newLines = [...lines];
      newLines.splice(insertAt, 0, ...toInsert);
      let newCode = newLines.join("\n");

      // Add init snippet as a comment below the includes
      if (lib.initSnippet) {
        const snippetComment = `\n// ${lib.name} usage:\n// ${lib.initSnippet.split("\n").join("\n// ")}\n`;
        newCode = newCode.replace(toInsert[toInsert.length - 1], toInsert[toInsert.length - 1] + snippetComment);
      }
      
      // If it's a custom GitHub library, embed its URL so the compiler knows where to fetch it
      if (lib.isCustom && lib.url) {
        const urlComment = `\n// @bitblock-lib ${lib.url}\n`;
        newCode = newCode.replace(toInsert[0], urlComment + toInsert[0]);
      }

      onChange(newCode);
      setShowLibManager(false);

      if (alreadyIn.length > 0) {
        // Some already there, just inserted missing ones
      }
    },
    [code, onChange]
  );

  // Find & replace
  const handleFind = () => {
    if (!findQuery) return;
    const idx = code.indexOf(findQuery);
    if (idx !== -1 && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(idx, idx + findQuery.length);
    }
  };

  const handleReplace = () => {
    if (!findQuery) return;
    onChange(code.replace(findQuery, replaceQuery));
  };

  const handleReplaceAll = () => {
    if (!findQuery) return;
    onChange(code.split(findQuery).join(replaceQuery));
  };

  // Minimap preview
  const minimapLines = code.split("\n").slice(0, 120);

  const lineCount = (code.match(/\n/g) || []).length + 1;

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        gridRow: 2,
        display: "flex",
        flexDirection: "column",
        background: "#0A0A0A",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Code Override Banner ──────────────────────────────────────────── */}
      {codeOverridesBlocks && syncEnabled && (
        <div
          style={{
            background: "rgba(245,158,11,0.1)",
            borderBottom: "1px solid rgba(245,158,11,0.3)",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: "#fbbf24",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>Code Override Active</strong> — Your edits here are used for compile/flash. Block Workspace is paused.
          </span>
          <button
            onClick={onResetToBlocks}
            style={{
              marginLeft: "auto",
              background: "rgba(245,158,11,0.15)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 6,
              padding: "3px 12px",
              color: "#fbbf24",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 600,
            }}
          >
            Reset to Blocks
          </button>
        </div>
      )}

      {/* ── Compile Status Bar ────────────────────────────────────────────── */}
      {compileStatus !== "idle" && (
        <div
          style={{
            padding: "8px 20px",
            background:
              compileStatus === "success"
                ? "rgba(34,197,94,0.07)"
                : compileStatus === "error"
                ? "rgba(239,68,68,0.07)"
                : "rgba(157,39,222,0.07)",
            borderBottom: `1px solid ${
              compileStatus === "success"
                ? "rgba(34,197,94,0.2)"
                : compileStatus === "error"
                ? "rgba(239,68,68,0.2)"
                : "rgba(157,39,222,0.2)"
            }`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {compileStatus === "compiling" && (
            <svg width="13" height="13" viewBox="0 0 24 24" style={{ animation: "spin-slow 0.8s linear infinite", flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" stroke="rgba(157,39,222,0.3)" strokeWidth="3" fill="none" />
              <path d="M12 2 A10 10 0 0 1 22 12" stroke="#9D27DE" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          )}
          <span
            style={{
              fontSize: 11,
              color:
                compileStatus === "success" ? "#4ade80" : compileStatus === "error" ? "#f87171" : "#B94FF0",
              fontFamily: "JetBrains Mono, monospace",
              flex: 1,
            }}
          >
            {compileMessage}
          </span>
          {compileStatus === "compiling" && (
            <div style={{ width: 120, height: 4, borderRadius: 999, background: "rgba(157,39,222,0.15)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(4, Math.min(100, compileProgress))}%`,
                  background: "linear-gradient(90deg, #9D27DE, #C084FC)",
                  transition: "width 0.8s ease",
                  borderRadius: 999,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Editor Toolbar ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          borderBottom: "1px solid rgba(157,39,222,0.1)",
          background: "#0D0018",
          flexWrap: "wrap",
        }}
      >
        {/* File badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(157,39,222,0.08)",
            border: "1px solid rgba(157,39,222,0.2)",
            borderRadius: 6,
            padding: "3px 10px",
            marginRight: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9D27DE" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          <span style={{ fontSize: 11, color: "#E0D8F0", fontFamily: "JetBrains Mono, monospace" }}>
            {projectName.replace(/\s+/g, "_") || "sketch"}.ino
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: "rgba(157,39,222,0.15)" }} />

        {/* Libraries */}
        <button
          id="lib-manager-btn"
          onClick={() => setShowLibManager(true)}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px", gap: 5 }}
          title="Library Manager"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Libraries
        </button>

        {/* Find & Replace */}
        <button
          id="find-replace-btn"
          onClick={() => setShowFindReplace((v) => !v)}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px", gap: 5, color: showFindReplace ? "#9D27DE" : undefined }}
          title="Find & Replace (Ctrl+F)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Find
        </button>

        {/* Word Wrap */}
        <button
          onClick={() => setWordWrap((v) => !v)}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px", gap: 5, color: wordWrap ? "#9D27DE" : undefined }}
          title="Toggle word wrap"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          Wrap
        </button>

        {/* Font size */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <button
            onClick={() => setFontSize((f) => Math.max(9, f - 1))}
            className="btn-ghost"
            style={{ padding: "2px 7px", fontSize: 13 }}
            title="Decrease font size"
          >
            A<sup>-</sup>
          </button>
          <span style={{ color: "rgba(242,242,240,0.3)", fontSize: 10, minWidth: 20, textAlign: "center" }}>{fontSize}</span>
          <button
            onClick={() => setFontSize((f) => Math.min(20, f + 1))}
            className="btn-ghost"
            style={{ padding: "2px 7px", fontSize: 13 }}
            title="Increase font size"
          >
            A<sup>+</sup>
          </button>
        </div>

        {/* Minimap toggle */}
        <button
          onClick={() => setShowMinimap((v) => !v)}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px", gap: 5, color: showMinimap ? "#9D27DE" : undefined }}
          title="Toggle minimap"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18M15 3v18" />
          </svg>
          Map
        </button>

        <div style={{ flex: 1 }} />

        {/* Sync toggle */}
        <button
          id="sync-toggle-btn"
          onClick={onToggleSync}
          title={syncEnabled ? "Sync ON — disable to edit independently" : "Sync OFF — enable to mirror Blockly workspace"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 20,
            border: `1px solid ${syncEnabled ? "rgba(157,39,222,0.5)" : "rgba(157,39,222,0.2)"}`,
            background: syncEnabled ? "rgba(157,39,222,0.15)" : "rgba(0,0,0,0.2)",
            color: syncEnabled ? "#B94FF0" : "rgba(242,242,240,0.4)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
            fontFamily: "Space Grotesk, sans-serif",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {syncEnabled ? (
              <>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </>
            ) : (
              <>
                <path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
                <path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07A5.006 5.006 0 0 0 10.43 20l1.71-1.71" />
                <line x1="8" y1="2" x2="8" y2="5" />
                <line x1="2" y1="8" x2="5" y2="8" />
                <line x1="16" y1="19" x2="16" y2="22" />
                <line x1="19" y1="16" x2="22" y2="16" />
              </>
            )}
          </svg>
          {syncEnabled ? "Synced with Blocks" : "Sync Off"}
        </button>

        <div style={{ width: 1, height: 18, background: "rgba(157,39,222,0.15)" }} />

        {/* Copy */}
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px" }}
          title="Copy code"
        >
          Copy
        </button>

        {/* Download */}
        <button
          onClick={() => {
            const blob = new Blob([code], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${projectName.replace(/\s+/g, "_") || "sketch"}.ino`;
            a.click();
          }}
          className="btn-ghost"
          style={{ fontSize: 11, padding: "4px 10px" }}
          title="Download .ino file"
        >
          ↓ .ino
        </button>
      </div>

      {/* ── Find & Replace Bar ──────────────────────────────────────────────── */}
      {showFindReplace && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "#12031C",
            borderBottom: "1px solid rgba(157,39,222,0.15)",
            flexWrap: "wrap",
          }}
        >
          <input
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Find..."
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(157,39,222,0.25)",
              borderRadius: 6,
              padding: "5px 10px",
              color: "#F2F2F0",
              fontSize: 12,
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
              width: 180,
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleFind(); if (e.key === "Escape") setShowFindReplace(false); }}
          />
          <input
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Replace with..."
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(157,39,222,0.25)",
              borderRadius: 6,
              padding: "5px 10px",
              color: "#F2F2F0",
              fontSize: 12,
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
              width: 180,
            }}
          />
          <button onClick={handleFind} className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Find</button>
          <button onClick={handleReplace} className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Replace</button>
          <button onClick={handleReplaceAll} className="btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}>Replace All</button>
          <button onClick={() => setShowFindReplace(false)} className="btn-ghost" style={{ fontSize: 11, padding: "4px 8px", marginLeft: "auto" }}>✕</button>
        </div>
      )}

      {/* ── Editor Body ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Main editor area */}
        <div ref={editorContainerRef} style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
          {/* Line numbers column */}
          <div
            style={{
              width: 48,
              flexShrink: 0,
              background: "#0D0018",
              borderRight: "1px solid rgba(157,39,222,0.08)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <LineNumbers code={code} scrollTop={scrollTop} />
          </div>

          {/* Highlight + textarea overlay */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Syntax highlight layer (behind textarea) */}
            <pre
              ref={preRef}
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                padding: "14px 16px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize,
                lineHeight: "20px",
                color: "#E0D8F0",
                background: "transparent",
                pointerEvents: "none",
                overflow: "hidden",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                wordBreak: wordWrap ? "break-word" : "normal",
                tabSize: 2,
                zIndex: 1,
              }}
              dangerouslySetInnerHTML={{ __html: highlightCpp(code) + "\n" }}
            />

            {/* Editable textarea (transparent over highlight) */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              onClick={updateCursor}
              onKeyUp={updateCursor}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                padding: "14px 16px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize,
                lineHeight: "20px",
                color: "transparent",
                caretColor: "#C084FC",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                overflow: "auto",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                wordBreak: wordWrap ? "break-word" : "normal",
                tabSize: 2,
                zIndex: 2,
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        </div>

        {/* ── Minimap ───────────────────────────────────────────────────── */}
        {showMinimap && (
          <div
            style={{
              width: 90,
              flexShrink: 0,
              background: "#070010",
              borderLeft: "1px solid rgba(157,39,222,0.06)",
              overflow: "hidden",
              padding: "8px 4px",
              position: "relative",
            }}
            title="Minimap — click to jump"
          >
            <div style={{ fontSize: 3.5, lineHeight: "5px", fontFamily: "JetBrains Mono, monospace", color: "rgba(157,39,222,0.5)", wordBreak: "break-all", userSelect: "none" }}>
              {minimapLines.map((line, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (textareaRef.current) {
                      const approxChar = code.split("\n").slice(0, i).join("\n").length;
                      textareaRef.current.focus();
                      textareaRef.current.setSelectionRange(approxChar, approxChar);
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    whiteSpace: "pre",
                    overflow: "hidden",
                    textOverflow: "clip",
                    maxWidth: "100%",
                    color: line.trim().startsWith("//") || line.trim().startsWith("/*") ? "rgba(120,120,120,0.6)" : line.trim().startsWith("#") ? "rgba(157,39,222,0.7)" : "rgba(200,200,220,0.45)",
                  }}
                >
                  {line || " "}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Status Bar ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 16px",
          borderTop: "1px solid rgba(157,39,222,0.1)",
          background: "rgba(6,2,14,0.9)",
          flexWrap: "wrap",
          fontSize: 10,
        }}
      >
        {/* Board info */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: board.color,
              boxShadow: `0 0 5px ${board.color}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 10, color: board.color, fontWeight: 500 }}>{board.name}</span>
        </div>

        <div style={{ width: 1, height: 12, background: "rgba(157,39,222,0.12)" }} />

        {/* Firmware ready indicator */}
        {firmwareReady && (
          <>
            <span style={{ fontSize: 10, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="#4ade80"><circle cx="12" cy="12" r="6"/></svg>
              Firmware ready
            </span>
            <div style={{ width: 1, height: 12, background: "rgba(157,39,222,0.12)" }} />
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Cursor position */}
        <span style={{ color: "rgba(242,242,240,0.25)", fontFamily: "JetBrains Mono, monospace" }}>
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <span style={{ color: "rgba(242,242,240,0.2)", fontFamily: "JetBrains Mono, monospace" }}>
          {lineCount} lines
        </span>
        <span
          style={{
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 3,
            background: "rgba(157,39,222,0.08)",
            color: "rgba(157,39,222,0.5)",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.04em",
          }}
        >
          Arduino C++
        </span>
      </div>

      {/* ── Library Manager Modal ───────────────────────────────────────────── */}
      {showLibManager && (
        <LibraryManager
          boardId={boardId}
          onInsert={handleInsertLibrary}
          onClose={() => setShowLibManager(false)}
        />
      )}

      {/* ── Syntax Highlight Styles ──────────────────────────────────────────── */}
      <style>{`
        .hl-comment   { color: #6B7280; font-style: italic; }
        .hl-preprocessor { color: #C084FC; }
        .hl-string    { color: #86efac; }
        .hl-keyword   { color: #9D27DE; font-weight: 600; }
        .hl-builtin   { color: #38BDF8; }
        .hl-number    { color: #FBD38D; }
        .hl-macro     { color: #F59E0B; }
      `}</style>
    </div>
  );
}
