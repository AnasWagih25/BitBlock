import { useState, useEffect, useRef } from 'react';
import { useAppDialog } from '../contexts/DialogContext';

export default function TestingView() {
  const { alert } = useAppDialog();
  const [status, setStatus] = useState<"idle" | "connecting" | "testing">("idle");
  const [output, setOutput] = useState<Array<{ time: string, cls: string, conf: number }>>([]);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);

  useEffect(() => {
      return () => {
          isCanceledRef.current = true;
          if (readerRef.current) {
              try { readerRef.current.cancel(); } catch(e) {}
          }
      };
  }, []);

  const handleTest = async () => {
      setStatus("connecting");
      try {
          if (!portRef.current) {
              // @ts-ignore
              portRef.current = await navigator.serial.requestPort();
              await portRef.current.open({ baudRate: 115200 });
          }
          setStatus("testing");
          isCanceledRef.current = false;
          
          // @ts-ignore
          const textDecoder = new TextDecoderStream();
          portRef.current.readable.pipeTo(textDecoder.writable).catch(() => {});
          const reader = textDecoder.readable.getReader();
          readerRef.current = reader;

          let buffer = "";

          while (true) {
              if (isCanceledRef.current) break;
              const { value, done } = await reader.read();
              if (done || isCanceledRef.current) break;
              
              buffer += value;
              const lines = buffer.split('\n');
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                  const cleaned = line.trim();
                  if (!cleaned) continue;
                  
                  // Simple parsing logic: assume "class: 0.95" or "[INFERENCE] class: 0.95"
                  let cls = "unknown";
                  let conf = 0;
                  
                  if (cleaned.includes(':')) {
                      const parts = cleaned.split(':');
                      cls = parts[0].replace('[INFERENCE]', '').trim();
                      conf = parseFloat(parts[1]);
                  } else {
                      // Attempt to parse standard array output format if no colon
                      const numbers = cleaned.split(',').map(Number).filter(n => !isNaN(n));
                      if (numbers.length > 0) {
                          cls = `Class_${numbers.indexOf(Math.max(...numbers))}`;
                          conf = Math.max(...numbers);
                      } else {
                          continue; // not an inference line
                      }
                  }

                  if (!isNaN(conf)) {
                      const time = new Date().toISOString().split('T')[1].slice(0, 8);
                      setOutput(prev => {
                          const next = [{ time, cls, conf }, ...prev];
                          return next.slice(0, 5); // Keep last 5
                      });
                  }
              }
          }
      } catch (e: any) {
          if (e.name !== 'NotFoundError' && e.name !== 'NetworkError') {
              console.error("Serial error: ", e);
              await alert("Inference serial error: " + e.message);
          }
          setStatus("idle");
      } finally {
          if (readerRef.current) {
              try { readerRef.current.releaseLock(); } catch(e) {}
              readerRef.current = null;
          }
      }
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
       
       <button 
          onClick={handleTest}
          disabled={status !== "idle"}
          style={{ 
             width: "100%", padding: 12, borderRadius: 8,
             background: status === "idle" ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.05)",
             border: status === "idle" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid rgba(59, 130, 246, 0.1)",
             color: status === "idle" ? "#60a5fa" : "rgba(96, 165, 250, 0.5)",
             fontSize: 13, fontWeight: 600, cursor: status === "idle" ? "pointer" : "wait",
             display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "0.2s"
          }} 
       >
          {status === "idle" ? (
             <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Connect Board & Test Inference</>
          ) : status === "connecting" ? (
             <><svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(96, 165, 250, 0.3)" strokeWidth="3" fill="none"/><path d="M12 2A10 10 0 0 1 22 12" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" fill="none"/></svg> Connecting WebSerial...</>
          ) : (
             <><div style={{ width: 8, height: 8, background: '#60a5fa', borderRadius: '50%', boxShadow: '0 0 8px #60a5fa', animation: 'pulse 1s infinite' }} /> Live Inference Active</>
          )}
       </button>

       <div style={{ 
           flex: 1, marginTop: 24, background: "#0D0018", borderRadius: 8, border: "1px solid rgba(157,39,222,0.15)",
           overflow: "hidden", display: "flex", flexDirection: "column"
       }}>
           <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
               <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', fontFamily: 'JetBrains Mono' }}>DEVICE OUTPUT</span>
           </div>
           <div style={{ flex: 1, padding: 12, fontFamily: "JetBrains Mono, monospace", fontSize: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {status === "idle" && (
                  <div style={{ margin: 'auto', color: 'rgba(242,242,240,0.2)', textAlign: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8 }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      <br/>Load a model to test
                  </div>
              )}
              {output.map((out, i) => (
                  <div key={i} style={{ 
                      display: 'flex', justifyContent: 'space-between', padding: '6px 10px', 
                      background: i === 0 ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
                      borderRadius: 4, opacity: 1 - (i * 0.2), transition: 'all 0.3s'
                  }}>
                      <span style={{ color: "rgba(242,242,240,0.4)" }}>[{out.time}]</span>
                      <span style={{ color: "#F2F2F0", fontWeight: i === 0 ? 600 : 400 }}>{out.cls}</span>
                      <span style={{ color: out.conf > 0.9 ? "#22c55e" : "#eab308" }}>{(out.conf * 100).toFixed(1)}%</span>
                  </div>
              ))}
           </div>
       </div>
    </div>
  );
}
