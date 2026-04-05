import { useState, useRef, useEffect } from 'react';
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ML_ARCHITECTURES } from '../boards/MLCapabilities';
import { Camera, Upload, Trash2, Scissors, Check, Tag } from 'lucide-react';

export default function DataCollection({ projectId, architecture }: { projectId: string; boardId: string; task?: string; architecture?: string }) {
  const [dataLabel, setDataLabel] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [streamData, setStreamData] = useState<number[][]>([]);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dataset, setDataset] = useState<{id: string, url: string, label: string, blob?: Blob}[]>([]);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [crop] = useState({ x: 0, y: 0, size: 200 });

  const currentArch = architecture ? ML_ARCHITECTURES[architecture] : null;
  const inputType = currentArch ? currentArch.recommendedInput : "IMU";
  const res = currentArch?.inputResolution || { width: 96, height: 96 };

  // Cleanup video stream
  useEffect(() => {
     if (inputType === 'Image' && videoRef.current) {
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            if (videoRef.current) videoRef.current.srcObject = stream;
        }).catch(err => console.error("Camera access denied", err));
     } else {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
     }
  }, [inputType]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const files = Array.from(e.target.files || []);
     files.forEach(file => {
        const url = URL.createObjectURL(file);
        setDataset(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), url, label: dataLabel || 'unlabeled' }]);
     });
  };

  const handleSnapshot = () => {
     if (!videoRef.current) return;
     const canvas = document.createElement('canvas');
     canvas.width = videoRef.current.videoWidth;
     canvas.height = videoRef.current.videoHeight;
     const ctx = canvas.getContext('2d');
     ctx?.drawImage(videoRef.current, 0, 0);
     canvas.toBlob(blob => {
        if (blob) {
           const url = URL.createObjectURL(blob);
           setDataset(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), url, label: dataLabel || 'snapshot', blob }]);
        }
     });
  };

  const processAndSaveSample = async (sample: typeof dataset[0]) => {
     if (!canvasRef.current || !res) return;
     const img = new Image();
     img.src = sample.url;
     await new Promise(r => img.onload = r);

     const canvas = canvasRef.current;
     canvas.width = res.width;
     canvas.height = res.height;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;

     // Simple crop logic based on current state (scaled to image size)
     // In a real app we'd use a proper library, but we'll simulate the crop here
     ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, res.width, res.height);
     
     const finalBlob = await new Promise<Blob|null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
     if (finalBlob && projectId) {
        // Here we'd upload to Storage, but for now we'll simulate sample logging
        await addDoc(collection(db, "projects", projectId, "ml_samples"), {
            label: sample.label,
            arch: architecture,
            resolution: res,
            type: "image",
            createdAt: serverTimestamp()
        });
        setSamples(s => s + 1);
        setDataset(prev => prev.filter(d => d.id !== sample.id));
        setSelectedSample(null);
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
    if (!dataLabel) return alert('Enter a label first');
    
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
                       <div style={{ position: 'relative', maxWidth: '80%', maxHeight: '80%' }}>
                          <img src={dataset.find(d => d.id === selectedSample)?.url} style={{ width: '100%', height: '100%', borderRadius: 4 }} alt="Crop target" />
                          {/* Simulated Crop Box */}
                          <div style={{ 
                             position: 'absolute', left: crop.x, top: crop.y, width: crop.size, height: crop.size,
                             border: '2px solid #9D27DE', boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)', cursor: 'move',
                             display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                             <Scissors size={16} color="#9D27DE" />
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
                      <button onClick={() => processAndSaveSample(dataset.find(d => d.id === selectedSample)!)} className="btn-primary" style={{ padding: '6px 16px', fontSize: 11 }}>Crop & Save</button>
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
                               <p style={{ fontSize: 9, color: 'rgba(242,242,240,0.4)', margin: '2px 0 0' }}>Ready to crop</p>
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

       {/* Footer Stats */}
       <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ padding: '6px 12px', background: 'rgba(157,39,222,0.1)', borderRadius: 20, border: '1px solid rgba(157,39,222,0.2)' }}>
                   <span style={{ fontSize: 12, color: '#E0D8F0', fontWeight: 600 }}>{samples}</span>
                   <span style={{ fontSize: 11, color: 'rgba(242,242,240,0.5)', marginLeft: 6 }}>Samples in Cloud</span>
               </div>
               {!architecture && (
                   <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Please select an architecture in the Training tab.</span>
               )}
           </div>
       </div>

       <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
