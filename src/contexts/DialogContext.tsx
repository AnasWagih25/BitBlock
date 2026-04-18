import React, { createContext, useContext, useState } from "react";

type DialogType = "alert" | "confirm";

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  message: string;
  resolve?: (value: boolean) => void;
}

interface DialogContextProps {
  alert: (message: string) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextProps | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    type: "alert",
    message: "",
  });

  const showAlert = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: "alert",
        message,
        resolve: () => resolve(),
      });
    });
  };

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: "confirm",
        message,
        resolve: (val: boolean) => resolve(val),
      });
    });
  };

  const handleClose = (value: boolean) => {
    if (dialog.resolve) {
      dialog.resolve(value);
    }
    setDialog({ ...dialog, isOpen: false });
  };

  return (
    <DialogContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
      {children}

      {/* Dialog Modal Renderer */}
      {dialog.isOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Space Grotesk, sans-serif"
        }}>
          <div className="glass" style={{
            background: "#12031C",
            border: "1px solid #9D27DE",
            borderRadius: 16, padding: 32, width: 400, maxWidth: "90%",
            boxShadow: "0 24px 50px rgba(0,0,0,0.5)",
            animation: "slide-up 0.2s ease-out"
          }}>
            <h2 style={{
              color: "#F2F2F0", fontWeight: 700, fontSize: 18, marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8
            }}>
              {dialog.type === "alert" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
              {dialog.type === "alert" ? "Notice" : "Confirm Action"}
            </h2>
            
            <p style={{ color: "rgba(242,242,240,0.8)", fontSize: 14, lineHeight: 1.6, marginBottom: 24, whiteSpace: "pre-wrap" }}>
              {dialog.message}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              {dialog.type === "confirm" && (
                <button
                  className="btn-ghost"
                  onClick={() => handleClose(false)}
                >
                  Cancel
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => handleClose(true)}
              >
                {dialog.type === "confirm" ? "Yes, I'm sure" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used within a DialogProvider");
  }
  return context;
}
