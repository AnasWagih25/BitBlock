import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from "react-router-dom";
import { getBoardConfig } from '../boards/registry';
import { TASK_ARCHITECTURES, ML_ARCHITECTURES, type MLTask } from '../boards/MLCapabilities';
import { getAutoMLPreset } from './edgeAutoPreset';
import { db, storage } from "../lib/firebase";
import { auth } from "../lib/firebase";
import { collection, addDoc, getDocs, serverTimestamp, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAppDialog } from "../contexts/DialogContext";
import { useAuth } from "../contexts/AuthContext";

interface TrainingMetrics {
  val_loss?: number;
  val_accuracy?: number;
  val_binary_accuracy?: number;
  macro_dice?: number;
  macro_f1?: number;
  precision_macro?: number;
  recall_macro?: number;
  weighted_f1?: number;
  balanced_accuracy?: number;
  top2_accuracy?: number;
  mse?: number;
}

interface ClassMetric {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

interface ConfusionPair {
  true_label: string;
  pred_label: string;
  count: number;
  row_error_rate: number;
}

interface HardExample {
  sampleId?: string;
  imageUrl?: string;
  true_label: string;
  pred_label: string;
  pred_confidence: number;
  true_confidence: number;
}

interface ConfidenceBin {
  bin: string;
  correct: number;
  incorrect: number;
}

interface TrainHistoryPoint {
  epoch: number;
  loss: number;
  accuracy: number;
  val_loss?: number | null;
  val_accuracy?: number | null;
  lr: number;
}

interface TrainingDiagnostics {
  fomo_grid?: { height: number; width: number; stride: number };
  dataset?: {
    total_samples?: number;
    train_samples?: number;
    val_samples?: number;
    labels?: string[];
  };
  per_class?: ClassMetric[];
  hard_examples?: HardExample[];
  confusion_pairs?: ConfusionPair[];
  confidence_histogram?: ConfidenceBin[];
  train_history?: TrainHistoryPoint[];
  reconstruction?: {
    val_mse?: number;
    val_mae?: number;
    threshold_p95?: number;
  };
}

interface ModelInfo {
  modelUrl?: string;
  headerUrl?: string;
  labels?: string[];
  sizeBytes?: number;
  confusionMatrix?: number[][];
  metrics?: TrainingMetrics;
  diagnostics?: TrainingDiagnostics;
  jobId?: string;
}

interface TrainingDatasetOption {
  id: string;
  name: string;
  sampleIds: string[];
  architecture?: string;
}

function coerceSampleIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      ),
    ];
  }
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const vals = Object.values(raw as Record<string, unknown>);
    return [
      ...new Set(
        vals.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
      ),
    ];
  }
  return [];
}

