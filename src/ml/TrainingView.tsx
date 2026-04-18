import { useState, useEffect } from 'react';
import { getBoardConfig } from '../boards/registry';
import { TASK_ARCHITECTURES, ML_ARCHITECTURES } from '../boards/MLCapabilities';
import { db } from "../lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp, doc, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { useAppDialog } from "../contexts/DialogContext";

export default function TrainingView({ projectId, boardId, task, setTask, selectedArch, setSelectedArch }: { 
  projectId: string; 
  boardId: string;
  task: string;
  setTask: (t: string) => void;
  selectedArch: string;
  setSelectedArch: (a: string) => void;
}) {
  const { alert, prompt } = useAppDialog();
  const [status, setStatus] = useState<"idle"|"loading_data"|"training"|"converting"|"uploading"|"done">("idle");
  const [loss, setLoss] = useState(1.0);
  const [acc, setAcc] = useState(0.0);
  const [epoch, setEpoch] = useState(0);
  const [hyperparams, setHyperparams] = useState<Record<string, number | string>>({});
  const [cloudLabels, setCloudLabels] = useState<Record<string, number>>({});
  const [cloudTotal, setCloudTotal] = useState(0);
  const [modelInfo, setModelInfo] = useState<{ modelUrl?: string; headerUrl?: string; labels?: string[]; sizeBytes?: number } | null>(null);

  // Restore latest job state on mount
  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, "projects", projectId, "jobs"),
      where("type", "==", "training")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        // Sort in memory to avoid requiring a composite index
        const jobs = snap.docs
          .map(d => d.data())
          .filter(d => d.startedAt)
          .sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis());

        if (jobs.length > 0) {
          const data = jobs[0];
          if (data.status === 'loading_data') {
            setStatus('loading_data');
          } else if (data.status === 'training' || data.status === 'running') {
            setStatus('training');
            if (data.epoch !== undefined) setEpoch(data.epoch);
            if (data.loss !== undefined) setLoss(data.loss);
            if (data.acc !== undefined) setAcc(data.acc);
          } else if (data.status === 'converting') {
            setStatus('converting');
          } else if (data.status === 'uploading') {
            setStatus('uploading');
          } else if (data.status === 'completed') {
            setStatus('done');
            setModelInfo({
              modelUrl: data.modelUrl,
              headerUrl: data.headerUrl,
              labels: data.labels,
              sizeBytes: data.modelSizeBytes,
            });
          }
        }
      }
    });
    return () => unsub();
  }, [projectId]);

  useEffect(() => {
     if (selectedArch) {
         const arch = ML_ARCHITECTURES[selectedArch];
         if (arch && arch.hyperparameters) {
             const defaultParams: Record<string, string | number> = {};
             arch.hyperparameters.forEach(hp => defaultParams[hp.id] = hp.default);
             setHyperparams(defaultParams);
         }
     } else {
         setHyperparams({});
     }
  }, [selectedArch]);

  const board = getBoardConfig(boardId);
  const TOTAL_EPOCHS = Number(hyperparams.epochs) || 20;

  // Load cloud sample label distribution
  useEffect(() => {
     if (!projectId) return;
     getDocs(collection(db, "projects", projectId, "ml_samples")).then(snap => {
        const counts: Record<string, number> = {};
        snap.docs.forEach(d => {
           const data = d.data();
           const label = data.label || 'unknown';
           counts[label] = (counts[label] || 0) + 1;
        });
        setCloudLabels(counts);
        setCloudTotal(snap.size);
     }).catch(console.error);
  }, [projectId, status]);

  const handleStartTraining = async () => {
     if (!selectedArch) {
         await alert("Select an architecture");
         return;
     }
     const arch = ML_ARCHITECTURES[selectedArch];
     
     if (arch.baseSizeKb > board.maxModelSizeKb) {
         await alert(`Model too large (${arch.baseSizeKb}KB). Board max is ${board.maxModelSizeKb}KB`);
         return;
     }

     setStatus("training");
     setLoss(1.0);
     setAcc(0.0);
     setEpoch(0);
     setModelInfo(null);

     try {
       // 1. Create the job document in Firestore
       const jobRef = await addDoc(collection(db, "projects", projectId || "temp", "jobs"), {
           type: "training",
           arch: selectedArch,
           status: "running",
           startedAt: serverTimestamp()
       });

       // 2. Listen for real-time progress updates from the backend
       const unsubscribe = onSnapshot(doc(db, "projects", projectId || "temp", "jobs", jobRef.id), (docSnap) => {
           if (docSnap.exists()) {
               const data = docSnap.data();
               if (data.epoch !== undefined) setEpoch(data.epoch);
               if (data.loss !== undefined) setLoss(data.loss);
               if (data.acc !== undefined) setAcc(data.acc);
               
               if (data.status === 'completed') {
                   setStatus('done');
                   setModelInfo({
                       modelUrl: data.modelUrl,
                       headerUrl: data.headerUrl,
                       labels: data.labels,
                       sizeBytes: data.modelSizeBytes,
                   });
                   unsubscribe();
               } else if (data.status === 'failed') {
                   setStatus('idle');
                   alert(data.error || "Training failed");
               }
           }
       });

       // 3. Kick off the training service.
       // The server keeps the HTTP connection open for the full training
       // duration (streaming response to keep Cloud Run CPU alive).
       // We fire-and-forget — the Firestore listener handles all progress.
       const trainUrl = window.location.hostname === "localhost"
         ? "https://bitblock-ml-trainer-409440684176.us-central1.run.app/train"
         : "/.netlify/functions/train-model";
       fetch(trainUrl, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           projectId: projectId || "temp",
           jobId: jobRef.id,
           architecture: selectedArch,
           task,
           hyperparameters: hyperparams,
         }),
       }).catch((err) => {
         // Network errors are expected if the browser times out the
         // long-lived streaming connection.  Training still continues
         // on Cloud Run — the Firestore listener will pick up completion.
         console.warn("Training fetch ended:", err?.message);
       });

     } catch (e: any) {
         setStatus("idle");
         console.error(e);
         await alert("Could not start training job: " + e.message);
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
                      value={task} onChange={(e) => {
                         setTask(e.target.value);
                         const archs = TASK_ARCHITECTURES[e.target.value as keyof typeof TASK_ARCHITECTURES] || [];
                         setSelectedArch(archs.length > 0 ? archs[0] : "");
                       }}
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

       {currentArch && (
            <div style={{ 
                marginBottom: 24, padding: 16, background: "rgba(157,39,222,0.05)", borderRadius: 8, 
                border: "1px solid rgba(157,39,222,0.15)", display: "flex", flexDirection: "column", gap: 10 
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", textTransform: "uppercase" }}>Model Requirements</span>
                    <span style={{ fontSize: 10, background: "#9D27DE", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{currentArch.recommendedInput} Task</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)" }}>Expected Input</span>
                        <span style={{ fontSize: 12, color: "#F2F2F0", fontWeight: 600 }}>{currentArch.recommendedInput} Data</span>
                    </div>
                    {currentArch.recommendedInput === 'Image' && currentArch.inputResolution && (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)" }}>Target Resolution</span>
                            <span style={{ fontSize: 12, color: "#F2F2F0", fontWeight: 600 }}>{currentArch.inputResolution.width} x {currentArch.inputResolution.height} px</span>
                        </div>
                    )}
                </div>
                <p style={{ fontSize: 10, color: "rgba(242,242,240,0.5)", margin: 0, fontStyle: "italic" }}>
                    {currentArch.recommendedInput === 'Image' ? "Ensure all samples are cropped to 1:1 ratio. Our engine auto-resizes to target resolution." : "Ensure sensor stream is active before starting collection."}
                </p>
                
                {currentArch.hyperparameters && (
                    <div style={{ marginTop: 16, borderTop: "1px solid rgba(242,242,240,0.1)", paddingTop: 16 }}>
                        <span style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Hyperparameters</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {currentArch.hyperparameters.map(hp => (
                                <div key={hp.id} style={{ display: "flex", flexDirection: "column" }}>
                                    <label style={{ fontSize: 10, color: "rgba(242,242,240,0.5)", marginBottom: 4 }}>{hp.name}</label>
                                    {hp.type === "select" ? (
                                        <select 
                                            value={hyperparams[hp.id] !== undefined ? hyperparams[hp.id] : hp.default}
                                            onChange={(e) => setHyperparams(prev => ({ ...prev, [hp.id]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) }))}
                                            disabled={status === 'training'}
                                            style={{ padding: '6px 8px', fontSize: 11, background: "#0D0018", color: "#F2F2F0", border: "1px solid rgba(157,39,222,0.3)", borderRadius: 6, outline: "none" }}
                                        >
                                            {hp.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    ) : (
                                        <input 
                                            type="number"
                                            value={hyperparams[hp.id] !== undefined ? hyperparams[hp.id] : hp.default}
                                            min={hp.min} max={hp.max}
                                            onChange={(e) => setHyperparams(prev => ({ ...prev, [hp.id]: Number(e.target.value) }))}
                                            disabled={status === 'training'}
                                            style={{ padding: '6px 8px', fontSize: 11, background: "#0D0018", color: "#F2F2F0", border: "1px solid rgba(157,39,222,0.3)", borderRadius: 6, outline: "none" }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

       {/* Cloud Dataset Summary */}
       {cloudTotal > 0 && (
           <div style={{
               marginBottom: 16, padding: 12, background: 'rgba(59,130,246,0.05)', borderRadius: 8,
               border: '1px solid rgba(59,130,246,0.15)', display: 'flex', flexDirection: 'column', gap: 8
           }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.4)', textTransform: 'uppercase' }}>Cloud Dataset</span>
                   <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>{cloudTotal} samples · {Object.keys(cloudLabels).length} classes</span>
               </div>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                   {Object.entries(cloudLabels).sort((a, b) => a[0].localeCompare(b[0])).map(([label, count]) => (
                       <span key={label} style={{
                           fontSize: 10, padding: '3px 8px', borderRadius: 4,
                           background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                           color: '#93c5fd', fontFamily: 'JetBrains Mono'
                       }}>
                           {label} <strong>×{count}</strong>
                       </span>
                   ))}
               </div>
               {Object.keys(cloudLabels).length < 2 && currentArch?.type !== 'anomaly' && (
                   <p style={{ fontSize: 10, color: '#f59e0b', margin: 0 }}>⚠ Classification models need at least 2 different labels. Add more data.</p>
               )}
           </div>
       )}

       <button 
           onClick={handleStartTraining} 
           disabled={["loading_data", "training", "converting", "uploading"].includes(status) || !selectedArch}
           style={{
               width: '100%', padding: '12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700,
               background: ["loading_data", "training", "converting", "uploading"].includes(status) ? 'rgba(157,39,222,0.2)' : (!selectedArch ? 'rgba(157,39,222,0.1)' : '#9D27DE'),
               color: (!selectedArch && status === 'idle') ? 'rgba(242,242,240,0.4)' : '#fff',
               cursor: (["loading_data", "training", "converting", "uploading"].includes(status) || !selectedArch) ? 'not-allowed' : 'pointer',
               display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
               transition: 'all 0.2s', boxShadow: (!selectedArch || ["loading_data", "training", "converting", "uploading"].includes(status)) ? 'none' : '0 0 16px rgba(157,39,222,0.4)'
           }}
       >
           {["loading_data", "training", "converting", "uploading"].includes(status) ? (
               <><svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none"/></svg> Processing...</>
           ) : status === "done" ? (
               <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg> Retrain Model</>
           ) : "Start Cloud Training"}
       </button>

       {status !== "idle" && (
           <div style={{ marginTop: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
               
               <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.2)', borderRadius: 8, padding: 20 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                       <span style={{ fontSize: 12, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                           {status === "loading_data" && "Downloading Dataset..."}
                           {status === "training" && `Training Epoch ${epoch}/${TOTAL_EPOCHS}`}
                           {status === "converting" && "Exporting TFLite INT8..."}
                           {status === "uploading" && "Uploading to Cloud..."}
                           {status === "done" && "Training Complete"}
                       </span>
                       <span style={{ fontSize: 12, color: '#eab308', fontWeight: 600 }}>
                           {status === "loading_data" ? 10 : 
                            status === "training" ? Math.round(10 + ((epoch / TOTAL_EPOCHS) * 70)) : 
                            status === "converting" ? 85 : 
                            status === "uploading" ? 95 : 100}%
                       </span>
                   </div>
                   <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                       <div style={{ 
                           height: '100%', 
                           width: `${status === "loading_data" ? 10 : status === "training" ? (10 + ((epoch / TOTAL_EPOCHS) * 70)) : status === "converting" ? 85 : status === "uploading" ? 95 : 100}%`, 
                           background: '#eab308', transition: 'width 0.4s ease-out', boxShadow: '0 0 10px #eab308' 
                       }} />
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
                   <div style={{ marginTop: 'auto', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                           <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 }}>
                               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                           </div>
                           <div>
                               <p style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', margin: 0 }}>Model Ready!</p>
                               <p style={{ fontSize: 11, color: 'rgba(242,242,240,0.6)', margin: '2px 0 0' }}>
                                   {currentArch?.name} {modelInfo?.sizeBytes ? `· ${(modelInfo.sizeBytes / 1024).toFixed(1)} KB` : ''} {modelInfo?.labels ? `· ${modelInfo.labels.length} classes: ${modelInfo.labels.join(', ')}` : ''}
                               </p>
                           </div>
                       </div>
                       
                       <button
                           onClick={handleSaveModel}
                           style={{ width: '100%', padding: '10px', borderRadius: 6, background: '#22c55e', border: 'none', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, boxShadow: '0 4px 14px rgba(34,197,94,0.4)' }}
                       >
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                           Save Model to Library
                       </button>

                       <div style={{ display: 'flex', gap: 8 }}>
                           {modelInfo?.headerUrl && (
                               <a href={modelInfo.headerUrl} download target="_blank" rel="noreferrer"
                                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                                   ⬇ Download .h Header
                               </a>
                           )}
                           {modelInfo?.modelUrl && (
                               <a href={modelInfo.modelUrl} download target="_blank" rel="noreferrer"
                                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 11, fontWeight: 600, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                                   ⬇ Download .tflite Model
                               </a>
                           )}
                       </div>
                   </div>
               )}
           </div>
       )}
    </div>
  );
}
