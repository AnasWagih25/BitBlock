import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  deleteField,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAppDialog } from "../contexts/DialogContext";
import { Loader2, Trash2, FlaskConical, CheckCircle2, Database } from "lucide-react";

export type CompletedTrainingJob = {
  id: string;
  arch?: string;
  task?: string;
  status?: string;
  startedAt?: unknown;
  completedAt?: unknown;
  labels?: string[];
  metrics?: Record<string, number>;
  modelSizeBytes?: number;
  hyperparameters?: Record<string, unknown>;
  datasetSnapshot?: {
    expectedDataType?: string;
    samplesUsed?: number;
    totalSamplesInProject?: number;
    labelCountsTraining?: Record<string, number>;
  };
};

function asMillis(v: unknown) {
  if (!v) return 0;
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof (v as { toMillis: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  if (typeof v === "object" && v !== null && "seconds" in v) {
    const s = (v as { seconds: number }).seconds;
    return Number(s) * 1000;
  }
  const n = new Date(v as string | number).getTime();
  return Number.isFinite(n) ? n : 0;
}

function formatWhen(job: CompletedTrainingJob) {
  const t = asMillis(job.completedAt) || asMillis(job.startedAt);
  if (!t) return "—";
  return new Date(t).toLocaleString();
}

function formatMetrics(m?: Record<string, number>) {
  if (!m || typeof m !== "object") return "—";
  const parts = Object.entries(m)
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(4) : v}`);
  return parts.length ? parts.join(" · ") : "—";
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

type Props = {
  projectId: string;
  pipelineArchitecture?: string;
  activeJobId?: string | null;
  onTestModel: (jobId: string) => void;
};

export default function ModelRegistry({ projectId, pipelineArchitecture, activeJobId, onTestModel }: Props) {
  const { alert, confirm } = useAppDialog();
  const [jobs, setJobs] = useState<CompletedTrainingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const q = query(
      collection(db, "projects", projectId, "jobs"),
      where("type", "==", "training"),
      where("status", "==", "completed"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CompletedTrainingJob))
          .sort((a, b) => asMillis(b.completedAt || b.startedAt) - asMillis(a.completedAt || a.startedAt));
        setJobs(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err?.message || "Could not load model versions.");
        setJobs([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [projectId]);

  const handleUse = async (jobId: string) => {
    try {
      await updateDoc(doc(db, "projects", projectId), { mlActiveTrainingJobId: jobId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await alert("Could not set active model: " + msg);
    }
  };

  const handleDelete = async (job: CompletedTrainingJob) => {
    const ok = await confirm(
      `Remove this trained model from the registry?\n\n${shortId(job.id)} · ${job.arch || "?"}\n\nThe Cloud Storage files are not deleted automatically; only the Firestore job record is removed.`,
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "projects", projectId, "jobs", job.id));
      if (activeJobId === job.id) {
        await updateDoc(doc(db, "projects", projectId), { mlActiveTrainingJobId: deleteField() });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await alert("Delete failed: " + msg);
    }
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#F2F2F0" }}>Model versions</h3>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(242,242,240,0.45)", lineHeight: 1.5 }}>
            Every completed training run is listed here. Set which model the workspace and inference use, open it in the test tab, or remove it from the registry.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "rgba(157,39,222,0.08)", border: "1px solid rgba(157,39,222,0.2)" }}>
          <Database size={14} style={{ color: "#c084fc" }} />
          <span style={{ fontSize: 10, color: "rgba(242,242,240,0.55)" }}>{jobs.length} saved</span>
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(242,242,240,0.5)", fontSize: 12 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          Loading versions…
        </div>
      )}
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", fontSize: 12 }}>
          {error}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div style={{ padding: 20, textAlign: "center", color: "rgba(242,242,240,0.35)", fontSize: 12 }}>
          No completed models yet. Train one in the Training tab.
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {jobs.map((job) => {
          const isActive = activeJobId === job.id;
          const archMismatch =
            pipelineArchitecture && job.arch && job.arch !== pipelineArchitecture;
          const ds = job.datasetSnapshot;
          const sampleLine =
            ds?.samplesUsed != null
              ? `${ds.samplesUsed} samples used${ds.totalSamplesInProject != null ? ` (${ds.totalSamplesInProject} in project)` : ""}`
              : job.labels?.length != null
                ? `${job.labels.length} classes`
                : "—";

          return (
            <div
              key={job.id}
              style={{
                borderRadius: 10,
                border: `1px solid ${isActive ? "rgba(74,222,128,0.35)" : "rgba(157,39,222,0.15)"}`,
                background: isActive ? "rgba(34,197,94,0.06)" : "rgba(0,0,0,0.2)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#e9d5ff" }}>{shortId(job.id)}</span>
                    {isActive && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={12} /> Active
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: "rgba(242,242,240,0.55)" }}>
                    <strong style={{ color: "#F2F2F0" }}>{job.arch || "?"}</strong>
                    {job.task ? ` · ${job.task}` : ""}
                    {archMismatch ? (
                      <span style={{ marginLeft: 8, color: "#fbbf24" }}>(pipeline arch: {pipelineArchitecture})</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(242,242,240,0.4)", marginTop: 4 }}>{formatWhen(job)}</div>
                </div>
                <div style={{ display: "flex", flexShrink: 0, gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 11 }}
                    onClick={() => handleUse(job.id)}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                    onClick={() => onTestModel(job.id)}
                  >
                    <FlaskConical size={12} /> Test
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 11, color: "#f87171", display: "flex", alignItems: "center", gap: 4 }}
                    onClick={() => void handleDelete(job)}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 10, color: "rgba(242,242,240,0.45)", lineHeight: 1.5 }}>
                <div>
                  <span style={{ color: "rgba(242,242,240,0.35)" }}>Dataset: </span>
                  {sampleLine}
                  {ds?.expectedDataType ? ` · type: ${ds.expectedDataType}` : ""}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: "rgba(242,242,240,0.35)" }}>Metrics: </span>
                  {formatMetrics(job.metrics)}
                </div>
                {job.modelSizeBytes != null && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ color: "rgba(242,242,240,0.35)" }}>TFLite size: </span>
                    {(job.modelSizeBytes / 1024).toFixed(1)} KB
                  </div>
                )}
                
                {expandedJobId === job.id && (
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                     {job.labels && job.labels.length > 0 && (
                       <div style={{ marginBottom: 8, wordBreak: "break-word" }}>
                         <span style={{ color: "rgba(242,242,240,0.35)", fontWeight: 700, display: 'block', marginBottom: 2 }}>Labels: </span>
                         {job.labels.join(", ")}
                       </div>
                     )}
                     {job.hyperparameters && Object.keys(job.hyperparameters).length > 0 && (
                       <div style={{ marginBottom: 8 }}>
                         <span style={{ color: "rgba(242,242,240,0.35)", fontWeight: 700, display: 'block', marginBottom: 2 }}>Hyperparameters: </span>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 4 }}>
                           {Object.entries(job.hyperparameters).map(([k, v]) => (
                             <div key={k}>
                               <span style={{ color: 'rgba(157,39,222,0.8)' }}>{k}</span>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                     {job.metrics && Object.keys(job.metrics).length > 0 && (
                       <div style={{ marginBottom: 8 }}>
                         <span style={{ color: "rgba(242,242,240,0.35)", fontWeight: 700, display: 'block', marginBottom: 2 }}>All Metrics: </span>
                         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 4 }}>
                           {Object.entries(job.metrics).map(([k, v]) => (
                             <div key={k}>
                               <span style={{ color: '#4ade80' }}>{k}</span>: {typeof v === 'number' ? v.toFixed(5) : String(v)}
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                     {ds?.labelCountsTraining && Object.keys(ds.labelCountsTraining).length > 0 && (
                       <div>
                         <span style={{ color: "rgba(242,242,240,0.35)", fontWeight: 700, display: 'block', marginBottom: 2 }}>Training Distribution: </span>
                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                           {Object.entries(ds.labelCountsTraining).map(([k, v]) => (
                             <div key={k} style={{ display: 'flex', gap: 4 }}>
                               <span style={{ color: '#E9D5FF' }}>{k}</span>
                               <span style={{ color: 'rgba(242,242,240,0.5)' }}>: {v}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                  </div>
                )}
                
                <div style={{ marginTop: 8 }}>
                  <button 
                    onClick={() => setExpandedJobId(prev => prev === job.id ? null : job.id)}
                    style={{ background: 'none', border: 'none', color: '#c084fc', fontSize: 10, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    {expandedJobId === job.id ? "Hide complete stats" : "View complete stats"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