export default function TrainingView({ projectId, boardId, task, setTask, selectedArch, setSelectedArch, onGoToCollect, canStartTraining, trainingBlockReason, incrementTrainingCount }: { 
  projectId: string; 
  boardId: string;
  task: string;
  setTask: (t: string) => void;
  selectedArch: string;
  setSelectedArch: (a: string) => void;
  onGoToCollect?: () => void;
  canStartTraining?: boolean;
  trainingBlockReason?: string | null;
  incrementTrainingCount?: () => Promise<void>;
}) {
  const { isBetaMode } = useAuth();
  const { alert } = useAppDialog();
  const [status, setStatus] = useState<"idle"|"loading_data"|"training"|"converting"|"uploading"|"done">("idle");
  const [loss, setLoss] = useState(1.0);
  const [acc, setAcc] = useState(0.0);
  const [epoch, setEpoch] = useState(0);
  const [hyperparams, setHyperparams] = useState<Record<string, number | string>>({});
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [autoNote, setAutoNote] = useState("");
  const [cloudLabels, setCloudLabels] = useState<Record<string, number>>({});
  const [cloudTotal, setCloudTotal] = useState(0);
  const [trainingDatasets, setTrainingDatasets] = useState<TrainingDatasetOption[]>([]);
  const [selectedTrainingDatasetIds, setSelectedTrainingDatasetIds] = useState<string[]>([]);
  const trainingDatasetSelectionInitKey = useRef("");
  const activeJobStorageKey = `active_training_job_${projectId || "temp"}`;
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelRequirementsExpanded, setModelRequirementsExpanded] = useState(true);
  const [replacingSampleId, setReplacingSampleId] = useState<string | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const pendingReplaceSampleIdRef = useRef<string | null>(null);

  // Resume only jobs started from this tab/session.
  // This prevents the Training tab from auto-attaching to an old "running" job
  // and looking like training started by itself on open.
  useEffect(() => {
    if (!projectId) return;
    const activeJobId = sessionStorage.getItem(activeJobStorageKey);
    if (!activeJobId) {
      setStatus("idle");
      return;
    }
    const unsub = onSnapshot(doc(db, "projects", projectId, "jobs", activeJobId), (jobSnap) => {
      if (!jobSnap.exists()) {
        sessionStorage.removeItem(activeJobStorageKey);
        setStatus("idle");
        return;
      }
      const data = jobSnap.data();
      if (data.status === "loading_data") {
        setStatus("loading_data");
      } else if (data.status === "training" || data.status === "running") {
        setStatus("training");
        if (data.epoch !== undefined) setEpoch(data.epoch);
        if (data.loss !== undefined) setLoss(data.loss);
        if (data.acc !== undefined) setAcc(data.acc);
      } else if (data.status === "converting") {
        setStatus("converting");
      } else if (data.status === "uploading") {
        setStatus("uploading");
      } else if (data.status === "completed") {
        sessionStorage.removeItem(activeJobStorageKey);
        if (sessionStorage.getItem(`dismissed_job_${activeJobId}`)) {
          setStatus("idle");
        } else {
          setStatus("done");
          setModelInfo({
            jobId: activeJobId,
            modelUrl: data.modelUrl,
            headerUrl: data.headerUrl,
            labels: data.labels,
            sizeBytes: data.modelSizeBytes,
            metrics: data.metrics,
            diagnostics: data.diagnostics,
          });
        }
      } else if (data.status === "failed") {
        sessionStorage.removeItem(activeJobStorageKey);
        setStatus("idle");
      }
    });
    return () => unsub();
  }, [projectId, activeJobStorageKey]);

  const board = getBoardConfig(boardId);
  const TOTAL_EPOCHS = Number(hyperparams.epochs) || 20;

  useEffect(() => {
    if (!selectedArch) {
      setHyperparams({});
      return;
    }
    const arch = ML_ARCHITECTURES[selectedArch];
    if (!arch || !arch.hyperparameters) {
      setHyperparams({});
      return;
    }
    const defaultParams: Record<string, string | number> = {};
    arch.hyperparameters.forEach((hp) => {
      defaultParams[hp.id] = hp.default;
    });
    setHyperparams((prev) => ({ ...defaultParams, ...prev }));
  }, [selectedArch]);

  useEffect(() => {
    if (!autoOptimize) {
      setAutoNote("");
      return;
    }
    const taskKey = task as MLTask;
    if (!TASK_ARCHITECTURES[taskKey]) return;
    const isArchValid = selectedArch && (TASK_ARCHITECTURES[taskKey] || []).includes(selectedArch);
    const preset = getAutoMLPreset(taskKey, board, isArchValid ? selectedArch : undefined);
    setAutoNote(preset.note);
    if (preset.architecture && preset.architecture !== selectedArch) {
      setSelectedArch(preset.architecture);
    }
    setHyperparams((prev) => ({ ...prev, ...preset.hyperparameters }));
  }, [autoOptimize, task, board.id, board.maxModelSizeKb, selectedArch, setSelectedArch]);

  // Load cloud sample label distribution (filtered by current architecture input type)
  useEffect(() => {
     if (!projectId) return;
     const currentInputType = selectedArch ? ML_ARCHITECTURES[selectedArch]?.recommendedInput : null;
     getDocs(collection(db, "projects", projectId, "ml_samples")).then(snap => {
        const counts: Record<string, number> = {};
        let total = 0;
        snap.docs.forEach(d => {
           const data = d.data();
          // Filter by input type compatibility when an architecture is selected
          if (currentInputType) {
            const sampleType = (data.type || "").toLowerCase();
            const inputLower = currentInputType.toLowerCase();
            
            if (sampleType) {
              if (inputLower === "sensor" || inputLower === "imu") {
                if (sampleType !== "sensor" && sampleType !== "imu") return; // Skip non-sensor/IMU
              } else {
                if (!sampleType.includes(inputLower)) return; // Skip mismatch
              }
            }
          }
          const label = data.label || 'unknown';
           counts[label] = (counts[label] || 0) + 1;
           total++;
        });
        setCloudLabels(counts);
        setCloudTotal(total);
     }).catch(console.error);
  }, [projectId, status, selectedArch]);

  useEffect(() => {
    if (!projectId) {
      setTrainingDatasets([]);
      return;
    }
    const col = collection(db, "projects", projectId, "ml_datasets");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const rows: TrainingDatasetOption[] = snap.docs.map((d) => {
          const raw = d.data() as Record<string, unknown>;
          const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.replace(/Â·/g, '·').replace(/Ã—/g, '×').trim() : "(unnamed)";
          const arch = typeof raw.architecture === "string" ? raw.architecture : undefined;
          return { id: d.id, name, sampleIds: coerceSampleIds(raw.sampleIds), architecture: arch };
        });
        rows.sort((a, b) => a.name.localeCompare(b.name));
        setTrainingDatasets(rows);
      },
      (e) => console.error("ml_datasets listener (training) failed", e)
    );
    return () => unsub();
  }, [projectId]);

  // Filter datasets to only show those compatible with the selected architecture's input type
  const compatibleDatasets = useMemo(() => {
    if (!selectedArch) return trainingDatasets;
    const currentInputType = ML_ARCHITECTURES[selectedArch]?.recommendedInput;
    if (!currentInputType) return trainingDatasets;
    return trainingDatasets.filter((ds) => {
      // Datasets without an architecture field are considered legacy / universal
      if (!ds.architecture) return true;
      const dsInputType = ML_ARCHITECTURES[ds.architecture]?.recommendedInput;
      if (!dsInputType) return true;
      return dsInputType === currentInputType;
    });
  }, [trainingDatasets, selectedArch]);

  const incompatibleCount = trainingDatasets.length - compatibleDatasets.length;

  useEffect(() => {
    if (compatibleDatasets.length < 2) {
      setSelectedTrainingDatasetIds([]);
      trainingDatasetSelectionInitKey.current = "";
      return;
    }
    const key = compatibleDatasets.map((d) => d.id).join("|");
    if (trainingDatasetSelectionInitKey.current !== key) {
      trainingDatasetSelectionInitKey.current = key;
      setSelectedTrainingDatasetIds(compatibleDatasets.map((d) => d.id));
    }
  }, [compatibleDatasets]);

  const unionTrainingSampleCount = useMemo(() => {
    const ids = new Set<string>();
    for (const ds of compatibleDatasets) {
      if (!selectedTrainingDatasetIds.includes(ds.id)) continue;
      for (const sid of ds.sampleIds) ids.add(sid);
    }
    return ids.size;
  }, [compatibleDatasets, selectedTrainingDatasetIds]);

  const selectedTrainingSampleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ds of compatibleDatasets) {
      if (!selectedTrainingDatasetIds.includes(ds.id)) continue;
      for (const sid of ds.sampleIds) ids.add(sid);
    }
    return Array.from(ids);
  }, [compatibleDatasets, selectedTrainingDatasetIds]);

  const toggleTrainingDataset = (id: string) => {
    setSelectedTrainingDatasetIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const getTrainImageSize = () => {
    const arch = selectedArch ? ML_ARCHITECTURES[selectedArch] : null;
    return {
      w: arch?.inputResolution?.width ?? 96,
      h: arch?.inputResolution?.height ?? 96,
    };
  };

  async function resizeImageFileToBlob(file: File, tw: number, th: number): Promise<Blob> {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Could not read image"));
        img.src = objUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");
      ctx.drawImage(img, 0, 0, tw, th);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (!blob) throw new Error("Could not encode JPEG");
      return blob;
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  }

  const refreshCloudSampleStats = () => {
    if (!projectId) return;
    getDocs(collection(db, "projects", projectId, "ml_samples"))
      .then((snap) => {
        const counts: Record<string, number> = {};
        snap.forEach((d) => {
          const data = d.data();
          const label = data.label || "unknown";
          counts[label] = (counts[label] || 0) + 1;
        });
        setCloudLabels(counts);
        setCloudTotal(snap.size);
      })
      .catch(console.error);
  };

  const startReplaceSampleImage = (sampleId: string | undefined) => {
    if (!sampleId) return;
    pendingReplaceSampleIdRef.current = sampleId;
    replaceFileInputRef.current?.click();
  };

  const onReplaceFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sampleId = pendingReplaceSampleIdRef.current;
    e.target.value = "";
    pendingReplaceSampleIdRef.current = null;
    if (!file || !sampleId || !projectId) return;
    if (!file.type.startsWith("image/")) {
      await alert("Please choose an image file (JPEG, PNG, …).");
      return;
    }
    setReplacingSampleId(sampleId);
    try {
      const { w, h } = getTrainImageSize();
      const blob = await resizeImageFileToBlob(file, w, h);
      const fileName = `${Date.now()}_replace_${sampleId}.jpg`;
      const fileRef = storageRef(storage, `projects/${projectId}/ml_data/${fileName}`);
      await uploadBytes(fileRef, blob);
      const downloadURL = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "projects", projectId, "ml_samples", sampleId), {
        imageUrl: downloadURL,
        resolution: { width: w, height: h },
        updatedAt: serverTimestamp(),
      });
      setModelInfo((prev) => {
        if (!prev?.diagnostics?.hard_examples) return prev;
        return {
          ...prev,
          diagnostics: {
            ...prev.diagnostics,
            hard_examples: prev.diagnostics.hard_examples.map((h) =>
              h.sampleId === sampleId ? { ...h, imageUrl: downloadURL } : h
            ),
          },
        };
      });
      refreshCloudSampleStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await alert("Replace failed: " + msg);
    } finally {
      setReplacingSampleId(null);
    }
  };

  const handleStartTraining = async () => {
     if (!selectedArch) {
         await alert("Select an architecture");
         return;
     }
     if (selectedTrainingDatasetIds.length < 2) {
       await alert("Select at least 2 saved datasets to train on. Create datasets in Data Collection → Cloud library.");
       return;
     }
     if (unionTrainingSampleCount < 1) {
       await alert("The selected datasets do not reference any samples. Add samples to your datasets first.");
       return;
     }
     const arch = ML_ARCHITECTURES[selectedArch];
     
     if (arch.baseSizeKb > board.maxModelSizeKb) {
         await alert(`Model too large (${arch.baseSizeKb}KB). Board max is ${board.maxModelSizeKb}KB`);
         return;
     }

     // ── Plan limit check ──
     if (canStartTraining === false) {
       await alert(trainingBlockReason || (isBetaMode ? "Training limit reached for today." : "Training limit reached. Upgrade your plan for more training jobs."));
       return;
     }

     setStatus("training");
     setLoss(1.0);
     setAcc(0.0);
     setEpoch(0);
     setModelInfo(null);

     try {
       // 1. Create the job document in Firestore
      const appliedHyperparams = { ...hyperparams, auto_optimize: autoOptimize };
       const jobRef = await addDoc(collection(db, "projects", projectId || "temp", "jobs"), {
           type: "training",
           arch: selectedArch,
          task,
          hyperparameters: appliedHyperparams,
          autoOptimize,
          datasetIds: selectedTrainingDatasetIds,
          sampleIds: selectedTrainingSampleIds,
           status: "running",
           startedAt: serverTimestamp()
       });
      sessionStorage.setItem(activeJobStorageKey, jobRef.id);

      if (incrementTrainingCount) {
        try { await incrementTrainingCount(); } catch {}
      }

       // 2. Listen for real-time progress updates from the backend
      const unsubscribe = onSnapshot(
        doc(db, "projects", projectId || "temp", "jobs", jobRef.id),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.epoch !== undefined) setEpoch(data.epoch);
            if (data.loss !== undefined) setLoss(data.loss);
            if (data.acc !== undefined) setAcc(data.acc);

            if (data.status === 'completed') {
              sessionStorage.removeItem(activeJobStorageKey);
              setStatus('done');

              let cm2d = data.confusionMatrix;
              if (data.confusionMatrix && data.labels && data.confusionMatrix.length === data.labels.length * data.labels.length) {
                // Unflatten the 1D array from Firestore back into a 2D array
                cm2d = [];
                const numLabels = data.labels.length;
                for (let i = 0; i < numLabels; i++) {
                  cm2d.push(data.confusionMatrix.slice(i * numLabels, (i + 1) * numLabels));
                }
              }

              setModelInfo({
                modelUrl: data.modelUrl,
                headerUrl: data.headerUrl,
                labels: data.labels,
                sizeBytes: data.modelSizeBytes,
                confusionMatrix: cm2d,
                metrics: data.metrics,
                diagnostics: data.diagnostics,
              });
              unsubscribe();
            } else if (data.status === 'failed') {
              sessionStorage.removeItem(activeJobStorageKey);
              setStatus('idle');
              void alert("Training failed in cloud: " + (data.error || "Unknown error"));
              unsubscribe();
            }
          }
        },
        (err) => {
          console.warn("Training job listener error:", err?.message || err);
          sessionStorage.removeItem(activeJobStorageKey);
          setStatus("idle");
        }
      );

       // 3. Kick off the training service.
       // The server keeps the HTTP connection open for the full training
       // duration (streaming response to keep Cloud Run CPU alive).
       // We fire-and-forget — the Firestore listener handles all progress.
       const trainUrl = window.location.hostname === "localhost"
         ? "https://bitblock-ml-trainer-409440684176.us-central1.run.app/train"
         : "/.netlify/functions/train-model";
      const includeAuthHeader = !trainUrl.startsWith("http");
       fetch(trainUrl, {
         method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(includeAuthHeader && auth.currentUser
            ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
            : {}),
        },
         body: JSON.stringify({
           projectId: projectId || "temp",
           jobId: jobRef.id,
           architecture: selectedArch,
           task,
          hyperparameters: appliedHyperparams,
          datasetIds: selectedTrainingDatasetIds,
          sampleIds: selectedTrainingSampleIds,
         }),
      }).then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({} as any));
          // Netlify can return 504 while upstream Cloud Run training keeps running.
          // Keep UI in training state and rely on Firestore listener for true job status.
          if (res.status === 504) {
            console.warn("Training start request timed out at edge (504); waiting on job listener.");
            return;
          }
          setStatus("idle");
          await alert(payload?.error || `Could not start training (${res.status}).`);
        }
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
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
       <input
         ref={replaceFileInputRef}
         type="file"
         accept="image/*"
         style={{ display: "none" }}
         onChange={(ev) => void onReplaceFilePicked(ev)}
       />

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
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
                      value={selectedArch} onChange={(e) => {
                          setSelectedArch(e.target.value);
                      }}
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
                marginBottom: 16, padding: 12, background: "rgba(157,39,222,0.05)", borderRadius: 8, 
                border: "1px solid rgba(157,39,222,0.15)", display: "flex", flexDirection: "column", gap: 8 
            }}>
                <button
                    type="button"
                    aria-expanded={modelRequirementsExpanded}
                    onClick={() => setModelRequirementsExpanded((v) => !v)}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                    }}
                >
                    <span style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", textTransform: "uppercase" }}>Model Requirements</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, background: "#9D27DE", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>{currentArch.recommendedInput} Task</span>
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{
                                color: "rgba(242,242,240,0.5)",
                                flexShrink: 0,
                                transform: modelRequirementsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                                transition: "transform 0.2s ease",
                            }}
                            aria-hidden
                        >
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </span>
                </button>
                {modelRequirementsExpanded && (
                <>
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

                {/* ── Dataset Size Recommendation ── */}
                {currentArch.recommendedSamples && (() => {
                  const rec = currentArch.recommendedSamples;
                  const isPerUnit = rec.unit !== "total (normal only)";
                  // For per-unit metrics, use the smallest class count to determine health
                  const smallestClassCount = Object.keys(cloudLabels).length > 0
                    ? Math.min(...Object.values(cloudLabels))
                    : 0;
                  const checkCount = isPerUnit ? smallestClassCount : cloudTotal;
                  const statusColor = checkCount >= rec.recommended
                    ? "#4ade80"
                    : checkCount >= rec.min
                      ? "#f59e0b"
                      : "#f87171";
                  const statusLabel = checkCount >= rec.recommended
                    ? (rec.ideal && checkCount >= rec.ideal ? "Ideal" : "Good")
                    : checkCount >= rec.min
                      ? "Minimum met"
                      : "Insufficient";
                  const statusIcon = checkCount >= rec.recommended ? "✓" : checkCount >= rec.min ? "⚠" : "✗";
                  // Progress bar ratio (cap at ideal or 1.2× recommended)
                  const barMax = rec.ideal || Math.round(rec.recommended * 1.2);
                  const barPct = Math.min(100, Math.round((checkCount / barMax) * 100));

                  return (
                    <div style={{
                      marginTop: 12, padding: 10, borderRadius: 8,
                      background: "rgba(0,0,0,0.2)", border: `1px solid ${statusColor}22`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 10, color: "rgba(242,242,240,0.4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Recommended Dataset Size
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: statusColor,
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "2px 8px", borderRadius: 999,
                          background: `${statusColor}15`, border: `1px solid ${statusColor}30`,
                        }}>
                          {statusIcon} {statusLabel}
                        </span>
                      </div>

                      {/* Threshold bar */}
                      <div style={{ position: "relative", height: 6, borderRadius: 3, background: "rgba(242,242,240,0.08)", marginBottom: 10, overflow: "hidden" }}>
                        <div style={{
                          position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 3,
                          width: `${barPct}%`,
                          background: `linear-gradient(90deg, ${statusColor}99, ${statusColor})`,
                          transition: "width 0.4s ease",
                        }} />
                      </div>

                      {/* Threshold labels */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: checkCount >= rec.min ? "#4ade80" : "#f87171", fontFamily: "JetBrains Mono, monospace" }}>{rec.min}</span>
                          <span style={{ fontSize: 9, color: "rgba(242,242,240,0.35)" }}>Minimum</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: checkCount >= rec.recommended ? "#4ade80" : "rgba(242,242,240,0.55)", fontFamily: "JetBrains Mono, monospace" }}>{rec.recommended}</span>
                          <span style={{ fontSize: 9, color: "rgba(242,242,240,0.35)" }}>Recommended</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: rec.ideal && checkCount >= rec.ideal ? "#4ade80" : "rgba(242,242,240,0.35)", fontFamily: "JetBrains Mono, monospace" }}>{rec.ideal ?? "—"}</span>
                          <span style={{ fontSize: 9, color: "rgba(242,242,240,0.35)" }}>Ideal</span>
                        </div>
                      </div>

                      {/* Unit + current status */}
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "rgba(242,242,240,0.4)" }}>
                          Samples <strong style={{ color: "rgba(242,242,240,0.6)" }}>{rec.unit}</strong>
                        </span>
                        <span style={{ fontSize: 10, color: "rgba(242,242,240,0.5)", fontFamily: "JetBrains Mono, monospace" }}>
                          You have: <strong style={{ color: statusColor }}>{checkCount}</strong> {isPerUnit ? `(smallest class)` : "total"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <p style={{ fontSize: 10, color: "rgba(242,242,240,0.5)", margin: 0, fontStyle: "italic" }}>
                    {currentArch.recommendedInput === 'Image' ? "Ensure all samples are cropped to 1:1 ratio. Our engine auto-resizes to target resolution." : "Ensure sensor stream is active before starting collection."}
                </p>
                
                {currentArch.hyperparameters && (
                    <div style={{ marginTop: 16, borderTop: "1px solid rgba(242,242,240,0.1)", paddingTop: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <span style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", textTransform: "uppercase" }}>Hyperparameters</span>
                          <button
                            onClick={() => setAutoOptimize((v) => !v)}
                            disabled={status === "training"}
                            style={{
                              background: autoOptimize ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.04)",
                              color: autoOptimize ? "#4ade80" : "rgba(242,242,240,0.7)",
                              border: `1px solid ${autoOptimize ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.12)"}`,
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "4px 10px",
                              cursor: status === "training" ? "not-allowed" : "pointer",
                              opacity: status === "training" ? 0.6 : 1,
                            }}
                          >
                            {autoOptimize ? "Edge Auto-Optimize ON" : "Edge Auto-Optimize OFF"}
                          </button>
                        </div>
                        {autoOptimize && autoNote && (
                          <p style={{ fontSize: 10, color: "rgba(74,222,128,0.9)", margin: "0 0 12px", lineHeight: 1.4 }}>
                            {autoNote}
                          </p>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {currentArch.hyperparameters.map(hp => (
                                <div key={hp.id} style={{ display: "flex", flexDirection: "column" }}>
                                    <label style={{ fontSize: 10, color: "rgba(242,242,240,0.5)", marginBottom: 4 }}>{hp.name}</label>
                                    {hp.type === "select" ? (
                                        <select 
                                            value={hyperparams[hp.id] !== undefined ? hyperparams[hp.id] : hp.default}
                                            onChange={(e) => setHyperparams(prev => ({ ...prev, [hp.id]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) }))}
                                            disabled={status === 'training' || autoOptimize}
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
                                            disabled={status === 'training' || autoOptimize}
                                            style={{ padding: '6px 8px', fontSize: 11, background: "#0D0018", color: "#F2F2F0", border: "1px solid rgba(157,39,222,0.3)", borderRadius: 6, outline: "none" }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                </>
                )}
            </div>
        )}

       <div
         style={{
           marginBottom: 16,
           padding: 12,
           background: "rgba(34,197,94,0.06)",
           borderRadius: 8,
           border: "1px solid rgba(34,197,94,0.2)",
           display: "flex",
           flexDirection: "column",
           gap: 10,
         }}
       >
         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
           <span style={{ fontSize: 11, color: "rgba(242,242,240,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
             Datasets for this training run
           </span>
           <span style={{ fontSize: 10, color: "#86efac", fontWeight: 600 }}>
             {selectedTrainingDatasetIds.length} selected · {unionTrainingSampleCount} unique sample refs
           </span>
         </div>
         {trainingDatasets.length === 0 ? (
           <p style={{ fontSize: 11, color: "rgba(242,242,240,0.55)", margin: 0, lineHeight: 1.45 }}>
             Create at least <strong style={{ color: "#F2F2F0" }}>two saved datasets</strong> in{" "}
             <strong style={{ color: "#F2F2F0" }}>Data Collection</strong> (Cloud library: save selection or save entire cloud), then choose them here.
           </p>
         ) : compatibleDatasets.length === 0 ? (
           <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 8px", textAlign: "center" }}>
             <div style={{
               width: 44, height: 44, borderRadius: 12,
               background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
               display: "flex", alignItems: "center", justifyContent: "center",
             }}>
               <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                 <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
               </svg>
             </div>
             <p style={{ fontSize: 12, color: "rgba(242,242,240,0.6)", margin: 0, lineHeight: 1.5 }}>
               You have <strong style={{ color: "#F2F2F0" }}>{trainingDatasets.length}</strong> saved dataset{trainingDatasets.length !== 1 ? "s" : ""}, but{" "}
               <strong style={{ color: "#f59e0b" }}>none are compatible</strong> with the selected{" "}
               <strong style={{ color: "#E0D8F0" }}>{currentArch?.recommendedInput || "\u2014"}</strong> input type.
             </p>
             <p style={{ fontSize: 10, color: "rgba(242,242,240,0.35)", margin: 0, lineHeight: 1.45 }}>
               The model requires <strong>{currentArch?.recommendedInput}</strong> data. Collect a new dataset with the correct format to proceed.
             </p>
             {onGoToCollect && (
               <button
                 onClick={onGoToCollect}
                 style={{
                   marginTop: 4, padding: "9px 20px", borderRadius: 8,
                   border: "1px solid rgba(157,39,222,0.4)",
                   background: "linear-gradient(135deg, rgba(157,39,222,0.15), rgba(185,79,240,0.1))",
                   color: "#E0D8F0", fontSize: 12, fontWeight: 600, cursor: "pointer",
                   display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                 }}
               >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                 Collect {currentArch?.recommendedInput} Dataset
               </button>
             )}
           </div>
         ) : compatibleDatasets.length < 2 ? (
           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
             <p style={{ fontSize: 11, color: "rgba(242,242,240,0.55)", margin: 0, lineHeight: 1.45 }}>
               Only <strong style={{ color: "#F2F2F0" }}>{compatibleDatasets.length}</strong> compatible dataset found. You need at least <strong style={{ color: "#F2F2F0" }}>two</strong> to start training.
               {incompatibleCount > 0 && (
                 <span style={{ color: "rgba(242,242,240,0.35)" }}>
                   {" "}({incompatibleCount} other dataset{incompatibleCount !== 1 ? "s" : ""} filtered out {"\u2014"} wrong data format.)
                 </span>
               )}
             </p>
             {compatibleDatasets.map((ds) => (
               <label key={ds.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#F2F2F0", opacity: 0.7 }}>
                 <input type="checkbox" checked={false} disabled style={{ width: 16, height: 16, accentColor: "#22c55e" }} />
                 <span style={{ flex: 1, minWidth: 0 }}>
                   {ds.name} <span style={{ color: "rgba(242,242,240,0.45)", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>{"\u00b7"} {ds.sampleIds.length} samples</span>
                 </span>
               </label>
             ))}
             {onGoToCollect && (
               <button
                 onClick={onGoToCollect}
                 style={{
                   alignSelf: "flex-start", marginTop: 4, padding: "7px 16px", borderRadius: 7,
                   border: "1px solid rgba(157,39,222,0.35)", background: "rgba(157,39,222,0.08)",
                   color: "#B94FF0", fontSize: 11, fontWeight: 600, cursor: "pointer",
                   display: "flex", alignItems: "center", gap: 6,
                 }}
               >
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                 Collect More {currentArch?.recommendedInput} Data
               </button>
             )}
           </div>
         ) : (
           <div
             style={{
               display: "flex",
               flexDirection: "column",
               gap: 6,
               maxHeight: 200,
               overflowY: "auto",
               paddingRight: 4,
             }}
           >
             {compatibleDatasets.map((ds) => {
               const checked = selectedTrainingDatasetIds.includes(ds.id);
               return (
                 <label
                   key={ds.id}
                   style={{
                     display: "flex",
                     alignItems: "center",
                     gap: 10,
                     cursor: status === "training" ? "not-allowed" : "pointer",
                     opacity: status === "training" ? 0.55 : 1,
                     fontSize: 12,
                     color: "#F2F2F0",
                   }}
                 >
                   <input
                     type="checkbox"
                     checked={checked}
                     disabled={status === "training"}
                     onChange={() => toggleTrainingDataset(ds.id)}
                     style={{ width: 16, height: 16, accentColor: "#22c55e" }}
                   />
                   <span style={{ flex: 1, minWidth: 0 }}>
                     {ds.name}{" "}
                     <span style={{ color: "rgba(242,242,240,0.45)", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
                       · {ds.sampleIds.length} samples
                     </span>
                   </span>
                 </label>
               );
             })}
             {incompatibleCount > 0 && (
               <p style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", margin: "4px 0 0", fontStyle: "italic" }}>
                 {incompatibleCount} dataset{incompatibleCount !== 1 ? "s" : ""} hidden (incompatible data format)
               </p>
             )}
           </div>
         )}
         {compatibleDatasets.length >= 2 && selectedTrainingDatasetIds.length < 2 && (
           <p style={{ fontSize: 10, color: "#f59e0b", margin: 0 }}>Select at least two datasets. Training uses the union of their sample IDs.</p>
         )}
       </div>

       {/* Cloud Dataset Summary */}
       {cloudTotal > 0 && (
           <div style={{
               marginBottom: 16, padding: 12, background: 'rgba(59,130,246,0.05)', borderRadius: 8,
               border: '1px solid rgba(59,130,246,0.15)', display: 'flex', flexDirection: 'column', gap: 8
           }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.4)', textTransform: 'uppercase' }}>Cloud ({currentArch?.recommendedInput || "all"} samples)</span>
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

       <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
           {status === "idle" ? (
               <>
               {canStartTraining === false && (
                 <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.09)", color: "#FDE68A", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                   <span>{trainingBlockReason || "Training plan limit reached."}</span>
                   <Link to={isBetaMode ? "/profile" : "/billing"} className="btn-ghost" style={{ fontSize: 10, padding: "4px 8px", color: "#F59E0B" }}>{isBetaMode ? "Check Quotas" : "Upgrade"}</Link>
                 </div>
               )}
               <button 
                   onClick={handleStartTraining} 
                   disabled={
                     !selectedArch ||
                     selectedTrainingDatasetIds.length < 2 ||
                     unionTrainingSampleCount === 0 ||
                     canStartTraining === false
                   }
                   style={{
                       width: '100%', padding: '12px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700,
                       background:
                         !selectedArch || selectedTrainingDatasetIds.length < 2 || unionTrainingSampleCount === 0 || canStartTraining === false
                           ? 'rgba(157,39,222,0.1)'
                           : 'linear-gradient(135deg, #9D27DE, #B94FF0)',
                       color:
                         !selectedArch || selectedTrainingDatasetIds.length < 2 || unionTrainingSampleCount === 0 || canStartTraining === false
                           ? 'rgba(242,242,240,0.4)'
                           : '#fff',
                       cursor:
                         !selectedArch || selectedTrainingDatasetIds.length < 2 || unionTrainingSampleCount === 0 || canStartTraining === false
                           ? 'not-allowed'
                           : 'pointer',
                       display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                       transition: 'all 0.2s',
                       boxShadow:
                         !selectedArch || selectedTrainingDatasetIds.length < 2 || unionTrainingSampleCount === 0 || canStartTraining === false
                           ? 'none'
                           : '0 0 16px rgba(157,39,222,0.4)',
                   }}
               >
                   Start Cloud Training
               </button>
               </>
           ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                   <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.2)', borderRadius: 8, padding: 16 }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                           <span style={{ fontSize: 12, color: '#F2F2F0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                               {status !== "done" && <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite", color: '#9D27DE' }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none"/></svg>}
                               {status === "loading_data" && "Downloading Dataset"}
                               {status === "training" && `Training Epoch ${epoch}/${TOTAL_EPOCHS}`}
                               {status === "converting" && "Exporting TFLite INT8"}
                               {status === "uploading" && "Uploading to Cloud"}
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
                               background: status === "done" ? '#22c55e' : '#eab308', 
                               transition: 'width 0.4s ease-out, background 0.4s', 
                               boxShadow: status === "done" ? '0 0 10px #22c55e' : '0 0 10px #eab308',
                               animation: status !== "done" && status !== "training" ? 'pulse 1.5s infinite' : 'none'
                           }} />
                       </div>
                       <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(242,242,240,0.5)', fontFamily: 'JetBrains Mono', display: 'flex', justifyContent: 'space-between' }}>
                           <span>
                               {status === "loading_data" && "> Fetching and processing samples..."}
                               {status === "training" && `> Epoch ${epoch}/${TOTAL_EPOCHS} — Loss: ${loss.toFixed(4)} — Acc: ${(acc * 100).toFixed(1)}%`}
                               {status === "converting" && "> Quantizing model for edge devices..."}
                               {status === "uploading" && "> Storing .tflite artifact..."}
                               {status === "done" && "> Model successfully deployed."}
                           </span>
                       </div>
                   </div>

                   {status === "training" && (
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                           <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.15)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                               <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Loss</span>
                               <span style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono' }}>{loss.toFixed(4)}</span>
                           </div>
                           <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.15)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                               <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Accuracy</span>
                               <span style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', fontFamily: 'JetBrains Mono' }}>{(acc * 100).toFixed(1)}%</span>
                           </div>
                       </div>
                   )}

                   {status === "done" && (
                       <div style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                               <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 }}>
                                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                               </div>
                               <div>
                                   <p style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', margin: 0 }}>Model Ready!</p>
                                   <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', margin: '2px 0 0' }}>
                                       {modelInfo?.sizeBytes ? `Size: ${(modelInfo.sizeBytes / 1024).toFixed(1)} KB` : ''}
                                   </p>
                               </div>
                               <button onClick={() => {
                                   if (modelInfo?.jobId) {
                                     sessionStorage.setItem(`dismissed_job_${modelInfo.jobId}`, "true");
                                   }
                                   setStatus("idle");
                               }} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(242,242,240,0.2)', color: 'rgba(242,242,240,0.8)', padding: '4px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>
                                   Dismiss
                               </button>
                           </div>
                           <div style={{ display: 'flex', gap: 8 }}>
                               {modelInfo?.headerUrl && (
                                   <a href={modelInfo.headerUrl} download target="_blank" rel="noreferrer"
                                      style={{ flex: 1, padding: '6px 0', borderRadius: 4, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 10, fontWeight: 600, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                                       ⬇ Download .h
                                   </a>
                               )}
                               {modelInfo?.modelUrl && (
                                   <a href={modelInfo.modelUrl} download target="_blank" rel="noreferrer"
                                      style={{ flex: 1, padding: '6px 0', borderRadius: 4, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 10, fontWeight: 600, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                                       ⬇ Download .tflite
                                   </a>
                               )}
                           </div>

                           {!!modelInfo?.diagnostics?.hard_examples?.length && currentArch?.recommendedInput === "Image" && !modelInfo?.diagnostics?.fomo_grid && (
                             <div
                               style={{
                                 marginTop: 2,
                                 borderRadius: 10,
                                 border: "1px solid rgba(239,68,68,0.35)",
                                 background: "rgba(239,68,68,0.06)",
                                 padding: "12px 12px 10px",
                                 display: "flex",
                                 flexDirection: "column",
                                 gap: 10,
                                 flex: "0 1 auto",
                                 minHeight: 0,
                                 maxHeight: "min(62vh, 780px)",
                               }}
                             >
                               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                                 <div>
                                   <p style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", margin: 0 }}>Problem images</p>
                                   <p style={{ fontSize: 10, color: "rgba(242,242,240,0.55)", margin: "6px 0 0", lineHeight: 1.45, maxWidth: 520 }}>
                                     Validation mistakes for your true labels. Review them large here. Use <strong style={{ color: "#F2F2F0" }}>Replace photo</strong> to upload a better crop for that same class (same Firestore sample), then retrain.
                                   </p>
                                 </div>
                                 <span style={{ fontSize: 10, color: "rgba(242,242,240,0.45)", fontFamily: "JetBrains Mono, monospace" }}>
                                   {getTrainImageSize().w}×{getTrainImageSize().h} target
                                 </span>
                               </div>
                               <div
                                 style={{
                                   overflowY: "auto",
                                   paddingRight: 4,
                                   display: "grid",
                                   gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
                                   gap: 10,
                                   alignContent: "start",
                                 }}
                               >
                                 {modelInfo.diagnostics.hard_examples.map((ex, idx) => (
                                   <div
                                     key={`${ex.sampleId || ex.imageUrl || idx}`}
                                     style={{
                                       background: "#0D0018",
                                       border: "1px solid rgba(239,68,68,0.28)",
                                       borderRadius: 8,
                                       padding: 8,
                                       display: "flex",
                                       flexDirection: "column",
                                       gap: 8,
                                       minHeight: 0,
                                     }}
                                   >
                                     {ex.imageUrl ? (
                                       <img
                                         src={ex.imageUrl}
                                         alt="misclassified validation sample"
                                         style={{
                                           width: "100%",
                                           height: 200,
                                           objectFit: "contain",
                                           background: "#050008",
                                           borderRadius: 6,
                                           border: "1px solid rgba(255,255,255,0.06)",
                                         }}
                                       />
                                     ) : (
                                       <div
                                         style={{
                                           width: "100%",
                                           height: 200,
                                           borderRadius: 6,
                                           display: "flex",
                                           alignItems: "center",
                                           justifyContent: "center",
                                           background: "rgba(255,255,255,0.04)",
                                           color: "rgba(242,242,240,0.45)",
                                           fontSize: 10,
                                           textAlign: "center",
                                           padding: 8,
                                         }}
                                       >
                                         No image preview
                                       </div>
                                     )}
                                     <div style={{ fontSize: 10, color: "#fca5a5", lineHeight: 1.35 }}>
                                       True: <strong style={{ color: "#F2F2F0" }}>{ex.true_label}</strong>
                                       <br />
                                       Pred: <strong style={{ color: "#F2F2F0" }}>{ex.pred_label}</strong> ({(ex.pred_confidence * 100).toFixed(1)}%)
                                     </div>
                                     <button
                                       type="button"
                                       disabled={!ex.sampleId || replacingSampleId === ex.sampleId}
                                       onClick={() => startReplaceSampleImage(ex.sampleId)}
                                       style={{
                                         marginTop: "auto",
                                         padding: "8px 10px",
                                         borderRadius: 6,
                                         border: "1px solid rgba(157,39,222,0.45)",
                                         background:
                                           !ex.sampleId || replacingSampleId === ex.sampleId
                                             ? "rgba(255,255,255,0.04)"
                                             : "rgba(157,39,222,0.2)",
                                         color: !ex.sampleId ? "rgba(242,242,240,0.35)" : "#F2F2F0",
                                         fontSize: 11,
                                         fontWeight: 600,
                                         cursor: !ex.sampleId || replacingSampleId === ex.sampleId ? "not-allowed" : "pointer",
                                       }}
                                     >
                                       {replacingSampleId === ex.sampleId ? "Uploading…" : "Replace photo"}
                                     </button>
                                     {!ex.sampleId && (
                                       <span style={{ fontSize: 9, color: "rgba(242,242,240,0.35)" }}>
                                         No sample id — fix this row from Data Collection.
                                       </span>
                                     )}
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}

                           {modelInfo?.metrics && (
                               <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 10 }}>
                                   <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                       Final Metrics
                                   </p>
                                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                       <MetricCard label="Val Loss" value={modelInfo.metrics.val_loss} />
                                       <MetricCard label="Val Acc" value={modelInfo.metrics.val_accuracy !== undefined ? `${(modelInfo.metrics.val_accuracy * 100).toFixed(2)}%` : undefined} />
                                       <MetricCard label="Val heatmap acc" value={modelInfo.metrics.val_binary_accuracy !== undefined ? `${(modelInfo.metrics.val_binary_accuracy * 100).toFixed(2)}%` : undefined} />
                                       <MetricCard label="Macro dice (FOMO)" value={modelInfo.metrics.macro_dice} />
                                       <MetricCard label="Macro F1" value={modelInfo.metrics.macro_f1} />
                                       <MetricCard label="Precision (Macro)" value={modelInfo.metrics.precision_macro !== undefined ? `${(modelInfo.metrics.precision_macro * 100).toFixed(2)}%` : undefined} />
                                       <MetricCard label="Recall (Macro)" value={modelInfo.metrics.recall_macro !== undefined ? `${(modelInfo.metrics.recall_macro * 100).toFixed(2)}%` : undefined} />
                                       <MetricCard label="Weighted F1" value={modelInfo.metrics.weighted_f1 !== undefined ? `${(modelInfo.metrics.weighted_f1 * 100).toFixed(2)}%` : undefined} />
                                       <MetricCard label="Balanced Acc" value={modelInfo.metrics.balanced_accuracy !== undefined ? `${(modelInfo.metrics.balanced_accuracy * 100).toFixed(2)}%` : undefined} />
                                       <MetricCard label="Top-2 Acc" value={modelInfo.metrics.top2_accuracy !== undefined ? `${(modelInfo.metrics.top2_accuracy * 100).toFixed(2)}%` : undefined} />
                                   </div>
                                   {modelInfo.metrics.mse !== undefined && (
                                       <div style={{ marginTop: 8 }}>
                                           <MetricCard label="MSE" value={modelInfo.metrics.mse} />
                                       </div>
                                   )}
                               </div>
                           )}

                           {!!modelInfo?.diagnostics?.dataset && (
                             <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 10 }}>
                               <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                 Dataset Split
                               </p>
                               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                 <MetricCard label="Total Samples" value={modelInfo.diagnostics.dataset.total_samples} />
                                 <MetricCard label="Train Samples" value={modelInfo.diagnostics.dataset.train_samples} />
                                 <MetricCard label="Validation Samples" value={modelInfo.diagnostics.dataset.val_samples} />
                               </div>
                             </div>
                           )}
                           
                           {modelInfo?.confusionMatrix && modelInfo?.labels && (
                               <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 12 }}>
                                   <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>Confusion Matrix</p>
                                   {(() => {
                                     const labels = modelInfo.labels || [];
                                     const matrix = modelInfo.confusionMatrix || [];
                                     let offDiagonalErrors = 0;
                                     let totalPredictions = 0;
                                     matrix.forEach((row, i) => {
                                       row.forEach((val, j) => {
                                         totalPredictions += val;
                                         if (i !== j) offDiagonalErrors += val;
                                       });
                                     });
                                     const hasOverlap = offDiagonalErrors > 0;
                                     const overlapRate = totalPredictions > 0 ? (offDiagonalErrors / totalPredictions) * 100 : 0;
                                     return (
                                     <>
                                       <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${labels.length}, minmax(56px, 1fr))`, gap: 2, fontSize: 10 }}>
                                         <div />
                                         {labels.map((l: string) => (
                                           <div
                                             key={`col-${l}`}
                                             style={{
                                               textAlign: 'center',
                                               color: '#4ade80',
                                               whiteSpace: 'nowrap',
                                               overflow: 'hidden',
                                               textOverflow: 'ellipsis',
                                               padding: '2px 4px',
                                             }}
                                             title={l}
                                           >
                                             {l}
                                           </div>
                                         ))}
                                         {modelInfo.confusionMatrix.map((row: number[], i: number) => (
                                             <React.Fragment key={`row-${i}`}>
                                                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#4ade80', paddingRight: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={labels[i]}>
                                                   {labels[i]}
                                                 </div>
                                                 {row.map((val: number, j: number) => {
                                                     const total = row.reduce((a,b)=>a+b, 0);
                                                     const intensity = total > 0 ? val / total : 0;
                                                     const bg = i === j 
                                                         ? `rgba(34,197,94,${Math.max(0.1, intensity)})`
                                                         : `rgba(239,68,68,${Math.max(0.1, intensity)})`;
                                                     return (
                                                         <div key={`cell-${i}-${j}`} style={{ background: bg, border: '1px solid rgba(242,242,240,0.05)', borderRadius: 2, padding: '4px 0', textAlign: 'center', color: val > 0 ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                                             {val}
                                                         </div>
                                                     );
                                                 })}
                                             </React.Fragment>
                                         ))}
                                       </div>
                                       {hasOverlap && (
                                         <div
                                           style={{
                                             marginTop: 10,
                                             padding: '8px 10px',
                                             borderRadius: 6,
                                             background: 'rgba(239,68,68,0.12)',
                                             border: '1px solid rgba(239,68,68,0.3)',
                                             color: '#fca5a5',
                                             fontSize: 10,
                                             lineHeight: 1.45,
                                           }}
                                         >
                                           Detected class overlap in confusion matrix ({overlapRate.toFixed(1)}% off-diagonal errors).  
                                           Suggested fix: replace or clean the training images for commonly confused classes, then retrain to improve separation.
                                         </div>
                                       )}
                                     </>
                                     );
                                   })()}
                                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(242,242,240,0.4)', marginTop: 4 }}>
                                       <span>Rows: True</span>
                                       <span>Cols: Pred</span>
                                   </div>
                               </div>
                           )}

                           {!!modelInfo?.diagnostics?.confusion_pairs?.length && (
                             <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 12 }}>
                               <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                 Most Confused Class Pairs
                               </p>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                 {modelInfo.diagnostics.confusion_pairs.slice(0, 6).map((pair, idx) => (
                                   <div key={`${pair.true_label}-${pair.pred_label}-${idx}`} style={{ background: '#0D0018', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '6px 8px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                     <span style={{ fontSize: 10, color: '#fca5a5' }}>
                                       {pair.true_label} → {pair.pred_label}
                                     </span>
                                     <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.65)', fontFamily: 'JetBrains Mono, monospace' }}>
                                       {pair.count} ({(pair.row_error_rate * 100).toFixed(1)}%)
                                     </span>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}

                           {!!modelInfo?.diagnostics?.confidence_histogram?.length && (
                             <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 12 }}>
                               <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                 Confidence Distribution
                               </p>
                               <ConfidenceHistogram bins={modelInfo.diagnostics.confidence_histogram} />
                             </div>
                           )}

                           {!!modelInfo?.diagnostics?.train_history?.length && (
                             <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 12 }}>
                               <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                 Training Trend
                               </p>
                               <TrainingTrendChart points={modelInfo.diagnostics.train_history} />
                             </div>
                           )}

                           {!!modelInfo?.diagnostics?.per_class?.length && (
                             <div style={{ marginTop: 4, borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: 12 }}>
                               <p style={{ fontSize: 10, color: 'rgba(242,242,240,0.6)', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                 Per-Class Performance
                               </p>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                 {modelInfo.diagnostics.per_class.map((cls) => (
                                   <div key={cls.label} style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.18)', borderRadius: 6, padding: '8px 10px' }}>
                                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                       <span style={{ fontSize: 10, color: '#F2F2F0', fontWeight: 600 }}>{cls.label}</span>
                                       <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.5)' }}>n={cls.support}</span>
                                     </div>
                                     <div style={{ display: 'grid', gap: 4 }}>
                                       <InlineBar label="Precision" value={cls.precision} color="#60a5fa" />
                                       <InlineBar label="Recall" value={cls.recall} color="#4ade80" />
                                       <InlineBar label="F1" value={cls.f1} color="#c084fc" />
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                       </div>
                   )}
               </div>
           )}
       </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value?: number | string }) {
  const pretty = typeof value === "number" ? value.toFixed(4) : value;
  return (
    <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.2)', borderRadius: 6, padding: 8 }}>
      <div style={{ fontSize: 9, color: 'rgba(242,242,240,0.45)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#F2F2F0', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
        {pretty ?? "-"}
      </div>
    </div>
  );
}

function InlineBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 48px', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: 'rgba(242,242,240,0.55)' }}>{label}</span>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 9, color: '#F2F2F0', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
        {(pct * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function ConfidenceHistogram({ bins }: { bins: ConfidenceBin[] }) {
  const maxCount = Math.max(1, ...bins.map((b) => b.correct + b.incorrect));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {bins.map((bin) => {
        const total = bin.correct + bin.incorrect;
        const widthPct = (total / maxCount) * 100;
        const correctPct = total > 0 ? (bin.correct / total) * 100 : 0;
        return (
          <div key={bin.bin} style={{ display: 'grid', gridTemplateColumns: '68px 1fr 48px', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'rgba(242,242,240,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>{bin.bin}</span>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', width: `${widthPct}%`, minWidth: 8 }}>
              <div style={{ height: '100%', width: `${correctPct}%`, background: '#22c55e', float: 'left' }} />
              <div style={{ height: '100%', width: `${100 - correctPct}%`, background: '#ef4444', float: 'left' }} />
            </div>
            <span style={{ fontSize: 9, color: 'rgba(242,242,240,0.7)', textAlign: 'right' }}>{total}</span>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', fontSize: 9, color: 'rgba(242,242,240,0.55)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} /> correct</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> incorrect</span>
      </div>
    </div>
  );
}

function TrainingTrendChart({ points }: { points: TrainHistoryPoint[] }) {
  const width = 520;
  const height = 140;
  const pad = 14;
  const cleanValAcc = points.map((p) => (typeof p.val_accuracy === "number" ? p.val_accuracy : null));
  const cleanValLoss = points.map((p) => (typeof p.val_loss === "number" ? p.val_loss : null));
  const maxLoss = Math.max(1e-6, ...points.map((p) => p.loss), ...cleanValLoss.filter((v): v is number => v !== null));

  const toPolyline = (vals: Array<number | null>, invert = false) => {
    const steps = Math.max(1, points.length - 1);
    const coords: string[] = [];
    vals.forEach((v, i) => {
      if (v === null || Number.isNaN(v)) return;
      const x = pad + (i / steps) * (width - pad * 2);
      const normalized = invert ? 1 - Math.max(0, Math.min(1, v / maxLoss)) : Math.max(0, Math.min(1, v));
      const y = pad + (1 - normalized) * (height - pad * 2);
      coords.push(`${x},${y}`);
    });
    return coords.join(" ");
  };

  const accLine = toPolyline(cleanValAcc);
  const lossLine = toPolyline(cleanValLoss, true);

  return (
    <div style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.18)', borderRadius: 8, padding: 8 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {accLine && <polyline points={accLine} fill="none" stroke="#4ade80" strokeWidth="2" />}
        {lossLine && <polyline points={lossLine} fill="none" stroke="#f59e0b" strokeWidth="2" />}
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', fontSize: 9, color: 'rgba(242,242,240,0.55)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, background: '#4ade80', display: 'inline-block' }} /> val accuracy</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, background: '#f59e0b', display: 'inline-block' }} /> val loss</span>
      </div>
    </div>
  );
}
