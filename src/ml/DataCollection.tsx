import { useState, useRef } from 'react';
import { getBoardConfig } from '../boards/registry';
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function DataCollection({ projectId, boardId }: { projectId: string; boardId: string }) {
  const [dataLabel, setDataLabel] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [streamData, setStreamData] = useState<number[][]>([]);
  const board = getBoardConfig(boardId);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);

  const handleStop = async () => {
     setIsRecording(false);
     isCanceledRef.current = true;
     if (readerRef.current) {
        try {
            await readerRef.current.cancel();
        } catch(e) {}
     }
  };

  const handleRecord = async () => {
    if (!dataLabel) {
        alert('Enter a label first');
        return;
    }
    
    try {
        if (!portRef.current) {
            // @ts-ignore
            portRef.current = await navigator.serial.requestPort();
            await portRef.current.open({ baudRate: 115200 });
        }
        
        setIsRecording(true);
        isCanceledRef.current = false;
        setStreamData([]);
        
        // @ts-ignore
        const textDecoder = new TextDecoderStream();
        portRef.current.readable.pipeTo(textDecoder.writable).catch(() => {});
        const reader = textDecoder.readable.getReader();
        readerRef.current = reader;

        let localSamples = 0;
        let buffer = "";

        while (true) {
            if (isCanceledRef.current) break;
            const { value, done } = await reader.read();
            if (done || isCanceledRef.current) break;
            
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";
            
            for (const line of lines) {
                const parts = line.trim().split(',');
                if (parts.length >= 3) {
                    const features = parts.slice(0, 3).map(Number).filter(n => !isNaN(n));
                    if (features.length === 3) {
                       localSamples++;
                       setSamples(localSamples);
                       setStreamData(prev => {
                           const next = [...prev, features];
                           return next.length > 20 ? next.slice(next.length - 20) : next;
                       });
                       
                       if (projectId) {
                           addDoc(collection(db, "projects", projectId, "ml_samples"), {
                               label: dataLabel,
                               features,
                               createdAt: serverTimestamp()
                           }).catch(console.error);
                       }
                    }
                }
            }
        }
        setIsRecording(false);
    } catch (e: any) {
        if (e.name !== 'NotFoundError' && e.name !== 'NetworkError') {
           console.error("Serial error:", e);
           alert("Serial error: " + e.message);
        }
        setIsRecording(false);
    } finally {
        if (readerRef.current) {
            try { readerRef.current.releaseLock(); } catch(e) {}
            readerRef.current = null;
        }
    }
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
       
       <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(242,242,240,0.5)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: 11 }}>
                 <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
             </svg>
             <input 
                placeholder="Label (e.g. wave, idle)"
                value={dataLabel}
                onChange={(e) => setDataLabel(e.target.value)}
                disabled={isRecording}
                style={{
                   width: '100%', background: '#0D0018', border: '1px solid rgba(157,39,222,0.3)',
                   color: '#F2F2F0', padding: '10px 12px 10px 34px', fontSize: 13, borderRadius: 8,
                   outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s',
                   opacity: isRecording ? 0.6 : 1
                }}
             />
          </div>
          <button 
             onClick={isRecording ? handleStop : handleRecord}
             disabled={!isRecording && !dataLabel}
             style={{
                background: isRecording ? '#EF4444' : (!dataLabel ? 'rgba(157,39,222,0.3)' : '#9D27DE'), 
                color: '#fff',
                padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', 
                cursor: (!isRecording && !dataLabel) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, transition: '0.2s',
                boxShadow: isRecording ? '0 0 12px rgba(239, 68, 68, 0.4)' : (!dataLabel ? 'none' : '0 0 12px rgba(157, 39, 222, 0.4)')
             }}
          >
             {isRecording ? (
                 <><div style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', animation: 'pulse 1s infinite' }} /> Stop Recording</>
             ) : (
                 <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg> Record MPU6050</>
             )}
          </button>
       </div>
       
       <div style={{ flex: 1, background: '#0D0018', borderRadius: 8, border: '1px solid rgba(157,39,222,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
               <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', fontFamily: 'JetBrains Mono' }}>LIVE SENSOR STREAM</span>
               <div style={{ display: 'flex', gap: 12 }}>
                   <span style={{ fontSize: 10, color: '#ef4444' }}>■ Acc X</span>
                   <span style={{ fontSize: 10, color: '#22c55e' }}>■ Acc Y</span>
                   <span style={{ fontSize: 10, color: '#3b82f6' }}>■ Acc Z</span>
               </div>
           </div>
           
           <div style={{ flex: 1, position: 'relative', padding: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
               {streamData.length === 0 && !isRecording && (
                   <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(242,242,240,0.2)', fontSize: 12 }}>
                       Connect board and press Record to see data...
                   </div>
               )}
               {streamData.map((d, i) => {
                   const hx = Math.min(100, Math.max(0, (d[0] + 16384) / 327.68)); 
                   const hy = Math.min(100, Math.max(0, (d[1] + 16384) / 327.68)); 
                   const hz = Math.min(100, Math.max(0, (d[2] + 16384) / 327.68));
                   return (
                     <div key={i} style={{ flex: 1, display: 'flex', gap: 1, alignItems: 'flex-end', height: '100%' }}>
                         <div style={{ flex: 1, background: '#ef4444', height: `${hx}%`, opacity: 0.8, borderRadius: '2px 2px 0 0' }} />
                         <div style={{ flex: 1, background: '#22c55e', height: `${hy}%`, opacity: 0.8, borderRadius: '2px 2px 0 0' }} />
                         <div style={{ flex: 1, background: '#3b82f6', height: `${hz}%`, opacity: 0.8, borderRadius: '2px 2px 0 0' }} />
                     </div>
                   );
               })}
           </div>
       </div>

       <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ padding: '6px 12px', background: 'rgba(157,39,222,0.1)', borderRadius: 20, border: '1px solid rgba(157,39,222,0.2)' }}>
                   <span style={{ fontSize: 12, color: '#E0D8F0', fontWeight: 600 }}>{samples}</span>
                   <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', marginLeft: 6 }}>Samples</span>
               </div>
           </div>
           
           {!board.mlSupport && (
               <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,0.1)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                   {board.name} has no native ML capability registered.
               </div>
           )}
       </div>
    </div>
  );
}
