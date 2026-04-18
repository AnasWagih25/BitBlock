import { useState, useRef, useEffect, useCallback } from 'react';
import { db, storage } from "../lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { ML_ARCHITECTURES } from '../boards/MLCapabilities';
import { Camera, Upload, Trash2, Scissors, Check, Tag, Database, RefreshCw } from 'lucide-react';
import { useAppDialog } from '../contexts/DialogContext';

interface CloudSample { id: string; label: string; type?: string; imageUrl?: string; features?: number[]; }

export default function DataCollection({ projectId, architecture }: { projectId: string; boardId: string; task?: string; architecture?: string }) {
  const { alert, confirm } = useAppDialog();
  const [dataLabel, setDataLabel] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [streamData, setStreamData] = useState<number[][]>([]);
  const [cloudSamples, setCloudSamples] = useState<CloudSample[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dataset, setDataset] = useState<{id: string, url: string, label: string, blob?: Blob, uploaded?: boolean}[]>([]);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, size: 200 });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const currentArch = architecture ? ML_ARCHITECTURES[architecture] : null;
  const inputType = currentArch ? currentArch.recommendedInput : "IMU";
  const res = currentArch?.inputResolution || { width: 96, height: 96 };

  // Load existing cloud samples
  const loadCloudSamples = useCallback(async () => {
     if (!projectId) return;
     setLoadingCloud(true);
     try {
        const snap = await getDocs(collection(db, "projects", projectId, "ml_samples"));
        const items: CloudSample[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as CloudSample));
        setCloudSamples(items);
        setSamples(items.length);
     } catch (e) { console.error("Failed to load cloud samples", e); }
     finally { setLoadingCloud(false); }
  }, [projectId]);

  useEffect(() => { loadCloudSamples(); }, [loadCloudSamples]);

  // Camera stream management — persist stream in ref so it survives re-renders
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
     if (inputType === 'Image') {
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
        }).catch(err => console.error("Camera access denied", err));
     }
     return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
     };
  }, [inputType]);

  // Re-attach stream when video element remounts (e.g. after state-driven re-renders)
  useEffect(() => {
     if (inputType === 'Image' && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
     }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (!dataLabel.trim()) { void alert('Enter a label before uploading images'); return; }
     const files = Array.from(e.target.files || []);
     files.forEach(file => {
        const url = URL.createObjectURL(file);
        setDataset(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), url, label: dataLabel.trim() }]);
     });
  };

  const handleSnapshot = () => {
     if (!dataLabel.trim()) { void alert('Enter a label before taking a snapshot'); return; }
     if (!videoRef.current) return;
     const canvas = document.createElement('canvas');
     canvas.width = videoRef.current.videoWidth;
     canvas.height = videoRef.current.videoHeight;
     const ctx = canvas.getContext('2d');
     ctx?.drawImage(videoRef.current, 0, 0);
     canvas.toBlob(blob => {
        if (blob) {
           const url = URL.createObjectURL(blob);
           setDataset(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), url, label: dataLabel.trim(), blob }]);
        }
     });
  };

  const deleteCloudSample = async (sampleId: string) => {
     if (!projectId) return;
     try {
        await deleteDoc(doc(db, "projects", projectId, "ml_samples", sampleId));
        setCloudSamples(prev => prev.filter(s => s.id !== sampleId));
        setSamples(s => Math.max(0, s - 1));
     } catch (e: any) { console.error("Delete error:", e); }
  };

  const clearLabelSamples = async (label: string) => {
     if (!projectId) return;
     const ok = await confirm(`Delete all "${label}" samples from cloud?`);
     if (!ok) return;
     const toDelete = cloudSamples.filter(s => s.label === label);
     for (const s of toDelete) {
        try { await deleteDoc(doc(db, "projects", projectId, "ml_samples", s.id)); } catch(e) {}
     }
     setCloudSamples(prev => prev.filter(s => s.label !== label));
     setSamples(prev => Math.max(0, prev - toDelete.length));
  };

  // --- Crop drag handlers ---
  const handleCropMouseDown = useCallback((e: React.MouseEvent) => {
     e.preventDefault(); e.stopPropagation();
     setIsDragging(true);
     setDragStart({ x: e.clientX, y: e.clientY, cropX: crop.x, cropY: crop.y });
  }, [crop]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
     e.preventDefault(); e.stopPropagation();
     setIsResizing(true);
     setResizeStart({ x: e.clientX, y: e.clientY, size: crop.size });
  }, [crop.size]);

  useEffect(() => {
     if (!isDragging && !isResizing) return;
     const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
           const dx = e.clientX - dragStart.x;
           const dy = e.clientY - dragStart.y;
           setCrop(c => ({ ...c, x: Math.max(0, dragStart.cropX + dx), y: Math.max(0, dragStart.cropY + dy) }));
        }
        if (isResizing) {
           const dx = e.clientX - resizeStart.x;
           const dy = e.clientY - resizeStart.y;
           const delta = Math.max(dx, dy);
           setCrop(c => ({ ...c, size: Math.max(40, resizeStart.size + delta) }));
        }
     };
     const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
     window.addEventListener('mousemove', handleMouseMove);
     window.addEventListener('mouseup', handleMouseUp);
     return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, isResizing, dragStart, resizeStart]);

  const processAndSaveSample = async (sample: typeof dataset[0]) => {
     if (!canvasRef.current || !res) return;
     setUploadingId(sample.id);
     try {
       const img = new Image();
       img.src = sample.url;
       await new Promise(r => img.onload = r);

       const canvas = canvasRef.current;
       canvas.width = res.width;
       canvas.height = res.height;
       const ctx = canvas.getContext('2d');
       if (!ctx) return;

       // Scale crop coordinates from display to image space
       const container = cropContainerRef.current;
       const scaleX = container ? img.naturalWidth / container.clientWidth : 1;
       const scaleY = container ? img.naturalHeight / container.clientHeight : 1;
       const srcX = crop.x * scaleX;
       const srcY = crop.y * scaleY;
       const srcSize = crop.size * Math.max(scaleX, scaleY);

       ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, res.width, res.height);
       
       const finalBlob = await new Promise<Blob|null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
       if (finalBlob && projectId) {
          // Upload cropped image to Firebase Storage
          const fileName = `${Date.now()}_${sample.label}.jpg`;
          const fileRef = storageRef(storage, `projects/${projectId}/ml_data/${fileName}`);
          await uploadBytes(fileRef, finalBlob);
          const downloadURL = await getDownloadURL(fileRef);

          // Save Firestore doc with the image URL
          await addDoc(collection(db, "projects", projectId, "ml_samples"), {
              label: sample.label,
              arch: architecture,
              resolution: res,
              type: "image",
              imageUrl: downloadURL,
              createdAt: serverTimestamp()
          });
          setSamples(s => s + 1);
          setCloudSamples(prev => [...prev, { id: 'local-' + Date.now(), label: sample.label, type: 'image', imageUrl: downloadURL }]);
          setDataset(prev => prev.filter(d => d.id !== sample.id));
          setSelectedSample(null);
       }
     } catch (err: any) {
       console.error('Upload error:', err);
       await alert('Failed to upload sample: ' + (err?.message || 'Unknown error'));
     } finally {
       setUploadingId(null);
     }
  };

  const applyBulkLabel = () => {
    if (!dataLabel) return;
    setDataset(prev => prev.map(d => ({ ...d, label: dataLabel })));
  };

  const removeSample = (id: string) => {
    setDataset(prev => prev.filter(d => d.id !== id));
    if (selectedSample === id) setSelectedSample(null);
  };

  const handleStop = async () => {
     setIsRecording(false);
     isCanceledRef.current = true;
     if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch(e) {}
     }
  };

  const handleRecord = async () => {
    if (!dataLabel) {
        await alert('Enter a label first');
        return;
    }
    
    // IMU / Sensor recording logic
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
                if (parts.length >= (inputType === 'IMU' ? 3 : 1)) {
                    const features = parts.slice(0, inputType === 'IMU' ? 3 : parts.length).map(Number).filter(n => !isNaN(n));
                    if (features.length > 0) {
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
                               arch: architecture || null,
                               type: inputType === "IMU" ? "imu" : inputType === "Audio" ? "audio" : "sensor",
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
           await alert("Serial error: " + e.message);
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
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
       {/* Toolbar */}
       <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: 'relative' }}>
             <Tag size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'rgba(242,242,240,0.3)' }} />
             <input 
                placeholder="Dataset Label (e.g. apple, background)"
                value={dataLabel}
                onChange={(e) => setDataLabel(e.target.value)}
                style={{
                   width: '100%', background: '#0D0018', border: '1px solid rgba(157,39,222,0.3)',
                   color: '#F2F2F0', padding: '10px 12px 10px 32px', fontSize: 13, borderRadius: 8,
                   outline: 'none', boxSizing: 'border-box'
                }}
             />
          </div>
          {inputType === 'Image' && dataset.length > 0 && (
             <button onClick={applyBulkLabel} className="btn-ghost" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} /> Bulk Label
             </button>
          )}
          {inputType === 'Image' && (
             <>
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'rgba(157,39,222,0.1)', color: '#9D27DE', border: '1px solid rgba(157,39,222,0.3)', borderRadius: 8, padding: '0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
               >
                  <Upload size={16} /> Upload Dataset
               </button>
               <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
               <button 
                  onClick={handleSnapshot}
                  className="btn-primary"
                  style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}
               >
                  <Camera size={16} /> Snapshot
               </button>
             </>
          )}
          {inputType !== 'Image' && (
             <button 
                onClick={isRecording ? handleStop : handleRecord}
                disabled={(!isRecording && !dataLabel) || !architecture}
                style={{
                   background: isRecording ? '#EF4444' : (!dataLabel || !architecture ? 'rgba(157,39,222,0.3)' : '#9D27DE'), 
                   color: '#fff',
                   padding: '0 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', 
                   cursor: (!isRecording && !dataLabel) || !architecture ? 'not-allowed' : 'pointer',
                   display: 'flex', alignItems: 'center', gap: 8, transition: '0.2s',
                }}
             >
                {isRecording ? "Stop Recording" : `Record ${inputType}`}
             </button>
          )}
       </div>
       
       <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
          {/* Main Visualizer / Workspace */}
          <div style={{ flex: 2, background: '#0D0018', borderRadius: 12, border: '1px solid rgba(157,39,222,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.5)', fontFamily: 'JetBrains Mono', textTransform: 'uppercase' }}>
                     {selectedSample ? 'IMAGE CROPPER' : 'LIVE PREVIEW'}
                 </span>
                 {selectedSample && (
                    <span style={{ fontSize: 10, color: '#9D27DE' }}>Target: {res.width}x{res.height}px</span>
                 )}
             </div>
             
             <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050008' }}>
                 {inputType === 'Image' ? (
                    selectedSample ? (
                       <div ref={cropContainerRef} style={{ position: 'relative', maxWidth: '80%', maxHeight: '80%', userSelect: 'none' }}>
                           <img src={dataset.find(d => d.id === selectedSample)?.url} style={{ width: '100%', height: '100%', borderRadius: 4, pointerEvents: 'none' }} alt="Crop target" draggable={false} />
                           {/* Draggable Crop Box */}
                           <div 
                              onMouseDown={handleCropMouseDown}
                              style={{ 
                                 position: 'absolute', left: crop.x, top: crop.y, width: crop.size, height: crop.size,
                                 border: '2px solid #9D27DE', boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)', cursor: isDragging ? 'grabbing' : 'grab',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', transition: isDragging || isResizing ? 'none' : 'left 0.1s, top 0.1s, width 0.1s, height 0.1s',
                              }}
                           >
                              <Scissors size={16} color="#9D27DE" style={{ opacity: 0.5 }} />
                              {/* Resize corner handle */}
                              <div
                                 onMouseDown={handleResizeMouseDown}
                                 style={{
                                    position: 'absolute', bottom: -5, right: -5,
                                    width: 12, height: 12, borderRadius: 2,
                                    background: '#9D27DE', cursor: 'nwse-resize',
                                    border: '1px solid #12031C',
                                 }}
                              />
                           </div>
                        </div>
                    ) : (
                       <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )
                 ) : (
                    <>
                        {streamData.length === 0 && !isRecording && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(242,242,240,0.2)', fontSize: 12 }}>
                                Connect board and press Record...
                            </div>
                        )}
                        {streamData.map((d, i) => {
                            const hx = Math.min(100, Math.max(0, (d[0] + 16384) / 327.68)); 
                            const hy = d.length > 1 ? Math.min(100, Math.max(0, (d[1] + 16384) / 327.68)) : 0; 
                            const hz = d.length > 2 ? Math.min(100, Math.max(0, (d[2] + 16384) / 327.68)) : 0;
                            return (
                              <div key={i} style={{ flex: 1, display: 'flex', gap: 1, alignItems: 'flex-end', height: '100%' }}>
                                  <div style={{ flex: 1, background: '#ef4444', height: `${hx}%`, opacity: 0.8 }} />
                                  {d.length > 1 && <div style={{ flex: 1, background: '#22c55e', height: `${hy}%`, opacity: 0.8 }} />}
                                  {d.length > 2 && <div style={{ flex: 1, background: '#3b82f6', height: `${hz}%`, opacity: 0.8 }} />}
                              </div>
                            );
                        })}
                    </>
                 )}
             </div>

             {selectedSample && (
                <div style={{ padding: 12, background: 'rgba(157,39,222,0.05)', borderTop: '1px solid rgba(157,39,222,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input 
                         value={dataset.find(d => d.id === selectedSample)?.label || ''}
                         onChange={(e) => {
                            const val = e.target.value;
                            setDataset(prev => prev.map(d => d.id === selectedSample ? { ...d, label: val } : d));
                         }}
                         style={{ background: '#0D0018', border: '1px solid rgba(157,39,222,0.2)', color: '#F2F2F0', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}
                         placeholder="Label for this sample"
                      />
                   </div>
                   <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setSelectedSample(null)} className="btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
                      <button 
                         onClick={() => processAndSaveSample(dataset.find(d => d.id === selectedSample)!)} 
                         disabled={uploadingId === selectedSample || dataset.find(d => d.id === selectedSample)?.uploaded}
                         className="btn-primary" 
                         style={{ padding: '6px 16px', fontSize: 11, opacity: (uploadingId === selectedSample || dataset.find(d => d.id === selectedSample)?.uploaded) ? 0.6 : 1 }}
                      >
                         {uploadingId === selectedSample ? 'Uploading...' : dataset.find(d => d.id === selectedSample)?.uploaded ? 'Uploaded' : 'Crop & Save'}
                      </button>
                   </div>
                </div>
             )}
          </div>

          {/* Dataset Sidebar */}
          {inputType === 'Image' && (
             <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(242,242,240,0.5)', textTransform: 'uppercase' }}>Dataset Queue</span>
                   <span style={{ fontSize: 10, background: 'rgba(157,39,222,0.2)', color: '#9D27DE', padding: '2px 6px', borderRadius: 4 }}>{dataset.length} pending</span>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr', gap: 8, paddingRight: 4 }}>
                   {dataset.map(item => (
                      <div 
                         key={item.id} 
                         onClick={() => setSelectedSample(item.id)}
                         style={{ 
                            background: selectedSample === item.id ? 'rgba(157,39,222,0.1)' : '#0D0018', 
                            border: `1px solid ${selectedSample === item.id ? '#9D27DE' : 'rgba(157,39,222,0.1)'}`,
                            borderRadius: 8, padding: 8, cursor: 'pointer', transition: '0.2s', position: 'relative'
                         }}
                      >
                         <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <img src={item.url} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} alt="Preview" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                               <p style={{ fontSize: 11, fontWeight: 600, color: '#F2F2F0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</p>
                               <p style={{ fontSize: 9, color: 'rgba(242,242,240,0.4)', margin: '2px 0 0' }}>
                                   {item.uploaded ? <span style={{ color: '#22c55e' }}><Check size={10} style={{ display: 'inline', marginBottom: -2 }} /> Uploaded</span> : 'Ready to crop'}
                               </p>
                            </div>
                         </div>
                         <button 
                            onClick={(e) => { e.stopPropagation(); removeSample(item.id); }}
                            style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'rgba(239,68,68,0.4)', cursor: 'pointer', padding: 4 }}
                         >
                            <Trash2 size={12} />
                         </button>
                      </div>
                   ))}
                   {dataset.length === 0 && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, padding: '40px 0' }}>
                         <Upload size={32} />
                         <p style={{ fontSize: 10, marginTop: 8, textAlign: 'center' }}>No images yet<br />Upload or take snapshot</p>
                      </div>
                   )}
                </div>
             </div>
          )}
       </div>

       {/* Cloud Dataset Summary */}
       <div style={{ marginTop: 16, background: '#0D0018', borderRadius: 8, border: '1px solid rgba(157,39,222,0.15)', overflow: 'hidden' }}>
           <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.5)', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={12} /> Cloud Dataset — {samples} total
               </span>
               <button onClick={loadCloudSamples} disabled={loadingCloud} style={{ background: 'none', border: 'none', color: 'rgba(157,39,222,0.6)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <RefreshCw size={10} style={{ animation: loadingCloud ? 'spin 1s linear infinite' : 'none' }} /> Refresh
               </button>
           </div>
           <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(() => {
                 const groups: Record<string, number> = {};
                 cloudSamples.forEach(s => { groups[s.label] = (groups[s.label] || 0) + 1; });
                 const entries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
                 if (entries.length === 0) return <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.3)', padding: 4 }}>No samples uploaded yet</span>;
                 return entries.map(([label, count]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(157,39,222,0.08)', borderRadius: 6, padding: '4px 8px', border: '1px solid rgba(157,39,222,0.15)' }}>
                       <span style={{ fontSize: 11, color: '#E0D8F0', fontWeight: 600 }}>{label}</span>
                       <span style={{ fontSize: 10, color: 'rgba(242,242,240,0.4)' }}>×{count}</span>
                       <button onClick={() => clearLabelSamples(label)} title={`Delete all "${label}" samples`} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.5)', cursor: 'pointer', padding: 0, display: 'flex' }}><Trash2 size={10} /></button>
                    </div>
                 ));
              })()}
           </div>
           {!architecture && <div style={{ padding: '4px 12px 8px', fontSize: 10, color: '#f59e0b' }}>⚠ Select an architecture in the Training tab</div>}
       </div>

       <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
