import { useState, useEffect, useRef } from 'react';
import { useAppDialog } from '../contexts/DialogContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { Upload, Wifi, Image as ImageIcon, FileText, BarChart3, Loader2, AlertCircle } from 'lucide-react';

interface Prediction { label: string; confidence: number; cx?: number; cy?: number; }
interface TrainedJob { id: string; arch: string; labels: string[]; modelUrl?: string; status: string; }

export default function TestingView({
  projectId,
  architecture,
  inferenceJobId,
}: {
  projectId?: string;
  architecture?: string;
  /** When set, inference uses this job instead of the latest completed model for the pipeline architecture. */
  inferenceJobId?: string | null;
}) {
  const { alert } = useAppDialog();
  const [tab, setTab] = useState<"upload" | "serial">("upload");

  // Upload test state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predicting, setPredicting] = useState(false);
  const [latestJob, setLatestJob] = useState<TrainedJob | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Serial test state
  const [serialStatus, setSerialStatus] = useState<"idle" | "connecting" | "testing">("idle");
  const [serialOutput, setSerialOutput] = useState<Array<{ time: string, cls: string, conf: number }>>([]);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);

  const asMillis = (v: any) => {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (v.seconds) return Number(v.seconds) * 1000;
    const n = new Date(v).getTime();
    return Number.isFinite(n) ? n : 0;
  };

  // Load model: pinned job id, or latest completed for architecture
  useEffect(() => {
    if (!projectId) {
      setLatestJob(null);
      setLoadingJob(false);
      setJobError("No project selected.");
      return;
    }
    setLoadingJob(true);
    setJobError(null);

    if (inferenceJobId) {
      const jobRef = doc(db, "projects", projectId, "jobs", inferenceJobId);
      const unsub = onSnapshot(
        jobRef,
        (snap) => {
          if (!snap.exists()) {
            setLatestJob(null);
            setJobError("Selected model job was not found.");
            setLoadingJob(false);
            return;
          }
          const data = snap.data();
          if (data.type !== "training" || data.status !== "completed") {
            setLatestJob(null);
            setJobError("This job is not a completed training run.");
            setLoadingJob(false);
            return;
          }
          setLatestJob({ id: snap.id, ...data } as TrainedJob);
          setJobError(null);
          setLoadingJob(false);
        },
        (err) => {
          console.error("Testing pinned job listener failed:", err);
          setJobError(err?.message || "Could not load selected model.");
          setLatestJob(null);
          setLoadingJob(false);
        },
      );
      return () => unsub();
    }

    const baseCollection = collection(db, "projects", projectId, "jobs");
    try {
      const q = architecture
        ? query(
            baseCollection,
            where("type", "==", "training"),
            where("status", "==", "completed"),
            where("arch", "==", architecture),
          )
        : query(
            baseCollection,
            where("type", "==", "training"),
            where("status", "==", "completed"),
          );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const docs = snap.docs
            .slice()
            .sort((a, b) => asMillis(b.data().startedAt) - asMillis(a.data().startedAt));
          if (docs.length > 0) {
            const d = docs[0];
            setLatestJob({ id: d.id, ...d.data() } as TrainedJob);
          } else {
            setLatestJob(null);
          }
          setLoadingJob(false);
        },
        (err) => {
          console.error("Testing model listener failed:", err);
          setJobError(err?.message || "Could not load latest trained model.");
          setLatestJob(null);
          setLoadingJob(false);
        }
      );
      return () => unsub();
    } catch (err: any) {
      console.error("Testing query setup failed:", err);
      setJobError(err?.message || "Could not initialize model query.");
      setLoadingJob(false);
      setLatestJob(null);
      return;
    }
  }, [projectId, architecture, inferenceJobId]);

  useEffect(() => {
    return () => {
      isCanceledRef.current = true;
      if (readerRef.current) { try { readerRef.current.cancel(); } catch(e) {} }
    };
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setPredictions([]);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handlePredict = async () => {
    if (!file || !projectId || !latestJob) return;
    setPredicting(true);
    setPredictions([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);
      formData.append('jobId', latestJob.id);

      const predictUrl = window.location.hostname === "localhost"
        ? "https://bitblock-ml-trainer-409440684176.us-central1.run.app/predict"
        : "/.netlify/functions/predict-model";

      const res = await fetch(predictUrl, { method: 'POST', body: formData });
      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!res.ok) {
        const serverMessage = data?.error || data?.message;
        const textPreview = raw ? raw.replace(/\s+/g, " ").slice(0, 160) : "";
        throw new Error(serverMessage || `Prediction failed (${res.status}). ${textPreview || "Unexpected response from server."}`);
      }
      if (!data || !Array.isArray(data.predictions)) {
        throw new Error("Prediction endpoint returned an invalid response payload.");
      }
      setPredictions(data.predictions || []);
    } catch (e: any) {
      await alert('Prediction failed: ' + (e.message || 'Unknown error'));
    } finally {
      setPredicting(false);
    }
  };

  // Serial inference (existing logic)
  const handleSerialTest = async () => {
    setSerialStatus("connecting");
    try {
      if (!portRef.current) {
        // @ts-ignore
        portRef.current = await navigator.serial.requestPort();
        await portRef.current.open({ baudRate: 115200 });
      }
      setSerialStatus("testing");
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
          let cls = "unknown"; let conf = 0;
          if (cleaned.includes(':')) {
            const parts = cleaned.split(':');
            cls = parts[0].replace('[INFERENCE]', '').trim();
            conf = parseFloat(parts[1]);
          } else {
            const numbers = cleaned.split(',').map(Number).filter(n => !isNaN(n));
            if (numbers.length > 0) { cls = `Class_${numbers.indexOf(Math.max(...numbers))}`; conf = Math.max(...numbers); }
            else continue;
          }
          if (!isNaN(conf)) {
            const time = new Date().toISOString().split('T')[1].slice(0, 8);
            setSerialOutput(prev => [{ time, cls, conf }, ...prev].slice(0, 5));
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'NotFoundError' && e.name !== 'NetworkError') {
        await alert("Inference serial error: " + e.message);
      }
      setSerialStatus("idle");
    } finally {
      if (readerRef.current) { try { readerRef.current.releaseLock(); } catch(e) {} readerRef.current = null; }
    }
  };

  const topPrediction = predictions.length > 0 ? predictions[0] : null;
  const maxConf = predictions.length > 0 ? Math.max(...predictions.map(p => p.confidence)) : 0;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', gap: 16 }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 3, border: '1px solid rgba(157,39,222,0.15)' }}>
        <button onClick={() => setTab("upload")} style={{
          flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: tab === "upload" ? 'rgba(157,39,222,0.2)' : 'transparent',
          color: tab === "upload" ? '#F2F2F0' : 'rgba(242,242,240,0.4)', transition: '0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Upload size={14} /> Upload Test
        </button>
        <button onClick={() => setTab("serial")} style={{
          flex: 1, padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          background: tab === "serial" ? 'rgba(157,39,222,0.2)' : 'transparent',
          color: tab === "serial" ? '#F2F2F0' : 'rgba(242,242,240,0.4)', transition: '0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Wifi size={14} /> Serial Test
        </button>
      </div>

      {/* Upload Test Tab */}
      {tab === "upload" && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Model Info */}
          {loadingJob ? (
            <div style={{ padding: 12, background: 'rgba(59,130,246,0.05)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} style={{ color: '#60a5fa', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)' }}>Loading model info...</span>
            </div>
          ) : jobError ? (
            <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} style={{ color: '#f87171' }} />
              <span style={{ fontSize: 11, color: '#f87171' }}>{jobError}</span>
            </div>
          ) : latestJob ? (
            <div style={{ padding: 10, background: 'rgba(34,197,94,0.05)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Model Ready</span>
                <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.4)', marginLeft: 8 }}>
                  {latestJob.arch} · {latestJob.labels?.length || 0} classes: {latestJob.labels?.join(', ')}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12, background: 'rgba(245,158,11,0.05)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: 11, color: '#f59e0b' }}>No trained model found. Train a model first in the Training tab.</span>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: preview ? 0 : 1, minHeight: preview ? 80 : 120,
              background: dragOver ? 'rgba(157,39,222,0.1)' : 'rgba(0,0,0,0.2)',
              border: `2px dashed ${dragOver ? '#9D27DE' : 'rgba(157,39,222,0.2)'}`,
              borderRadius: 10, cursor: 'pointer', transition: '0.2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16,
            }}
          >
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {file.type.startsWith('image/') ? <ImageIcon size={18} style={{ color: '#9D27DE' }} /> : <FileText size={18} style={{ color: '#9D27DE' }} />}
                <div>
                  <p style={{ fontSize: 12, color: '#F2F2F0', fontWeight: 600, margin: 0 }}>{file.name}</p>
                  <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.4)', margin: '2px 0 0' }}>{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              </div>
            ) : (
              <>
                <Upload size={24} style={{ color: 'rgba(157,39,222,0.4)' }} />
                <p style={{ fontSize: 12, color: 'rgba(242,242,240,0.4)', margin: 0, textAlign: 'center' }}>
                  Drop an image here or click to upload
                </p>
                <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.25)', margin: 0 }}>Supports JPG, PNG, BMP</p>
              </>
            )}
          </div>
          <input type="file" ref={fileInputRef} accept="image/*,.csv,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: 'none' }} />

          {/* Image preview */}
          {preview && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 8, background: '#050008', borderRadius: 8, border: '1px solid rgba(157,39,222,0.1)' }}>
              <img src={preview} alt="Preview" style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }} />
            </div>
          )}

          {/* Predict button */}
          <button
            onClick={handlePredict}
            disabled={!file || !latestJob || predicting}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
              background: (!file || !latestJob || predicting) ? 'rgba(157,39,222,0.15)' : 'linear-gradient(135deg, #9D27DE, #B94FF0)',
              color: (!file || !latestJob) ? 'rgba(242,242,240,0.3)' : '#fff',
              cursor: (!file || !latestJob || predicting) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: '0.2s',
              boxShadow: (file && latestJob && !predicting) ? '0 0 16px rgba(157,39,222,0.3)' : 'none',
            }}
          >
            {predicting ? (
              <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running Inference...</>
            ) : (
              <><BarChart3 size={14} /> Run Prediction</>
            )}
          </button>

          {/* Prediction Results */}
          {predictions.length > 0 && (
            <div style={{ background: '#0D0018', borderRadius: 10, border: '1px solid rgba(157,39,222,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(157,39,222,0.05)', borderBottom: '1px solid rgba(157,39,222,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.5)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono', letterSpacing: '0.05em' }}>Prediction Results</span>
                {topPrediction && (
                  <span style={{ fontSize: 11, color: topPrediction.confidence > 0.8 ? '#4ade80' : '#eab308', fontWeight: 700 }}>
                    {topPrediction.label}
                    {topPrediction.cx != null && topPrediction.cy != null
                      ? ` @ (${(topPrediction.cx * 100).toFixed(0)}%, ${(topPrediction.cy * 100).toFixed(0)}%)`
                      : ""}{" "}
                    — {(topPrediction.confidence * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {predictions.map((pred, i) => (
                  <div key={pred.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: i === 0 ? '#F2F2F0' : 'rgba(242,242,240,0.5)', fontWeight: i === 0 ? 700 : 400, minWidth: 72, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {pred.label}
                      {pred.cx != null && pred.cy != null ? (
                        <span style={{ fontWeight: 400, color: 'rgba(242,242,240,0.45)' }}>{` (${(pred.cx * 100).toFixed(0)}%,${(pred.cy * 100).toFixed(0)}%)`}</span>
                      ) : null}
                    </span>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${(pred.confidence / maxConf) * 100}%`,
                        background: i === 0
                          ? (pred.confidence > 0.8 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : 'linear-gradient(90deg, #eab308, #fbbf24)')
                          : 'rgba(157,39,222,0.3)',
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: i === 0 ? `0 0 8px ${pred.confidence > 0.8 ? '#22c55e' : '#eab308'}` : 'none',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: i === 0 ? (pred.confidence > 0.8 ? '#4ade80' : '#eab308') : 'rgba(242,242,240,0.4)', fontFamily: 'JetBrains Mono', width: 45, textAlign: 'right', flexShrink: 0 }}>
                      {(pred.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Serial Test Tab */}
      {tab === "serial" && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleSerialTest}
            disabled={serialStatus !== "idle"}
            style={{
              width: "100%", padding: 12, borderRadius: 8,
              background: serialStatus === "idle" ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.05)",
              border: serialStatus === "idle" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid rgba(59, 130, 246, 0.1)",
              color: serialStatus === "idle" ? "#60a5fa" : "rgba(96, 165, 250, 0.5)",
              fontSize: 13, fontWeight: 600, cursor: serialStatus === "idle" ? "pointer" : "wait",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "0.2s"
            }}
          >
            {serialStatus === "idle" ? (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Connect Board & Test Inference</>
            ) : serialStatus === "connecting" ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#60a5fa' }} /> Connecting WebSerial...</>
            ) : (
              <><div style={{ width: 8, height: 8, background: '#60a5fa', borderRadius: '50%', boxShadow: '0 0 8px #60a5fa', animation: 'pulse 1s infinite' }} /> Live Inference Active</>
            )}
          </button>

          <div style={{ flex: 1, background: "#0D0018", borderRadius: 8, border: "1px solid rgba(157,39,222,0.15)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', fontFamily: 'JetBrains Mono' }}>DEVICE OUTPUT</span>
            </div>
            <div style={{ flex: 1, padding: 12, fontFamily: "JetBrains Mono, monospace", fontSize: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {serialStatus === "idle" && serialOutput.length === 0 && (
                <div style={{ margin: 'auto', color: 'rgba(242,242,240,0.2)', textAlign: 'center' }}>
                  <Wifi size={24} style={{ marginBottom: 8 }} /><br/>Load a model to test
                </div>
              )}
              {serialOutput.map((out, i) => (
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
      )}
    </div>
  );
}
