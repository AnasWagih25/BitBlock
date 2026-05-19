import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, Send, Trash2, RotateCcw } from "lucide-react";

interface SerialMonitorProps {
  logs: string[];
  onClear: () => void;
  onRequestPort: () => void;
  connectedPort: any | null;
}

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const LINE_ENDINGS = [
  { label: "No line ending", value: "" },
  { label: "Newline (\\n)", value: "\n" },
  { label: "Carriage return (\\r)", value: "\r" },
  { label: "Both NL & CR", value: "\r\n" },
];

export default function SerialMonitor({ logs, onClear, onRequestPort, connectedPort }: SerialMonitorProps) {
  const [baudRate, setBaudRate] = useState(115200);
  const [lineEnding, setLineEnding] = useState("\n");
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [monitorLogs, setMonitorLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const keepReadingRef = useRef(false);
  const isOpenRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine parent logs (compilation/flash) with monitor logs
  const allLogs = [...logs, ...monitorLogs];

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allLogs, autoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopReading();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback((line: string) => {
    setMonitorLogs(prev => {
      // Cap at 5000 lines to prevent memory issues
      const next = [...prev, line];
      return next.length > 5000 ? next.slice(-4000) : next;
    });
  }, []);

  const stopReading = useCallback(async () => {
    keepReadingRef.current = false;

    // Cancel and release reader
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch { /* ignore */ }
      try {
        readerRef.current.releaseLock();
      } catch { /* ignore */ }
      readerRef.current = null;
    }

    // Release writer
    if (writerRef.current) {
      try {
        writerRef.current.releaseLock();
      } catch { /* ignore */ }
      writerRef.current = null;
    }
  }, []);

  const readLoop = useCallback(async (port: any) => {
    const decoder = new TextDecoder();
    let buffer = "";

    while (keepReadingRef.current && port.readable) {
      try {
        const reader = port.readable.getReader();
        readerRef.current = reader;

        while (keepReadingRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            // Split on newlines, keeping partial data in buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const cleaned = line.replace(/\r/g, "");
              if (cleaned.length > 0) {
                addLog(cleaned);
              }
            }
          }
        }

        reader.releaseLock();
      } catch (err: any) {
        // Stream was cancelled or disconnected
        if (keepReadingRef.current) {
          addLog(`[Serial] Read error: ${err.message || "unknown"}`);
        }
        break;
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      addLog(buffer.replace(/\r/g, ""));
    }
  }, [addLog]);

  const openPort = useCallback(async () => {
    if (!connectedPort) {
      onRequestPort();
      return;
    }

    setIsConnecting(true);
    try {
      // Close if already open (fresh start)
      if (connectedPort.readable || connectedPort.writable) {
        try {
          await stopReading();
          await connectedPort.close();
        } catch { /* ignore */ }
      }

      await connectedPort.open({ baudRate });

      // DO NOT toggle DTR/RTS — this resets the ESP32 into download mode
      // The Arduino IDE also connects without toggling these by default for monitoring

      isOpenRef.current = true;
      setIsOpen(true);
      keepReadingRef.current = true;

      addLog(`[Serial] Connected at ${baudRate} baud`);
      readLoop(connectedPort);
    } catch (err: any) {
      if (err.message?.includes("already open")) {
        // Port was already open, try to just start reading
        isOpenRef.current = true;
        setIsOpen(true);
        keepReadingRef.current = true;
        addLog(`[Serial] Resuming connection at ${baudRate} baud`);
        readLoop(connectedPort);
      } else {
        addLog(`[Serial] Failed to open: ${err.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [connectedPort, baudRate, addLog, onRequestPort, readLoop, stopReading]);

  const closePort = useCallback(async () => {
    await stopReading();
    isOpenRef.current = false;

    if (connectedPort) {
      try {
        await connectedPort.close();
      } catch { /* ignore close errors */ }
    }

    setIsOpen(false);
    addLog(`[Serial] Disconnected`);
  }, [connectedPort, addLog, stopReading]);

  const handleSend = useCallback(async () => {
    if (!isOpen || !connectedPort?.writable) return;
    const message = inputText + lineEnding;
    try {
      const writer = connectedPort.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(message));
      writer.releaseLock();
      addLog(`> ${inputText}`);
      setInputText("");
      inputRef.current?.focus();
    } catch (err: any) {
      addLog(`[Error] Send failed: ${err.message}`);
    }
  }, [isOpen, connectedPort, inputText, lineEnding, addLog]);

  const handleReset = useCallback(async () => {
    if (!connectedPort?.setSignals) {
      addLog("[Serial] Board does not support reset signals");
      return;
    }
    try {
      addLog("[Serial] Resetting board...");
      // Standard Arduino reset: toggle DTR
      await connectedPort.setSignals({ dataTerminalReady: false });
      await new Promise(r => setTimeout(r, 250));
      await connectedPort.setSignals({ dataTerminalReady: true });
    } catch (err: any) {
      addLog(`[Serial] Reset failed: ${err.message}`);
    }
  }, [connectedPort, addLog]);

  const handleClear = useCallback(() => {
    onClear();
    setMonitorLogs([]);
  }, [onClear]);

  const formatTimestamp = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  };

  const getLineColor = (line: string) => {
    if (line.startsWith("[Error]") || line.startsWith("ERR")) return "#f87171";
    if (line.startsWith("> ")) return "#c084fc";
    if (line.startsWith("[Serial]")) return "#4ade80";
    if (line.startsWith("[ML]")) return "#38bdf8";
    if (line.includes("ANOMALY")) return "#fb923c";
    if (line.includes("normal:")) return "#4ade80";
    return "#d4d4d8";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0D0018" }}>
      {/* ── Toolbar ── */}
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid rgba(157,39,222,0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "rgba(157,39,222,0.05)",
      }}>
        {/* Top Row: Status & Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: isOpen ? "#4ade80" : "rgba(242,242,240,0.3)",
              boxShadow: isOpen ? "0 0 8px rgba(74,222,128,0.6)" : "none",
              transition: "all 0.3s",
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: isOpen ? "#F2F2F0" : "rgba(242,242,240,0.5)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              fontFamily: "JetBrains Mono, monospace",
            }}>
              Serial Monitor
            </span>
            {isOpen && (
              <span style={{
                fontSize: 10, color: "rgba(242,242,240,0.4)",
                fontFamily: "JetBrains Mono, monospace",
              }}>
                {baudRate} baud
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 2 }}>
            <button
              onClick={() => setShowTimestamps(v => !v)}
              title="Toggle timestamps"
              style={{
                padding: "4px 8px", fontSize: 10, fontWeight: 500,
                background: showTimestamps ? "rgba(157,39,222,0.15)" : "transparent",
                border: showTimestamps ? "1px solid rgba(157,39,222,0.3)" : "1px solid transparent",
                borderRadius: 4, cursor: "pointer",
                color: showTimestamps ? "#c084fc" : "rgba(242,242,240,0.5)",
                transition: "all 0.15s",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              T
            </button>
            <button
              onClick={() => setAutoScroll(v => !v)}
              title="Toggle auto-scroll"
              style={{
                padding: "4px 8px", fontSize: 10, fontWeight: 500,
                background: autoScroll ? "rgba(74,222,128,0.1)" : "transparent",
                border: autoScroll ? "1px solid rgba(74,222,128,0.2)" : "1px solid transparent",
                borderRadius: 4, cursor: "pointer",
                color: autoScroll ? "#4ade80" : "rgba(242,242,240,0.5)",
                transition: "all 0.15s",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              ↓
            </button>
            <button
              onClick={handleClear}
              title="Clear output"
              style={{
                padding: "4px 8px",
                background: "transparent", border: "1px solid transparent",
                borderRadius: 4, cursor: "pointer", color: "rgba(242,242,240,0.5)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(242,242,240,0.5)"}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Bottom Row: Connection Controls */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Baud Rate */}
          <select
            value={baudRate}
            onChange={e => setBaudRate(Number(e.target.value))}
            disabled={isOpen}
            style={{
              background: "#0D0018", border: "1px solid rgba(157,39,222,0.3)",
              color: "#F2F2F0", fontSize: 11, padding: "5px 8px", borderRadius: 4,
              outline: "none", cursor: isOpen ? "not-allowed" : "pointer",
              fontFamily: "JetBrains Mono, monospace",
              opacity: isOpen ? 0.5 : 1,
            }}
          >
            {BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          {/* Line Ending */}
          <select
            value={lineEnding}
            onChange={e => setLineEnding(e.target.value)}
            style={{
              background: "#0D0018", border: "1px solid rgba(157,39,222,0.3)",
              color: "#F2F2F0", fontSize: 11, padding: "5px 8px", borderRadius: 4,
              outline: "none", cursor: "pointer",
              fontFamily: "JetBrains Mono, monospace",
              minWidth: 95,
            }}
          >
            {LINE_ENDINGS.map(le => <option key={le.value} value={le.value}>{le.label}</option>)}
          </select>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Connect/Disconnect & Reset buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            {isOpen ? (
              <>
              <button
                onClick={handleReset}
                title="Reset board (DTR toggle)"
                style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 600,
                  background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
                  borderRadius: 4, cursor: "pointer",
                  color: "#fbbf24", display: "flex", alignItems: "center", gap: 4,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(251,191,36,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(251,191,36,0.08)"}
              >
                <RotateCcw size={11} /> Reset
              </button>
              <button
                onClick={closePort}
                style={{
                  padding: "5px 12px", fontSize: 11, fontWeight: 600,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 4, cursor: "pointer",
                  color: "#f87171", display: "flex", alignItems: "center", gap: 4,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"}
              >
                <Square size={10} fill="currentColor" /> Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={openPort}
              disabled={isConnecting}
              style={{
                padding: "5px 16px", fontSize: 11, fontWeight: 600,
                background: isConnecting ? "rgba(157,39,222,0.1)" : "rgba(157,39,222,0.15)",
                border: "1px solid rgba(157,39,222,0.4)",
                borderRadius: 4, cursor: isConnecting ? "wait" : "pointer",
                color: "#e9d5ff", display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!isConnecting) e.currentTarget.style.background = "rgba(157,39,222,0.25)"; }}
              onMouseLeave={e => { if (!isConnecting) e.currentTarget.style.background = "rgba(157,39,222,0.15)"; }}
            >
              <Play size={10} fill="currentColor" />
              {isConnecting ? "Opening..." : connectedPort ? "Open Monitor" : "Select Port & Open"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Output Area ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflow: "auto", padding: "8px 12px",
          fontFamily: "JetBrains Mono, Consolas, monospace",
          fontSize: 12, lineHeight: 1.55,
          background: "#0D0018",
        }}
        onScroll={() => {
          if (!scrollRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
          // If user scrolls up, disable auto-scroll; if at bottom, re-enable
          const atBottom = scrollHeight - scrollTop - clientHeight < 40;
          if (!atBottom && autoScroll) setAutoScroll(false);
        }}
      >
        {allLogs.length === 0 && (
          <div style={{
            color: "rgba(242,242,240,0.3)", fontStyle: "italic", padding: "40px 0",
            textAlign: "center", fontSize: 12,
          }}>
            <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.5 }}>⌨</div>
            No serial output yet. Connect a board and open the monitor.
          </div>
        )}
        {allLogs.map((line, i) => (
          <div key={i} style={{
            padding: "1px 0",
            wordBreak: "break-all",
            color: getLineColor(line),
            display: "flex",
            gap: 8,
          }}>
            {showTimestamps && (
              <span style={{ color: "rgba(242,242,240,0.35)", fontSize: 10, flexShrink: 0, marginTop: 2 }}>
                {formatTimestamp()}
              </span>
            )}
            <span>{line}</span>
          </div>
        ))}
      </div>

      {/* ── Input Area ── */}
      <div style={{
        padding: "8px 12px",
        borderTop: "1px solid rgba(157,39,222,0.2)",
        background: "rgba(157,39,222,0.03)",
        display: "flex", gap: 6,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder={isOpen ? "Type a message and press Enter..." : "Connect to send messages"}
          disabled={!isOpen}
          style={{
            flex: 1, background: "#0D0018",
            border: `1px solid ${isOpen ? "rgba(157,39,222,0.3)" : "rgba(157,39,222,0.1)"}`,
            color: "#F2F2F0", borderRadius: 4, padding: "6px 10px",
            fontSize: 12, outline: "none",
            fontFamily: "JetBrains Mono, monospace",
            opacity: isOpen ? 1 : 0.4,
            transition: "all 0.15s",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "#9D27DE"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(157,39,222,0.3)"}
        />
        <button
          onClick={handleSend}
          disabled={!isOpen || !inputText.trim()}
          style={{
            padding: "6px 12px", borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isOpen && inputText.trim() ? "rgba(157,39,222,0.15)" : "rgba(157,39,222,0.05)",
            border: isOpen && inputText.trim() ? "1px solid rgba(157,39,222,0.4)" : "1px solid rgba(157,39,222,0.1)",
            color: isOpen && inputText.trim() ? "#e9d5ff" : "rgba(242,242,240,0.3)",
            cursor: isOpen && inputText.trim() ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
