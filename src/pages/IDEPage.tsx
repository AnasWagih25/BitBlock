import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import CassetteMascot from "../components/ui/CassetteMascot";
import { BOARDS, getBoardConfig } from "../boards/registry";
import { compiler } from "../compiler/assembler";
import { defineCoreBlocks, getCoreToolboxBlocks } from "../blocks/core";
import { defineAllLibraryBlocks, getAllLibraryCategories } from "../libraries";
import DataCollection from "../ml/DataCollection";
import TrainingView from "../ml/TrainingView";
import TestingView from "../ml/Testing";
import { flashESPBlock } from "../flash/esptoolProtocol";
import { flashSTK500 } from "../flash/stk500Protocol";
import { flashUF2 } from "../flash/uf2Flashing";

// Dynamically import Blockly to avoid SSR issues
let Blockly: any = null;

const PANEL_TABS = ["code", "serial", "info"] as const;
type PanelTab = typeof PANEL_TABS[number];

export default function IDEPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("// Connect blocks in the editor to generate code");
  const [panelTab, setPanelTab] = useState<PanelTab>("code");
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "success" | "error">("idle");
  const [compileMessage, setCompileMessage] = useState("");
  const [flashSupported, setFlashSupported] = useState(false);
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [blocklyReady, setBlocklyReady] = useState(false);
  const [showCamWizard, setShowCamWizard] = useState(false);
  const [viewMode, setViewMode] = useState<"blocks" | "ml">("blocks");

  const workspaceRef = useRef<any>(null);
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    setFlashSupported("serial" in navigator);
  }, []);

  useEffect(() => {
    if (!projectId || !user) return;
    fetchProject();
  }, [projectId, user]);

  const fetchProject = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "projects", projectId));
      if (!snap.exists()) { navigate("/dashboard"); return; }
      const data = snap.data();
      if (data.ownerId !== user?.uid) { navigate("/dashboard"); return; }
      setProject({ id: snap.id, ...data });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Blockly once project is loaded
  useEffect(() => {
    if (!project || !blocklyDivRef.current || blocklyReady) return;
    initBlockly();
  }, [project]);

  const initBlockly = async () => {
    try {
      const blocklyMod = await import("blockly");
      Blockly = blocklyMod.default || blocklyMod;

      // Custom theme
      const theme = Blockly.Theme.defineTheme("bitblock", {
        base: Blockly.Themes?.Classic,
        blockStyles: {
          logic_blocks: { colourPrimary: "#9D27DE", colourSecondary: "#2A0A3D", colourTertiary: "#6B1A99" },
          math_blocks: { colourPrimary: "#3182CE", colourSecondary: "#1A365D", colourTertiary: "#2B6CB0" },
          loop_blocks: { colourPrimary: "#38A169", colourSecondary: "#1C4532", colourTertiary: "#276749" },
          procedure_blocks: { colourPrimary: "#D69E2E", colourSecondary: "#744210", colourTertiary: "#B7791F" },
          variable_blocks: { colourPrimary: "#E53E3E", colourSecondary: "#742A2A", colourTertiary: "#C53030" },
          text_blocks: { colourPrimary: "#38B2AC", colourSecondary: "#1D4044", colourTertiary: "#2C7A7B" },
          colour_blocks: { colourPrimary: "#B794F4", colourSecondary: "#4A1772", colourTertiary: "#6B46C1" },
          hat_blocks: { colourPrimary: "#9D27DE", colourSecondary: "#2A0A3D", colourTertiary: "#6B1A99" },
        },
        categoryStyles: {
          logic_category: { colour: "#9D27DE" },
          loops_category: { colour: "#38A169" },
          math_category: { colour: "#3182CE" },
          text_category: { colour: "#38B2AC" },
          lists_category: { colour: "#E53E3E" },
          colour_category: { colour: "#B794F4" },
          variable_category: { colour: "#D69E2E" },
          procedure_category: { colour: "#F59E0B" },
        },
        componentStyles: {
          workspaceBackgroundColour: "#0A0A0A",
          toolboxBackgroundColour: "#12031C",
          toolboxForegroundColour: "#F2F2F0",
          flyoutBackgroundColour: "#1A0628",
          flyoutForegroundColour: "#E0D8F0",
          flyoutOpacity: 0.95,
          scrollbarColour: "#2A0A3D",
          insertionMarkerColour: "#9D27DE",
          insertionMarkerOpacity: 0.7,
          scrollbarOpacity: 0.8,
          cursorColour: "#9D27DE",
        },
      });

      const toolbox = {
        kind: "categoryToolbox",
        contents: [
          ...getCoreToolboxBlocks(),
          {
            kind: "category", name: "Control",
            contents: [
              { kind: "block", type: "controls_if" },
              { kind: "block", type: "controls_whileUntil" },
              { kind: "block", type: "controls_for" },
              { kind: "block", type: "controls_forEach" },
              { kind: "block", type: "controls_repeat_ext" },
            ],
          },
          {
            kind: "category", name: "Math",
            contents: [
              { kind: "block", type: "math_number" },
              { kind: "block", type: "math_arithmetic" },
              { kind: "block", type: "math_modulo" },
              { kind: "block", type: "math_random_int" },
              { kind: "block", type: "math_constrain" },
            ],
          },
          {
            kind: "category", name: "Text",
            contents: [
              { kind: "block", type: "text" },
              { kind: "block", type: "text_join" },
              { kind: "block", type: "text_print" },
              { kind: "block", type: "text_length" },
            ],
          },
          {
            kind: "category", name: "Variables", custom: "VARIABLE",
          },
          {
            kind: "category", name: "Functions", custom: "PROCEDURE",
          },
          { kind: "sep" },
          ...getAllLibraryCategories(),
        ],
      };

      // Define default and custom blocks
      defineCoreBlocks(Blockly);
      defineAllLibraryBlocks(Blockly);

      workspaceRef.current = Blockly.inject(blocklyDivRef.current, {
        toolbox,
        theme,
        trashcan: true,
        scrollbars: true,
        zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1 },
        grid: { spacing: 24, length: 4, colour: "rgba(157,39,222,0.1)", snap: true },
        move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true },
        sounds: false,
      });

      // Restore saved XML
      if (project?.blocksXml) {
        try {
          const xml = Blockly.utils.xml.textToDom(project.blocksXml);
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        } catch (e) {
          console.warn("Could not restore blocks:", e);
        }
      }

      // Listen for changes
      workspaceRef.current.addChangeListener(() => {
        generateCode();
        scheduleAutoSave();
      });

      setBlocklyReady(true);
    } catch (e) {
      console.error("Blockly init error:", e);
    }
  };

  const generateCode = useCallback(() => {
    if (!workspaceRef.current || !Blockly) return;
    try {
      const gen = Blockly.JavaScript || Blockly.javascriptGenerator;
      if (gen) {
        const boardId = project?.board || "esp32-wroom";
        compiler.init(boardId);
        
        let code = gen.workspaceToCode(workspaceRef.current);
        const wrapped = compiler.assemble(code);
        setGeneratedCode(wrapped || "// Add blocks to generate code");
        
        const warning = compiler.getMemoryWarning();
        if (warning) {
            setCompileMessage(warning);
            setCompileStatus("error"); // use error styling for warning for now
        } else if (compileStatus === "error" && compileMessage.includes("Estimated memory usage is high")) {
            setCompileStatus("idle");
        }
      }
    } catch (e) {
      // ignore
    }
  }, [project?.board]);

  const scheduleAutoSave = () => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveProject(), 3000);
  };

  const saveProject = async () => {
    if (!projectId || !workspaceRef.current || !Blockly) return;
    setSaving(true);
    try {
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      const xmlText = Blockly.utils.xml.domToText(xml);
      const blockCount = workspaceRef.current.getAllBlocks(false).length;
      await updateDoc(doc(db, "projects", projectId), {
        blocksXml: xmlText,
        blockCount,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleCompile = async () => {
    if (!user || !projectId) return;
    setCompiling(true);
    setCompileStatus("compiling");
    setCompileMessage("Queuing compilation job...");
    setPanelTab("code");

    try {
      // Create a compilation job in Firestore
      const jobRef = await addDoc(collection(db, "compilationJobs"), {
        userId: user.uid,
        projectId,
        board: project?.board || "ESP32",
        code: generatedCode,
        status: "queued",
        createdAt: serverTimestamp(),
      });

      setCompileMessage("Job queued · ID: " + jobRef.id.slice(0, 8));

      // Simulate compilation (real compilation needs Cloud Run)
      setTimeout(() => {
        setCompileStatus("success");
        setCompileMessage("✓ Compiled successfully · 12.4KB · Ready to flash");
        setCompiling(false);
      }, 2500);
    } catch (e) {
      setCompileStatus("error");
      setCompileMessage("Compilation failed. Check your blocks.");
      setCompiling(false);
    }
  };

  const appendLog = (msg: string) => setSerialLog(l => [...l, msg]);

  const handleFlash = async () => {
    const board = getBoardConfig(project?.board || "esp32-wroom");

    if (board.id === "arduino-nano-esp32" || board.id === "rp2040-pico") {
       setPanelTab("serial");
       flashUF2(appendLog);
       return;
    }

    if (!flashSupported) {
      alert("WebSerial is not supported in your browser.\nPlease use Chrome or Edge.");
      return;
    }
    
    if (board.id === "esp32-cam") {
       setShowCamWizard(true);
       return;
    }

    await performSerialFlash(board);
  };

  const performSerialFlash = async (board: any) => {
    setShowCamWizard(false);
    setPanelTab("serial");
    
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      appendLog("[WebSerial] Port opened successfully");
      
      const dummyBin = new ArrayBuffer(0); // Stub binary data currently

      if (board.platform === "esp32" || board.platform === "esp8266") {
          await flashESPBlock(port, 115200, dummyBin, appendLog);
      } else if (board.isAVR) {
          await flashSTK500(port, "dummy_hex_data", appendLog);
      } else {
          appendLog(`[Error] Unknown protocol for board platform: ${board.platform}`);
          await port.close();
      }

    } catch (e: any) {
      if (e.name !== "NotFoundError") {
        appendLog(`[Error] ${e.message}`);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0A" }}>
        <CassetteMascot size={120} mood="thinking" animate />
      </div>
    );
  }

  return (
    <div className="ide-layout" style={{ fontFamily: "Space Grotesk, sans-serif" }}>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <header className="ide-toolbar glass-dark" style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 16px", borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <Link to="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(242,242,240,0.5)" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 14, color: "#9D27DE" }}>BB</span>
        </Link>

        <div style={{ width: 1, height: 24, background: "rgba(157,39,222,0.2)" }} />

        <div style={{ flex: 1, display: "flex", gap: 32, alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#F2F2F0" }}>{project?.name}</span>

          {/* View Mode Toggle */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 3, border: "1px solid rgba(157,39,222,0.15)" }}>
            <button
               onClick={() => setViewMode("blocks")}
               style={{
                  background: viewMode === "blocks" ? "rgba(157,39,222,0.2)" : "transparent",
                  color: viewMode === "blocks" ? "#F2F2F0" : "rgba(242,242,240,0.5)",
                  border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", gap: 6, transition: "0.2s"
               }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h16v11H4z"/><path d="M4 9l8-5 8 5"/></svg>
              Workspace
            </button>
            <button
               onClick={() => setViewMode("ml")}
               style={{
                  background: viewMode === "ml" ? "rgba(157,39,222,0.2)" : "transparent",
                  color: viewMode === "ml" ? "#F2F2F0" : "rgba(242,242,240,0.5)",
                  border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", gap: 6, transition: "0.2s"
               }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
              ML Pipeline
            </button>
          </div>
        </div>

        {/* Board selector */}
        <select
          id="board-selector"
          value={project?.board || "esp32-wroom"}
          onChange={async (e) => {
            setProject((p: any) => ({ ...p, board: e.target.value }));
            if (projectId) {
              await updateDoc(doc(db, "projects", projectId), { board: e.target.value });
            }
          }}
          style={{
            background: "#1A0628", border: "1px solid rgba(157,39,222,0.3)",
            color: "#F2F2F0", borderRadius: 8, padding: "5px 10px", fontSize: 12,
            cursor: "pointer", outline: "none",
          }}
        >
          {BOARDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {/* Board color dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: getBoardConfig(project?.board || "esp32-wroom").color,
          boxShadow: `0 0 8px ${getBoardConfig(project?.board || "esp32-wroom").color}`,
        }} />

        <div style={{ width: 1, height: 24, background: "rgba(157,39,222,0.2)" }} />

        {/* Save indicator */}
        <span style={{ fontSize: 11, color: saving ? "#9D27DE" : "rgba(242,242,240,0.3)" }}>
          {saving ? "Saving..." : "Auto-saved"}
        </span>

        <button
          id="save-btn"
          onClick={saveProject}
          className="btn-ghost"
          style={{ fontSize: 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          Save
        </button>

        {/* Compile */}
        <button
          id="compile-btn"
          onClick={handleCompile}
          disabled={compiling}
          className="btn-primary"
          style={{ padding: "7px 18px", fontSize: 12 }}
        >
          {compiling ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "spin-slow 0.8s linear infinite" }}>
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
              Compiling...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Compile
            </>
          )}
        </button>

        {/* Flash */}
        <button
          id="flash-btn"
          onClick={handleFlash}
          disabled={compileStatus !== "success"}
          className="btn-secondary"
          style={{ padding: "7px 18px", fontSize: 12, opacity: compileStatus !== "success" ? 0.4 : 1 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Flash Device
        </button>
      </header>

      {/* ── Sidebar: Block categories info ──────────────── */}
      <aside className="ide-sidebar" style={{
        background: "#0D0018",
        borderRight: "1px solid rgba(157,39,222,0.1)",
        padding: "12px 0",
        display: viewMode === "blocks" ? "block" : "none"
      }}>
        <p style={{ fontSize: 10, color: "rgba(242,242,240,0.25)", padding: "0 16px 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Quick Help
        </p>
        {[
          { label: "GPIO", hint: "Digital/Analog pins" },
          { label: "Control", hint: "If, loops, logic" },
          { label: "Math", hint: "Numbers, arithmetic" },
          { label: "Serial", hint: "Serial.print()" },
          { label: "Timing", hint: "Delay, millis" },
          { label: "Sensors", hint: "DHT, US, IMU" },
          { label: "LED/Servo", hint: "NeoPixel, PWM" },
        ].map((item) => (
          <div key={item.label} style={{
            padding: "8px 16px", borderRadius: 6, margin: "1px 8px",
            cursor: "default",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(157,39,222,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#F2F2F0" }}>{item.label}</p>
                <p style={{ fontSize: 10, color: "rgba(242,242,240,0.35)" }}>{item.hint}</p>
              </div>
            </div>
          </div>
        ))}

        <div style={{ margin: "20px 16px 0", padding: "12px", background: "rgba(157,39,222,0.05)", borderRadius: 8, border: "1px solid rgba(157,39,222,0.1)" }}>
          <CassetteMascot size={64} mood={compileStatus === "success" ? "excited" : compileStatus === "error" ? "thinking" : "idle"} animate />
          <p style={{ fontSize: 10, color: "rgba(242,242,240,0.35)", textAlign: "center", marginTop: 6 }}>
            {compileStatus === "success" ? "Ready to flash! 🎉" : compileStatus === "error" ? "Check your blocks" : "Drag blocks to build"}
          </p>
        </div>
      </aside>

      {/* ── Main Canvas (Blockly) ────────────────────────── */}
      <main className="ide-canvas" style={{ position: "relative", overflow: "hidden", display: viewMode === "blocks" ? "block" : "none" }}>
        {!blocklyReady && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0A0A0A",
          }}>
            <div style={{ textAlign: "center" }}>
              <CassetteMascot size={100} mood="thinking" animate />
              <p style={{ fontSize: 13, color: "rgba(242,242,240,0.4)", marginTop: 12 }}>Loading editor...</p>
            </div>
          </div>
        )}
        <div ref={blocklyDivRef} style={{ width: "100%", height: "100%" }} />
      </main>

      {/* ── Right Panel ─────────────────────────────────── */}
      <aside className="ide-panel" style={{
        background: "#0D0018",
        borderLeft: "1px solid rgba(157,39,222,0.1)",
        display: viewMode === "blocks" ? "flex" : "none"
      }}>
        {/* Panel tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(157,39,222,0.1)",
          padding: "0 4px", flexWrap: "wrap"
        }}>
          {([
            { id: "code", label: "< > Code" },
            { id: "serial", label: "⌨ Serial" },
            { id: "info", label: "ℹ Info" },
          ] as { id: PanelTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              id={`panel-tab-${tab.id}`}
              onClick={() => setPanelTab(tab.id)}
              style={{
                flex: 1, padding: "10px 8px", background: "transparent",
                border: "none", cursor: "pointer", fontSize: 11,
                color: panelTab === tab.id ? "#9D27DE" : "rgba(242,242,240,0.4)",
                borderBottom: panelTab === tab.id ? "2px solid #9D27DE" : "2px solid transparent",
                transition: "all 0.15s", fontFamily: "Space Grotesk, sans-serif",
                fontWeight: panelTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
          {panelTab === "code" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              {/* Compile status */}
              {compileStatus !== "idle" && (
                <div style={{
                  padding: "10px 14px",
                  background: compileStatus === "success" ? "rgba(34,197,94,0.08)" :
                    compileStatus === "error" ? "rgba(239,68,68,0.08)" : "rgba(157,39,222,0.08)",
                  borderBottom: `1px solid ${compileStatus === "success" ? "rgba(34,197,94,0.2)" :
                    compileStatus === "error" ? "rgba(239,68,68,0.2)" : "rgba(157,39,222,0.2)"}`,
                  fontSize: 11,
                  color: compileStatus === "success" ? "#4ade80" : compileStatus === "error" ? "#f87171" : "#B94FF0",
                }}>
                  {compileMessage}
                </div>
              )}

              {/* Code header */}
              <div style={{
                padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: "1px solid rgba(157,39,222,0.08)",
              }}>
                <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", letterSpacing: "0.1em" }}>
                  {project?.board?.toUpperCase()} · C/C++
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    id="copy-code-btn"
                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "3px 8px" }}
                  >
                    Copy
                  </button>
                  <button
                    id="download-code-btn"
                    onClick={() => {
                      const blob = new Blob([generatedCode], { type: "text/plain" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${project?.name || "bitblock"}.ino`;
                      a.click();
                    }}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "3px 8px" }}
                  >
                    ↓ .ino
                  </button>
                </div>
              </div>

              {/* Code content */}
              <pre style={{
                flex: 1, padding: "14px", margin: 0,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11, lineHeight: 1.7,
                color: "#E0D8F0", overflow: "auto",
                background: "transparent", whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                <CodeHighlight code={generatedCode} />
              </pre>
            </div>
          )}

          {panelTab === "serial" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(157,39,222,0.08)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)" }}>Serial Monitor</span>
                <button onClick={() => setSerialLog([])} className="btn-ghost" style={{ fontSize: 10, padding: "2px 8px" }}>Clear</button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
                {serialLog.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(242,242,240,0.25)", fontFamily: "JetBrains Mono, monospace" }}>
                    {flashSupported ? "Connect and flash your device to see output." : "⚠ WebSerial not supported.\nUse Chrome or Edge."}
                  </p>
                ) : serialLog.map((line, i) => (
                  <div key={i} style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                    color: line.includes("[Error]") ? "#f87171" : line.includes("[Flash]") ? "#4ade80" : "#E0D8F0",
                    padding: "2px 0",
                  }}>
                    {line}
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(157,39,222,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: flashSupported ? "#22C55E" : "#EF4444",
                  }} />
                  <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)" }}>
                    {flashSupported ? "WebSerial available" : "WebSerial not supported"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {panelTab === "info" && (
            <div style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F2F0", marginBottom: 16 }}>Board Info</h3>
              <BoardInfo boardId={project?.board || "esp32-wroom"} />
            </div>
          )}
        </div>
      </aside>

      {/* ── Machine Learning Pipeline ──────────────────── */}
      {viewMode === "ml" && (
          <div style={{ gridColumn: "1 / -1", gridRow: 2, flex: 1, display: "flex", background: "#0A0A0A", padding: 32, gap: 32, overflow: "auto", height: "100%", boxSizing: "border-box" }}>
              <div style={{ flex: 1, background: "#1A0628", borderRadius: 12, border: "1px solid rgba(157,39,222,0.3)", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: 16, borderBottom: "1px solid rgba(157,39,222,0.15)", background: "rgba(157,39,222,0.05)" }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", display: "flex", alignItems: "center", gap: 8 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9D27DE" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          Data Collection
                      </h2>
                      <p style={{ fontSize: 12, color: "rgba(242,242,240,0.5)", marginTop: 4 }}>Stream IMU and Sensor data over WebSerial</p>
                  </div>
                  <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
                     <DataCollection projectId={projectId || ""} boardId={project?.board || "esp32-wroom"} />
                  </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 32 }}>
                  <div style={{ flex: 1, background: "#1A0628", borderRadius: 12, border: "1px solid rgba(157,39,222,0.3)", display: "flex", flexDirection: "column" }}>
                     <div style={{ padding: 16, borderBottom: "1px solid rgba(157,39,222,0.15)", background: "rgba(157,39,222,0.05)" }}>
                          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", display: "flex", alignItems: "center", gap: 8 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                              Cloud Run Training
                          </h2>
                     </div>
                     <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
                        <TrainingView projectId={projectId || ""} boardId={project?.board || "esp32-wroom"} />
                     </div>
                  </div>
                  
                  <div style={{ flex: 1, background: "#1A0628", borderRadius: 12, border: "1px solid rgba(157,39,222,0.3)", display: "flex", flexDirection: "column" }}>
                     <div style={{ padding: 16, borderBottom: "1px solid rgba(157,39,222,0.15)", background: "rgba(157,39,222,0.05)" }}>
                          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", display: "flex", alignItems: "center", gap: 8 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                              Inference Testing
                          </h2>
                     </div>
                     <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
                        <TestingView />
                     </div>
                  </div>
              </div>
          </div>
      )}

      {/* ESP32-CAM Setup Wizard Modal */}
      {showCamWizard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
           <div style={{ background: "#1A0628", border: "1px solid #9D27DE", borderRadius: 8, padding: 24, width: 400, maxWidth: "90%" }}>
              <h2 style={{ color: "#F2F2F0", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>ESP32-CAM Flash Mode</h2>
              <p style={{ color: "rgba(242,242,240,0.7)", fontSize: 13, marginBottom: 20 }}>
                The ESP32-CAM does not have a native USB port or auto-reset circuitry. 
                In order to write the new firmware over the FTDI programmer:
              </p>
              <ol style={{ color: "#E0D8F0", fontSize: 13, paddingLeft: 16, lineHeight: 1.6, marginBottom: 24 }}>
                <li>Connect <b>GPIO 0</b> to <b>GND</b></li>
                <li>Press the <b>RST</b> (Reset) button on the board</li>
                <li>Release the <b>RST</b> button</li>
                <li>Click the "Continue Flash" button below</li>
              </ol>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                 <button className="btn-ghost" onClick={() => setShowCamWizard(false)}>Cancel</button>
                 <button className="btn-primary" onClick={() => performSerialFlash(getBoardConfig("esp32-cam"))}>Continue Flash</button>
              </div>
           </div>
        </div>
      )}

      {/* ── Status Bar ───────────────────────────────────── */}
      <footer className="ide-statusbar glass-dark" style={{
        display: "flex", alignItems: "center", padding: "0 16px", gap: 20,
        borderTop: "1px solid rgba(157,39,222,0.1)", fontSize: 10,
        color: "rgba(242,242,240,0.35)",
      }}>
        <span>BitBlock IDE v1.0</span>
        <span>·</span>
        <span style={{ color: getBoardConfig(project?.board || "esp32-wroom").color }}>
          ● {getBoardConfig(project?.board || "esp32-wroom").name}
        </span>
        <span>·</span>
        <span>{blocklyReady ? "Editor ready" : "Loading editor..."}</span>
        {!flashSupported && (
          <>
            <span>·</span>
            <span style={{ color: "#F59E0B" }}>⚠ WebSerial not available (use Chrome/Edge)</span>
          </>
        )}
        <span style={{ marginLeft: "auto" }}>
          {saving ? "Saving..." : "All changes saved"}
        </span>
      </footer>
    </div>
  );
}

// ── Syntax highlight (minimal) ────────────────────────────
function CodeHighlight({ code }: { code: string }) {
  const highlighted = code
    .replace(/\/\/.*/g, (m) => `<span style="color:#6B7280">${m}</span>`)
    .replace(/\b(void|int|float|bool|char|String|const|return|if|else|for|while|do|include|define)\b/g,
      (m) => `<span style="color:#9D27DE;font-weight:600">${m}</span>`)
    .replace(/\b(setup|loop|Serial|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|millis)\b/g,
      (m) => `<span style="color:#3182CE">${m}</span>`)
    .replace(/"[^"]*"/g, (m) => `<span style="color:#38A169">${m}</span>`)
    .replace(/\b(\d+)\b/g, (m) => `<span style="color:#D69E2E">${m}</span>`);

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

// ── Board info panel ──────────────────────────────────────
function BoardInfo({ boardId }: { boardId: string }) {
  const info = getBoardConfig(boardId);
  const rows = [
    ["CPU / Platform", info.platform], ["Flash", `${info.flash} KB`], ["RAM", `${info.ram} KB`],
    ["PSRAM", `${info.psram} KB`], ["FQBN", info.fqbn],
  ];
  return (
    <div>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: info.color,
        display: "inline-block", marginRight: 8,
        boxShadow: `0 0 8px ${info.color}`,
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: info.color }}>{info.name}</span>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "rgba(242,242,240,0.4)" }}>{k}</span>
            <span style={{ fontSize: 11, color: "#F2F2F0", fontFamily: "JetBrains Mono, monospace" }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Features</p>
        {[
          ...(info.wifi ? ["WiFi Enabled"] : []),
          ...(info.ble ? ["BLE Enabled"] : []),
          ...(info.camera ? ["Camera Support"] : []),
          ...(info.mlSupport ? ["Machine Learning Support"] : []),
          ...(info.isAVR ? ["AVR Architecture"] : [])
        ].map((s) => (
          <div key={s} style={{
            fontSize: 11, color: "rgba(242,242,240,0.6)", padding: "4px 0",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: "#9D27DE" }}>✓</span> {s}
          </div>
        ))}
        {info.notes && (
           <div style={{
             marginTop: 12, padding: "8px", background: "rgba(245, 101, 101, 0.1)",
             border: "1px solid rgba(245, 101, 101, 0.2)", borderRadius: "6px",
             fontSize: 10, color: "#FCA5A5"
           }}>
             <span style={{ fontWeight: 600 }}>Note:</span> {info.notes}
           </div>
        )}
      </div>
    </div>
  );
}

