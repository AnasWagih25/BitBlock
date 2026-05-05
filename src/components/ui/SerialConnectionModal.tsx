import React, { useState, useEffect } from "react";
import { Usb, Trash2, Plus, X, Cpu } from "lucide-react";

interface SerialConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPort: (port: any) => void;
}

export default function SerialConnectionModal({ isOpen, onClose, onSelectPort }: SerialConnectionModalProps) {
  const [ports, setPorts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadPorts();
    }
  }, [isOpen]);

  const loadPorts = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      if (navigator.serial) {
        // @ts-ignore
        const savedPorts = await navigator.serial.getPorts();
        setPorts(savedPorts);
      }
    } catch (err) {
      console.error("Failed to load ports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleForget = async (port: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (typeof port.forget === "function") {
        await port.forget();
        await loadPorts();
      } else {
        alert("Your browser does not support forgetting serial ports yet.");
      }
    } catch (err) {
      console.error("Failed to forget port:", err);
    }
  };

  const handleConnectNew = async () => {
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      onSelectPort(port);
      onClose();
    } catch (err: any) {
      // User cancelled
      console.warn("User cancelled port selection:", err);
    }
  };

  const handleSelectSaved = (port: any) => {
    onSelectPort(port);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Space Grotesk, sans-serif"
    }} onClick={onClose}>
      
      <div className="modal-content glass-dark" style={{
        width: 480, maxWidth: "90vw", borderRadius: 24, padding: "32px",
        border: "1px solid rgba(157,39,222,0.3)",
        boxShadow: "0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset",
        position: "relative", overflow: "hidden",
        animation: "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -50, right: -50, width: 200, height: 200,
          background: "radial-gradient(circle, rgba(157,39,222,0.2) 0%, transparent 70%)",
          filter: "blur(30px)", pointerEvents: "none"
        }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(157,39,222,0.15)", border: "1px solid rgba(157,39,222,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Usb size={20} color="#9D27DE" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Connect Device</h2>
              <span style={{ fontSize: 13, color: "rgba(242,242,240,0.5)" }}>Select a paired board or add a new one</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "rgba(242,242,240,0.4)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 8, borderRadius: "50%"
          }} onMouseEnter={e => e.currentTarget.style.color = "#F2F2F0"} onMouseLeave={e => e.currentTarget.style.color = "rgba(242,242,240,0.4)"}>
            <X size={20} />
          </button>
        </div>

        {/* Saved Ports List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, maxHeight: "40vh", overflowY: "auto", paddingRight: 4 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: "rgba(242,242,240,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px 4px" }}>
            Saved Boards
          </h3>
          
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(242,242,240,0.4)", fontSize: 14 }}>
              Loading devices...
            </div>
          ) : ports.length === 0 ? (
            <div style={{
              padding: "32px 24px", textAlign: "center",
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16
            }}>
              <Cpu size={32} color="rgba(242,242,240,0.2)" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, color: "rgba(242,242,240,0.5)", fontWeight: 500 }}>No saved boards found</div>
              <div style={{ fontSize: 13, color: "rgba(242,242,240,0.3)", marginTop: 4 }}>Connect a new device to pair it with BitBlock.</div>
            </div>
          ) : (
            ports.map((port, idx) => {
              const info = port.getInfo();
              const vendor = info.usbVendorId ? `VID 0x${info.usbVendorId.toString(16).toUpperCase()}` : "Unknown Vendor";
              const product = info.usbProductId ? `PID 0x${info.usbProductId.toString(16).toUpperCase()}` : "Unknown Product";
              
              return (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 16, cursor: "pointer", transition: "all 0.2s ease"
                }}
                onClick={() => handleSelectSaved(port)}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(157,39,222,0.1)";
                  e.currentTarget.style.borderColor = "rgba(157,39,222,0.3)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.4)" }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#F2F2F0" }}>USB Serial Device</div>
                      <div style={{ fontSize: 12, color: "rgba(242,242,240,0.4)", marginTop: 2 }}>{vendor} • {product}</div>
                    </div>
                  </div>
                  
                  <button onClick={(e) => handleForget(port, e)} title="Remove device" style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
                    padding: 8, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button */}
        <button onClick={handleConnectNew} className="btn-primary" style={{
          width: "100%", padding: "16px", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          background: "linear-gradient(135deg, #9D27DE, #B94FF0)", border: "none", borderRadius: 14, cursor: "pointer"
        }}>
          <Plus size={18} />
          Pair New Device
        </button>

      </div>
    </div>
  );
}
