import { useState } from 'react';
import { getBoardConfig } from '../boards/registry';
import { TASK_ARCHITECTURES, ML_ARCHITECTURES } from '../boards/MLCapabilities';
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";

export default function TrainingView({ projectId, boardId }: { projectId: string; boardId: string }) {
  const [task, setTask] = useState<string>("gesture");
  const [selectedArch, setSelectedArch] = useState<string>("");
  const [status, setStatus] = useState<"idle"|"training"|"done">("idle");
  const [loss, setLoss] = useState(1.0);
  const [acc, setAcc] = useState(0.0);
  const [epoch, setEpoch] = useState(0);

  const board = getBoardConfig(boardId);
  const TOTAL_EPOCHS = 20;

  const handleStartTraining = async () => {
     if (!selectedArch) return alert("Select an architecture");
     const arch = ML_ARCHITECTURES[selectedArch];
     
     if (arch.baseSizeKb > board.maxModelSizeKb) {
         return alert(`Model too large (${arch.baseSizeKb}KB). Board max is ${board.maxModelSizeKb}KB`);
     }

     setStatus("training");
     setLoss(1.0);
     setAcc(0.0);
     setEpoch(0);

     try {
       const jobRef = await addDoc(collection(db, "projects", projectId || "temp", "jobs"), {
           type: "training",
           arch: selectedArch,
           status: "running",
           startedAt: serverTimestamp()
       });

       const unsubscribe = onSnapshot(doc(db, "projects", projectId || "temp", "jobs", jobRef.id), (docSnap) => {
           if (docSnap.exists()) {
               const data = docSnap.data();
               if (data.epoch !== undefined) setEpoch(data.epoch);
               if (data.loss !== undefined) setLoss(data.loss);
               if (data.acc !== undefined) setAcc(data.acc);
               
               if (data.status === 'completed') {
                   setStatus('done');
                   unsubscribe();
               } else if (data.status === 'failed') {
                   setStatus('idle');
                   alert("Training failed in cloud: " + (data.error || "Unknown error"));
                   unsubscribe();
               }
           }
       });

     } catch (e: any) {
         setStatus("idle");
         console.error(e);
         alert("Could not start training job: " + e.message);
     }
  };

  const currentArch = selectedArch ? ML_ARCHITECTURES[selectedArch] : null;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
       
       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
           <div>
              <label style={{ fontSize: 11, color: "rgba(242,242,240,0.5)", display: "block", marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Type</label>
              <div style={{ position: 'relative' }}>
                  <select 
                      value={task} onChange={(e) => { setTask(e.target.value); setSelectedArch(""); }}
                      disabled={status === 'training'}
                      style={{ 
                          width: '100%', padding: '10px 12px', fontSize: 13, background: "#0D0018", color: "#F2F2F0", 
                          border: "1px solid rgba(157,39,222,0.3)", borderRadius: 8, outline: "none", appearance: 'none',
                          opacity: status === 'training' ? 0.6 : 1
                      }}
                  >
                     {board.supportedMLTasks.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none', color: 'rgba(242,242,240,0.5)' }}><path d="m6 9 6 6 6-6"/></svg>
              </div>
           </div>

           <div>
              <label style={{ fontSize: 11, color: "rgba(242,242,240,0.5)", display: "block", marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Architecture</label>
              <div style={{ position: 'relative' }}>
                  <select 
                      value={selectedArch} onChange={(e) => setSelectedArch(e.target.value)}
                      disabled={status === 'training'}
                      style={{ 
                          width: '100%', padding: '10px 12px', fontSize: 13, background: "#0D0018", color: "#F2F2F0", 
                          border: "1px solid rgba(157,39,222,0.3)", borderRadius: 8, outline: "none", appearance: 'none',
                          opacity: status === 'training' ? 0.6 : 1
                      }}
                  >
                     <option value="">-- select model --</option>
                     {(TASK_ARCHITECTURES[task as keyof typeof TASK_ARCHITECTURES] || []).map(id => {
                         const arch = ML_ARCHITECTURES[id];
                         return <option key={id} value={id}>{arch.name} (~{arch.baseSizeKb}KB)</option>
                     })}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none', color: 'rgba(242,242,240,0.5)' }}><path d="m6 9 6 6 6-6"/></svg>
              </div>
           </div>
       </div>

       <button 
           onClick={handleStartTraining} 
           disabled={status === "training" || !selectedArch}
           style={{
               width: '100%', padding: '12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700,
               background: status === 'training' ? 'rgba(157,39,222,0.2)' : (!selectedArch ? 'rgba(157,39,222,0.1)' : '#9D27DE'),
               color: (!selectedArch && status !== 'training') ? 'rgba(242,242,240,0.4)' : '#fff',
               cursor: (status === 'training' || !selectedArch) ? 'not-allowed' : 'pointer',
               display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
               transition: 'all 0.2s', boxShadow: (!selectedArch || status === 'training') ? 'none' : '0 0 16px rgba(157,39,222,0.4)'
           }}
       >
           {status === "training" ? (
               <><svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/></svg> Training in Cloud...</>
           ) : status === "done" ? (
               <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg> Retrain Model</>
           ) : "Start Cloud Training"}
       </button>

       {status !== "idle" && (
           <div style={{ marginTop: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
               
               <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.2)', borderRadius: 8, padding: 20 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                       <span style={{ fontSize: 12, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Epoch {epoch}/{TOTAL_EPOCHS}</span>
                       <span style={{ fontSize: 12, color: '#eab308', fontWeight: 600 }}>{Math.round((epoch/TOTAL_EPOCHS)*100)}%</span>
                   </div>
                   <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                       <div style={{ height: '100%', width: `${(epoch/TOTAL_EPOCHS)*100}%`, background: '#eab308', transition: 'width 0.4s ease-out', boxShadow: '0 0 10px #eab308' }} />
                   </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                   <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.15)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Categorical Loss</span>
                       <span style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono' }}>{loss.toFixed(4)}</span>
                   </div>
                   <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.15)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Validation Acc</span>
                       <span style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', fontFamily: 'JetBrains Mono' }}>{(acc * 100).toFixed(1)}%</span>
                   </div>
               </div>

               {status === "done" && (
                   <div style={{ marginTop: 'auto', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                       <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                       </div>
                       <div>
                           <p style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', margin: 0 }}>Model Ready!</p>
                           <p style={{ fontSize: 11, color: 'rgba(242,242,240,0.7)', margin: '2px 0 0' }}>Compiled {currentArch?.name} ({currentArch?.baseSizeKb}KB) for {board.name}. The block is now available.</p>
                       </div>
                   </div>
               )}
           </div>
       )}
    </div>
  );
}
