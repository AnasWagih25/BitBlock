import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import JSZip from "jszip";
import smartcrop from "smartcrop";
import { db, storage } from "../lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  query,
  where,
  documentId,
  onSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { ML_ARCHITECTURES } from "../boards/MLCapabilities";
import {
  Camera,
  Upload,
  Trash2,
  Scissors,
  Check,
  Tag,
  Database,
  RefreshCw,
  FolderOpen,
  Save,
  CheckCircle,
  Circle,
  LayoutGrid,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { useAppDialog } from "../contexts/DialogContext";

interface SavedDataset {
  id: string;
  name: string;
  sampleCount: number;
  labels: Record<string, number>;
  architecture?: string;
  selected: boolean;
  createdAt: any;
  sampleIds?: string[];
  /** Exact class label this snapshot is tied to (all sampleIds share this label). */
  snapshotLabel?: string;
}

interface CloudSample {
  id: string;
  label: string;
  type?: string;
  imageUrl?: string;
  features?: number[];
  objects?: { label: string; cx: number; cy: number }[];
  createdAt?: { seconds?: number; toMillis?: () => number };
  arch?: string;
  detection?: string;
  resolution?: { width: number; height: number };
}

type DatasetItem = {
  id: string;
  url: string;
  label: string;
  blob?: Blob;
  uploaded?: boolean;
  objects?: { label: string; cx: number; cy: number }[];
  uploadStatus?: "uploading" | "error";
  savedCrop?: {
    x: number;
    y: number;
    size: number;
    renderedWidth: number;
    renderedHeight: number;
  };
};

type ZipFolderReview = {
  folderPath: string;
  folderName: string;
  sampleFileName: string;
  entries: any[];
  labelStrategy: "folderName" | "fileName" | "custom";
  customLabel: string;
  selected: boolean;
  importLimit: number | "";
};

const chunkIds = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Firestore may return sampleIds as an array or (from some writers) as an object map. */
function coerceSampleIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
          .map((x) => x.trim()),
      ),
    ];
  }
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const vals = Object.values(raw as Record<string, unknown>);
    return [
      ...new Set(
        vals
          .filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
          .map((x) => x.trim()),
      ),
    ];
  }
  return [];
}

function normLabel(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function normalizeSavedDatasetDoc(d: QueryDocumentSnapshot): SavedDataset {
  const raw = d.data() as Record<string, unknown>;
  const sampleIds = coerceSampleIds(raw.sampleIds);
  const labels =
    raw.labels != null &&
    typeof raw.labels === "object" &&
    !Array.isArray(raw.labels)
      ? (raw.labels as Record<string, number>)
      : {};
  const snapshotLabel =
    typeof raw.snapshotLabel === "string" && normLabel(raw.snapshotLabel)
      ? normLabel(raw.snapshotLabel)
      : undefined;
  return {
    ...(raw as unknown as Omit<SavedDataset, "id">),
    id: d.id,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.replace(/Â·/g, "·").replace(/Ã—/g, "×").trim()
        : "(unnamed)",
    sampleIds,
    sampleCount: sampleIds.length,
    labels,
    snapshotLabel,
    selected: typeof raw.selected === "boolean" ? raw.selected : false,
    architecture:
      typeof raw.architecture === "string" ? raw.architecture : undefined,
    createdAt: raw.createdAt,
  } as SavedDataset;
}

/** Group key for UI: explicit snapshot label, else single inferred class, else mixed. */
function datasetGroupKey(
  ds: SavedDataset,
  remoteLabels: Record<string, number>,
): string {
  if (normLabel(ds.snapshotLabel)) return normLabel(ds.snapshotLabel);
  const src =
    Object.keys(remoteLabels).length > 0 ? remoteLabels : ds.labels || {};
  const keys = Object.keys(src);
  if (keys.length === 1) return normLabel(keys[0]) || keys[0];
  return "Other datasets";
}

export default function DataCollection({
  projectId,
  architecture,
}: {
  projectId: string;
  boardId: string;
  task?: string;
  architecture?: string;
}) {
  const { alert, confirm } = useAppDialog();
  const [dataLabel, setDataLabel] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState(0);
  const [streamData, setStreamData] = useState<number[][]>([]);
  const [cloudSamples, setCloudSamples] = useState<CloudSample[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [zipReview, setZipReview] = useState<ZipFolderReview[] | null>(null);
  const [smartCropAssistantOpen, setSmartCropAssistantOpen] = useState(false);
  const [expandedCloudGroups, setExpandedCloudGroups] = useState<Set<string>>(
    new Set(),
  );
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [datasetName, setDatasetName] = useState("");
  const [snapshotLabelPick, setSnapshotLabelPick] = useState("");
  const [dataCollectionTab, setDataCollectionTab] = useState<
    "capture" | "cloud"
  >("capture");
  const [selectedCloudIds, setSelectedCloudIds] = useState<Set<string>>(
    new Set(),
  );
  const [cloudFilter, setCloudFilter] = useState("");
  const [savedSnapshotsExpanded, setSavedSnapshotsExpanded] = useState(true);
  /** Loaded on expand: ordered slots matching snapshot sampleIds (Firestore `in` is unordered). */
  const [expandedPreview, setExpandedPreview] = useState<{
    datasetId: string;
    samples: (CloudSample | null)[];
  } | null>(null);
  const [expandedPreviewLoading, setExpandedPreviewLoading] = useState(false);
  const [appendDsId, setAppendDsId] = useState("");
  const [relabelModal, setRelabelModal] = useState<{ ids: string[] } | null>(
    null,
  );
  const [relabelValue, setRelabelValue] = useState("");
  const [previewImageModal, setPreviewImageModal] = useState<{
    url: string;
    label: string;
  } | null>(null);
  /** Label histogram per dataset id from Firestore samples (not client cache). */
  const [datasetRemoteLabels, setDatasetRemoteLabels] = useState<
    Record<string, Record<string, number>>
  >({});
  /** Progress tracker for bulk deletion (0-100, or null when idle). */
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isCanceledRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dataset, setDataset] = useState<DatasetItem[]>([]);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  /** FOMO: adjust square crop vs click centroids inside crop (normalized 0"“1 in crop space). */
  const [fomoMode, setFomoMode] = useState<"crop" | "mark">("crop");
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
    cropX: 0,
    cropY: 0,
  });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, size: 200 });
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const expandPreviewSeq = useRef(0);

  const currentArch = architecture ? ML_ARCHITECTURES[architecture] : null;
  const inputType = currentArch ? currentArch.recommendedInput : "IMU";
  const res = currentArch?.inputResolution || { width: 96, height: 96 };
  const isFomo = architecture === "fomo";

  const loadCloudSamples = useCallback(async () => {
    if (!projectId) return;
    setLoadingCloud(true);
    try {
      const snap = await getDocs(
        collection(db, "projects", projectId, "ml_samples"),
      );
      const items: CloudSample[] = snap.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as CloudSample,
      );
      setCloudSamples(items);
      setSamples(items.length);
    } catch (e) {
      console.error("Failed to load cloud samples", e);
    } finally {
      setLoadingCloud(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setCloudSamples([]);
      setSamples(0);
      setLoadingCloud(false);
      return;
    }
    loadCloudSamples();
  }, [projectId, loadCloudSamples]);

  useEffect(() => {
    if (!projectId) {
      setSavedDatasets([]);
      return;
    }
    const col = collection(db, "projects", projectId, "ml_datasets");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const items = snap.docs.map((d) => normalizeSavedDatasetDoc(d));
        items.sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
        setSavedDatasets(items);
      },
      (e) => console.error("ml_datasets listener failed", e),
    );
    return () => unsub();
  }, [projectId]);

  /** Resolve ml_samples by id (Firestore truth). Max 30 ids per `in` query. */
  const fetchSamplesByIds = useCallback(
    async (ids: string[]): Promise<CloudSample[]> => {
      if (!projectId || ids.length === 0) return [];
      const unique = [
        ...new Set(ids.filter((id) => typeof id === "string" && id.length > 0)),
      ];
      const out: CloudSample[] = [];
      for (const part of chunkIds(unique, 30)) {
        const q = query(
          collection(db, "projects", projectId, "ml_samples"),
          where(documentId(), "in", part),
        );
        const snap = await getDocs(q);
        snap.docs.forEach((d) =>
          out.push({ ...d.data(), id: d.id } as CloudSample),
        );
      }
      return out;
    },
    [projectId],
  );

  const cloudSampleById = useMemo(
    () => new Map(cloudSamples.map((s) => [s.id, s])),
    [cloudSamples],
  );
  const fomoLabelSuggestions = useMemo(() => {
    const set = new Set<string>();
    dataset.forEach((d) => {
      const l = normLabel(d.label);
      if (l) set.add(l);
    });
    cloudSamples.forEach((s) => {
      const l = normLabel(s.label);
      if (l) set.add(l);
    });
    return [...set].sort((a, b) => a.localeCompare(b)).slice(0, 8);
  }, [dataset, cloudSamples]);
  const selectedQueueItem = useMemo(
    () =>
      selectedSample
        ? (dataset.find((d) => d.id === selectedSample) ?? null)
        : null,
    [dataset, selectedSample],
  );

  const distinctCloudLabels = useMemo(() => {
    const set = new Set<string>();
    cloudSamples.forEach((s) => {
      const l = normLabel(s.label);
      if (l) set.add(l);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [cloudSamples]);

  useEffect(() => {
    if (distinctCloudLabels.length === 0) {
      setSnapshotLabelPick("");
      return;
    }
    setSnapshotLabelPick((cur) =>
      cur && distinctCloudLabels.includes(cur) ? cur : distinctCloudLabels[0],
    );
  }, [distinctCloudLabels]);

  const savedDatasetsGrouped = useMemo(() => {
    const groups = new Map<string, SavedDataset[]>();
    for (const ds of savedDatasets) {
      const remote = datasetRemoteLabels[ds.id] || {};
      const key = datasetGroupKey(ds, remote);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ds);
    }
    for (const list of groups.values()) {
      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
    }
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === "Other datasets") return 1;
      if (b[0] === "Other datasets") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [savedDatasets, datasetRemoteLabels]);

  const datasetRemoteSyncKey = useMemo(
    () =>
      savedDatasets
        .map((d) => `${d.id}:${(d.sampleIds || []).join(",")}`)
        .join("|"),
    [savedDatasets],
  );

  useEffect(() => {
    if (!projectId || savedDatasets.length === 0) {
      setDatasetRemoteLabels({});
      return;
    }
    let cancelled = false;
    const allIds = [
      ...new Set(savedDatasets.flatMap((ds) => ds.sampleIds || [])),
    ];
    if (allIds.length === 0) {
      setDatasetRemoteLabels(
        Object.fromEntries(savedDatasets.map((ds) => [ds.id, {}])),
      );
      return;
    }
    void (async () => {
      const fetched = await fetchSamplesByIds(allIds);
      if (cancelled) return;
      const byId = new Map(fetched.map((s) => [s.id, s]));
      const next: Record<string, Record<string, number>> = {};
      for (const ds of savedDatasets) {
        const lab: Record<string, number> = {};
        for (const id of ds.sampleIds || []) {
          const s = byId.get(id);
          if (s?.label != null && String(s.label).trim()) {
            const lb = String(s.label).trim();
            lab[lb] = (lab[lb] || 0) + 1;
          }
        }
        next[ds.id] = lab;
      }
      setDatasetRemoteLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, datasetRemoteSyncKey, fetchSamplesByIds]);

  const saveAsDataset = async () => {
    if (!projectId || !datasetName.trim()) return;
    try {
      const snap = await getDocs(
        collection(db, "projects", projectId, "ml_samples"),
      );
      const items: CloudSample[] = snap.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as CloudSample,
      );
      if (items.length === 0) {
        await alert("No samples in the cloud to snapshot yet.");
        return;
      }
      const labels: Record<string, number> = {};
      items.forEach((s) => {
        const lb = normLabel(s.label) || "-";
        labels[lb] = (labels[lb] || 0) + 1;
      });
      await addDoc(collection(db, "projects", projectId, "ml_datasets"), {
        name: datasetName.trim(),
        sampleCount: items.length,
        labels,
        architecture: architecture || null,
        selected: false,
        sampleIds: items.map((s) => s.id),
        createdAt: serverTimestamp(),
      });
      setDatasetName("");
    } catch (e: any) {
      await alert("Failed to save dataset: " + e.message);
    }
  };

  const saveLabelSnapshot = async () => {
    const pick = normLabel(snapshotLabelPick);
    if (!projectId || !pick) {
      await alert(
        "Pick a label from the list (samples must already use that exact label).",
      );
      return;
    }
    try {
      const snap = await getDocs(
        collection(db, "projects", projectId, "ml_samples"),
      );
      const items: CloudSample[] = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }) as CloudSample)
        .filter((s) => normLabel(s.label) === pick);
      if (items.length === 0) {
        await alert(`No samples with label "${pick}".`);
        return;
      }
      const name =
        normLabel(datasetName) || `${pick} · ${new Date().toLocaleString()}`;
      await addDoc(collection(db, "projects", projectId, "ml_datasets"), {
        name,
        snapshotLabel: pick,
        sampleCount: items.length,
        labels: { [pick]: items.length },
        architecture: architecture || null,
        selected: false,
        sampleIds: items.map((s) => s.id),
        createdAt: serverTimestamp(),
      });
      setDatasetName("");
    } catch (e: any) {
      await alert("Failed to save label snapshot: " + (e?.message || "error"));
    }
  };

  const saveSelectionAsNewDataset = async () => {
    if (!projectId || !datasetName.trim()) {
      await alert("Enter a name for the new dataset.");
      return;
    }
    if (selectedCloudIds.size === 0) {
      await alert(
        "Select one or more samples in the grid (checkboxes), then save.",
      );
      return;
    }
    try {
      const ids = Array.from(selectedCloudIds);
      const fetched = await fetchSamplesByIds(ids);
      if (fetched.length === 0) {
        await alert("Could not load those samples from Firestore.");
        return;
      }
      const labs = [
        ...new Set(fetched.map((s) => normLabel(s.label)).filter(Boolean)),
      ];
      if (labs.length !== 1) {
        await alert(
          "Selected samples must share one exact label. Use bulk relabel first, or save one label at a time.",
        );
        return;
      }
      const lab = labs[0];
      await addDoc(collection(db, "projects", projectId, "ml_datasets"), {
        name: datasetName.trim(),
        snapshotLabel: lab,
        sampleCount: fetched.length,
        labels: { [lab]: fetched.length },
        architecture: architecture || null,
        selected: false,
        sampleIds: fetched.map((s) => s.id),
        createdAt: serverTimestamp(),
      });
      setDatasetName("");
      clearCloudSelection();
    } catch (e: any) {
      await alert("Failed to save dataset: " + (e?.message || "error"));
    }
  };

  const toggleDatasetSelection = async (
    dsId: string,
    currentlySelected: boolean,
  ) => {
    if (!projectId) return;
    try {
      await updateDoc(doc(db, "projects", projectId, "ml_datasets", dsId), {
        selected: !currentlySelected,
      });
      setSavedDatasets((prev) =>
        prev.map((d) =>
          d.id === dsId ? { ...d, selected: !currentlySelected } : d,
        ),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSavedDataset = async (dsId: string, dsName: string) => {
    if (!projectId) return;
    const ok = await confirm(
      `Delete dataset "${dsName}"? This only removes the dataset, not the underlying samples.`,
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "projects", projectId, "ml_datasets", dsId));
      setSavedDatasets((prev) => prev.filter((d) => d.id !== dsId));
      setExpandedPreview((prev) => (prev?.datasetId === dsId ? null : prev));
    } catch (e) {
      console.error(e);
    }
  };

  // Camera stream management - persist stream in ref so it survives re-renders
  const streamRef = useRef<MediaStream | null>(null);

  const clampCropToContainer = useCallback(
    (nextCrop: { x: number; y: number; size: number }) => {
      const imageEl = cropImageRef.current;
      if (!imageEl) return nextCrop;

      const maxSize = Math.max(
        40,
        Math.min(imageEl.clientWidth, imageEl.clientHeight),
      );
      const size = Math.min(Math.max(40, nextCrop.size), maxSize);
      const maxX = Math.max(0, imageEl.clientWidth - size);
      const maxY = Math.max(0, imageEl.clientHeight - size);

      return {
        x: Math.min(Math.max(0, nextCrop.x), maxX),
        y: Math.min(Math.max(0, nextCrop.y), maxY),
        size,
      };
    },
    [],
  );

  useEffect(() => {
    if (inputType === "Image") {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // Keep a natural camera stream to avoid driver-level center crop/zoom.
            aspectRatio: { ideal: 4 / 3 },
          },
        })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch((err) => console.error("Camera access denied", err));
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [inputType]);

  // Re-attach stream when video element remounts (e.g. after state-driven re-renders)
  useEffect(() => {
    if (
      inputType === "Image" &&
      videoRef.current &&
      streamRef.current &&
      !videoRef.current.srcObject
    ) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  useEffect(() => {
    if (!selectedSample) return;
    // FOMO flow is centered on placing object centers first.
    setFomoMode(isFomo ? "mark" : "crop");
  }, [selectedSample, isFomo]);

  useEffect(() => {
    if (!selectedSample) return;
    const updateCropFromRenderedImage = () => {
      const imageEl = cropImageRef.current;
      if (!imageEl || imageEl.clientWidth === 0 || imageEl.clientHeight === 0)
        return;
      const initialSize = Math.round(
        Math.min(imageEl.clientWidth, imageEl.clientHeight) * 0.6,
      );
      const newCrop = clampCropToContainer({
        x: Math.round((imageEl.clientWidth - initialSize) / 2),
        y: Math.round((imageEl.clientHeight - initialSize) / 2),
        size: initialSize,
      });
      setCrop(newCrop);
      setDataset((prev) =>
        prev.map((d) =>
          d.id === selectedSample
            ? {
                ...d,
                savedCrop: {
                  ...newCrop,
                  renderedWidth: imageEl.clientWidth,
                  renderedHeight: imageEl.clientHeight,
                },
              }
            : d,
        ),
      );
    };

    // Wait for image to actually load before measuring dimensions
    const imageEl = cropImageRef.current;
    if (imageEl) {
      if (imageEl.complete && imageEl.naturalWidth > 0) {
        updateCropFromRenderedImage();
      } else {
        const onLoad = () => updateCropFromRenderedImage();
        imageEl.addEventListener("load", onLoad);
        window.addEventListener("resize", updateCropFromRenderedImage);
        return () => {
          imageEl.removeEventListener("load", onLoad);
          window.removeEventListener("resize", updateCropFromRenderedImage);
        };
      }
    }

    window.addEventListener("resize", updateCropFromRenderedImage);
    return () =>
      window.removeEventListener("resize", updateCropFromRenderedImage);
  }, [selectedSample, clampCropToContainer]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isFomo && !dataLabel.trim()) {
      void alert(
        "Note: If uploading images directly (not zip), you may want to set a label first. If uploading a zip, you can choose labels automatically.",
      );
    }
    const files = Array.from(e.target.files || []);
    const newItems: DatasetItem[] = [];

    for (const file of files) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);

          const foldersMap = new Map<string, ZipFolderReview>();

          for (const [relativePath, zipEntry] of Object.entries(
            contents.files,
          )) {
            if (zipEntry.dir) continue;
            if (!relativePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue;

            const parts = relativePath.split("/");
            const fileName = parts[parts.length - 1];
            const folderPath =
              parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";
            const folderName =
              parts.length > 1 ? parts[parts.length - 2] : "Root";

            if (!foldersMap.has(folderPath)) {
              foldersMap.set(folderPath, {
                folderPath,
                folderName,
                sampleFileName: fileName,
                entries: [],
                labelStrategy: parts.length > 1 ? "folderName" : "fileName",
                customLabel: "",
                selected: true,
                importLimit: "",
              });
            }
            foldersMap.get(folderPath)!.entries.push(zipEntry);
          }

          if (foldersMap.size > 0) {
            setZipReview(Array.from(foldersMap.values()));
            if (fileInputRef.current) fileInputRef.current.value = "";
            return; // Stop and wait for user review via modal
          }
        } catch (err: any) {
          await alert("Failed to process zip file: " + err.message);
        }
      } else {
        const url = URL.createObjectURL(file);
        const lab = dataLabel.trim() || (isFomo ? "object" : "");
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          url,
          label: lab,
          ...(isFomo
            ? { objects: [] as { label: string; cx: number; cy: number }[] }
            : {}),
        });
      }
    }

    if (newItems.length > 0) {
      setDataset((prev) => [...prev, ...newItems]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSnapshot = () => {
    if (!isFomo && !dataLabel.trim()) {
      void alert("Enter a label before taking a snapshot");
      return;
    }
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const lab = dataLabel.trim() || (isFomo ? "object" : "");
        setDataset((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            url,
            label: lab,
            blob,
            ...(isFomo
              ? { objects: [] as { label: string; cx: number; cy: number }[] }
              : {}),
          },
        ]);
      }
    });
  };

  /**
   * Extract the Firebase Storage path from either a download URL or a raw path.
   * Firebase download URLs look like:
   *   https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH%2FENCODED?alt=media&token=...
   * We need to extract and decode PATH/ENCODED.
   */
  const extractStoragePath = (urlOrPath: string): string => {
    if (urlOrPath.startsWith("https://firebasestorage.googleapis.com") || urlOrPath.startsWith("https://storage.googleapis.com")) {
      try {
        const url = new URL(urlOrPath);
        // Path is after /o/ and before the query string
        const match = url.pathname.match(/\/o\/(.+)$/);
        if (match) return decodeURIComponent(match[1]);
      } catch { /* fall through */ }
    }
    // Already a storage path
    return urlOrPath;
  };

  const clearLabelSamples = async (label: string) => {
    if (!projectId) return;
    const ok = await confirm(`Delete all "${label}" samples from cloud?`);
    if (!ok) return;
    const toDelete = cloudSamples.filter((s) => s.label === label);

    setCloudSamples((prev) => prev.filter((s) => s.label !== label));
    setSamples((prev) => Math.max(0, prev - toDelete.length));
    setSelectedCloudIds((prev) => {
      const n = new Set(prev);
      toDelete.forEach((s) => n.delete(s.id));
      return n;
    });

    // High-concurrency parallel deletion with progress
    setDeleteProgress({ done: 0, total: toDelete.length });
    let completed = 0;
    const chunkSize = 50;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map(async (s) => {
          if (s.imageUrl) {
            try {
              const path = extractStoragePath(s.imageUrl);
              await deleteObject(storageRef(storage, path));
            } catch (e) {
              console.warn("Storage delete failed", e);
            }
          }
          try {
            await deleteDoc(doc(db, "projects", projectId, "ml_samples", s.id));
          } catch (e) {
            console.error("Doc delete failed", e);
          }
          completed++;
          setDeleteProgress({ done: completed, total: toDelete.length });
        }),
      );
    }
    setDeleteProgress(null);
  };

  const formatSampleDate = (s: CloudSample) => {
    const t =
      s.createdAt?.toMillis?.() ??
      (s.createdAt?.seconds ? s.createdAt.seconds * 1000 : 0);
    if (!t) return "-";
    return new Date(t).toLocaleString();
  };

  const filteredCloudSamples = cloudSamples.filter((s) => {
    if (!cloudFilter.trim()) return true;
    const q = cloudFilter.toLowerCase();
    if (s.label?.toLowerCase().includes(q)) return true;
    if (s.arch?.toLowerCase().includes(q)) return true;
    if (s.id.toLowerCase().includes(q)) return true;
    return false;
  });

  const samplesGroupedByLabel = useMemo(() => {
    const m = new Map<string, CloudSample[]>();
    for (const s of filteredCloudSamples) {
      const key = (s.label && String(s.label).trim()) || "-";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredCloudSamples]);

  const toggleCloudSelect = (id: string) => {
    setSelectedCloudIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllFiltered = () => {
    setSelectedCloudIds(new Set(filteredCloudSamples.map((s) => s.id)));
  };

  const clearCloudSelection = () => setSelectedCloudIds(new Set());

  const deleteCloudSampleOne = async (id: string) => {
    if (!projectId) return;
    const ok = await confirm(
      "Delete this sample from the cloud? This cannot be undone.",
    );
    if (!ok) return;

    const sample = cloudSamples.find((s) => s.id === id);

    // Optimistic UI update
    setCloudSamples((prev) => prev.filter((s) => s.id !== id));
    setSamples((c) => Math.max(0, c - 1));
    setSelectedCloudIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });

    try {
      if (sample?.imageUrl) {
        try {
          const path = extractStoragePath(sample.imageUrl);
          await deleteObject(storageRef(storage, path));
        } catch (e) {
          console.warn("Storage deletion failed:", e);
        }
      }
      await deleteDoc(doc(db, "projects", projectId, "ml_samples", id));
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  };

  const bulkDeleteSelected = async () => {
    if (!projectId || selectedCloudIds.size === 0) return;
    const ok = await confirm(
      `Delete ${selectedCloudIds.size} selected samples permanently?`,
    );
    if (!ok) return;

    const toDelete = cloudSamples.filter((s) => selectedCloudIds.has(s.id));
    const deletedCount = toDelete.length;

    // Optimistic UI update for immediate feedback
    setCloudSamples((prev) => prev.filter((s) => !selectedCloudIds.has(s.id)));
    setSamples((c) => Math.max(0, c - deletedCount));
    clearCloudSelection();

    // High-concurrency parallel deletion with progress
    setDeleteProgress({ done: 0, total: toDelete.length });
    let completed = 0;
    const chunkSize = 50;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map(async (sample) => {
          if (sample.imageUrl) {
            try {
              const path = extractStoragePath(sample.imageUrl);
              await deleteObject(storageRef(storage, path));
            } catch (e) {
              console.warn("Storage deletion failed:", e);
            }
          }
          try {
            await deleteDoc(
              doc(db, "projects", projectId, "ml_samples", sample.id),
            );
          } catch (e) {
            console.error("Doc deletion failed:", e);
          }
          completed++;
          setDeleteProgress({ done: completed, total: toDelete.length });
        }),
      );
    }
    setDeleteProgress(null);
  };

  const openRelabel = (ids: string[]) => {
    if (ids.length === 0) return;
    const first = cloudSamples.find((s) => s.id === ids[0]);
    setRelabelValue(first?.label || "");
    setRelabelModal({ ids });
  };

  const applyRelabel = async () => {
    if (!projectId || !relabelModal) return;
    const v = relabelValue.trim();
    if (!v) {
      await alert("Enter a label.");
      return;
    }
    try {
      for (const id of relabelModal.ids) {
        await updateDoc(doc(db, "projects", projectId, "ml_samples", id), {
          label: v,
        });
      }
      setCloudSamples((prev) =>
        prev.map((s) =>
          relabelModal.ids.includes(s.id) ? { ...s, label: v } : s,
        ),
      );
      setRelabelModal(null);
      setRelabelValue("");
      clearCloudSelection();
    } catch (e: any) {
      await alert("Relabel failed: " + (e?.message || "error"));
    }
  };

  const addSelectionToSavedDataset = async () => {
    if (!projectId || !appendDsId || selectedCloudIds.size === 0) {
      await alert("Select samples and choose a saved dataset.");
      return;
    }
    try {
      const ref = doc(db, "projects", projectId, "ml_datasets", appendDsId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await alert("Dataset not found.");
        return;
      }
      const dataRaw = snap.data() as Record<string, unknown>;
      const data = snap.data() as SavedDataset;
      const targetSl = normLabel(data.snapshotLabel);
      if (targetSl) {
        const picked = cloudSamples.filter((s) => selectedCloudIds.has(s.id));
        if (picked.length !== selectedCloudIds.size) {
          await alert(
            "Some selected ids are missing from the current sample list. Refresh and try again.",
          );
          return;
        }
        if (picked.some((s) => normLabel(s.label) !== targetSl)) {
          await alert(
            `That dataset is only for label "${targetSl}". Append samples that use exactly this label, or pick an "Other datasets" dataset.`,
          );
          return;
        }
      }
      const existing = coerceSampleIds(dataRaw.sampleIds);
      const merged = [
        ...new Set([...existing, ...Array.from(selectedCloudIds)]),
      ];
      const resolved = await fetchSamplesByIds(merged);
      const foundIds = new Set(resolved.map((s) => s.id));
      const prunedIds = merged.filter((id) => foundIds.has(id));
      if (prunedIds.length === 0 && merged.length > 0) {
        await alert(
          "None of the dataset ids resolve to samples in Firestore. Fix or delete this saved dataset.",
        );
        return;
      }
      const labels: Record<string, number> = {};
      resolved.forEach((s) => {
        const lb = normLabel(s.label) || "-";
        labels[lb] = (labels[lb] || 0) + 1;
      });
      await updateDoc(ref, {
        sampleIds: prunedIds,
        sampleCount: prunedIds.length,
        labels,
      });
      clearCloudSelection();
      setAppendDsId("");
      const dropped = merged.length - prunedIds.length;
      await alert(
        `Updated "${data.name}": ${prunedIds.length} sample id${prunedIds.length === 1 ? "" : "s"} in dataset.` +
          (dropped > 0
            ? ` (${dropped} id(s) not found in Firestore were removed.)`
            : ""),
      );
    } catch (e: any) {
      await alert("Update failed: " + (e?.message || "error"));
    }
  };

  // --- Crop drag handlers ---
  const handleCropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isFomo && fomoMode === "mark") return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        cropX: crop.x,
        cropY: crop.y,
      });
    },
    [crop, isFomo, fomoMode],
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isFomo && fomoMode === "mark") return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      setResizeStart({ x: e.clientX, y: e.clientY, size: crop.size });
    },
    [crop.size, isFomo, fomoMode],
  );

  const handleFomoMarkClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isFomo || fomoMode !== "mark" || !selectedSample) return;
      if (!dataLabel.trim()) {
        void alert(
          "Set the current class in the label field, then click the image to place an object center.",
        );
        return;
      }
      const img = cropImageRef.current;
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const u = (px - crop.x) / crop.size;
      const v = (py - crop.y) / crop.size;
      if (u < 0 || u > 1 || v < 0 || v > 1) return;
      const lab = dataLabel.trim();
      setDataset((prev) =>
        prev.map((d) =>
          d.id === selectedSample
            ? {
                ...d,
                objects: [...(d.objects || []), { label: lab, cx: u, cy: v }],
              }
            : d,
        ),
      );
    },
    [isFomo, fomoMode, selectedSample, dataLabel, crop.x, crop.y, crop.size],
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setCrop(() =>
          clampCropToContainer({
            x: dragStart.cropX + dx,
            y: dragStart.cropY + dy,
            size: crop.size,
          }),
        );
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        const delta = Math.max(dx, dy);
        setCrop((current) =>
          clampCropToContainer({
            x: current.x,
            y: current.y,
            size: resizeStart.size + delta,
          }),
        );
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      if (selectedSample && cropImageRef.current) {
        const c = cropImageRef.current;
        setDataset((prev) =>
          prev.map((d) =>
            d.id === selectedSample
              ? {
                  ...d,
                  savedCrop: {
                    ...crop,
                    renderedWidth: c.clientWidth,
                    renderedHeight: c.clientHeight,
                  },
                }
              : d,
          ),
        );
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeStart,
    clampCropToContainer,
    crop.size,
  ]);

  const processAndSaveSample = async (sample: DatasetItem) => {
    if (!canvasRef.current || !res) return;
    if (isFomo && (!sample.objects || sample.objects.length === 0)) {
      await alert(
        'FOMO needs at least one object center. Switch to "Mark objects", choose the class, then click inside the purple square.',
      );
      return;
    }

    // 1. Capture current crop math synchronously
    const imageEl = cropImageRef.current;
    if (!imageEl) return;
    const renderedWidth = imageEl.clientWidth;
    const renderedHeight = imageEl.clientHeight;
    const uiCropState = { ...crop, renderedWidth, renderedHeight };

    // 2. Compute next sample to select instantly
    const idx = dataset.findIndex((d) => d.id === sample.id);
    let nextId = null;
    for (let i = idx + 1; i < dataset.length; i++) {
      if (
        dataset[i].uploadStatus !== "uploading" &&
        dataset[i].uploadStatus !== "error"
      ) {
        nextId = dataset[i].id;
        break;
      }
    }
    if (!nextId) {
      for (let i = 0; i < idx; i++) {
        if (
          dataset[i].uploadStatus !== "uploading" &&
          dataset[i].uploadStatus !== "error"
        ) {
          nextId = dataset[i].id;
          break;
        }
      }
    }
    setSelectedSample(nextId);

    // 3. Mark as uploading in the dataset so we can show it in the queue
    setDataset((prev) =>
      prev.map((d) =>
        d.id === sample.id ? { ...d, uploadStatus: "uploading" } : d,
      ),
    );

    // 4. Do the heavy lifting async
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = sample.url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = canvasRef.current;
      canvas.width = res.width;
      canvas.height = res.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No context");

      let targetCrop = sample.savedCrop;
      let scaleX = 1;
      let scaleY = 1;

      if (!targetCrop) {
        targetCrop = uiCropState;
      }

      scaleX =
        targetCrop.renderedWidth > 0
          ? img.naturalWidth / targetCrop.renderedWidth
          : 1;
      scaleY =
        targetCrop.renderedHeight > 0
          ? img.naturalHeight / targetCrop.renderedHeight
          : 1;

      const srcX = targetCrop.x * scaleX;
      const srcY = targetCrop.y * scaleY;
      const srcW = targetCrop.size * scaleX;
      const srcH = targetCrop.size * scaleY;

      const boundedX = Math.max(0, Math.min(srcX, img.naturalWidth - 1));
      const boundedY = Math.max(0, Math.min(srcY, img.naturalHeight - 1));
      const boundedW = Math.max(1, Math.min(srcW, img.naturalWidth - boundedX));
      const boundedH = Math.max(
        1,
        Math.min(srcH, img.naturalHeight - boundedY),
      );

      ctx.drawImage(
        img,
        boundedX,
        boundedY,
        boundedW,
        boundedH,
        0,
        0,
        res.width,
        res.height,
      );

      const finalBlob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", 0.9),
      );
      if (finalBlob && projectId) {
        const fileName = `${Date.now()}_${sample.label}.jpg`;
        const fileRef = storageRef(
          storage,
          `projects/${projectId}/ml_data/${fileName}`,
        );
        await uploadBytes(fileRef, finalBlob);
        const downloadURL = await getDownloadURL(fileRef);

        const primaryLabel =
          isFomo && sample.objects?.length
            ? sample.objects[0].label
            : sample.label;
        const sampleRef = await addDoc(
          collection(db, "projects", projectId, "ml_samples"),
          {
            label: primaryLabel,
            arch: architecture,
            resolution: res,
            type: "image",
            imageUrl: downloadURL,
            ...(isFomo && sample.objects?.length
              ? {
                  objects: sample.objects,
                  detection: "fomo_centroids" as const,
                }
              : {}),
            createdAt: serverTimestamp(),
          },
        );
        setSamples((s) => s + 1);
        setCloudSamples((prev) => [
          ...prev,
          {
            id: sampleRef.id,
            label: primaryLabel,
            type: "image",
            imageUrl: downloadURL,
            ...(isFomo && sample.objects ? { objects: sample.objects } : {}),
          },
        ]);

        // Remove from dataset queue on success
        setDataset((prev) => prev.filter((d) => d.id !== sample.id));
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setDataset((prev) =>
        prev.map((d) =>
          d.id === sample.id ? { ...d, uploadStatus: "error" } : d,
        ),
      );
    }
  };

  const processAllSamples = async () => {
    setIsProcessingAll(true);
    const pending = dataset.filter(
      (d) =>
        d.uploadStatus !== "uploading" &&
        d.uploadStatus !== "error" &&
        !d.uploaded,
    );

    // ── Learn from user's manual crops ──
    // When the user manually crops one sample per class, we learn the ratio
    // between their chosen crop size and the smartcrop-detected subject region.
    // This lets us replicate their framing intent on all other images.
    //
    // All math here is done in NATURAL PIXEL coordinates to avoid any
    // CSS-rendered-size vs natural-size mismatch.
    const referenceCrops: Record<
      string,
      {
        /** Ratio of user's crop size to the shorter image dimension (in natural px) */
        sizeRatioToImage: number;
      }
    > = {};

    for (const d of dataset) {
      if (d.savedCrop && !referenceCrops[d.label]) {
        // Convert the user's CSS-space crop to natural pixel space
        const rw = d.savedCrop.renderedWidth || 1;
        const rh = d.savedCrop.renderedHeight || 1;
        // We need the actual natural dimensions. Load them.
        // For the reference, estimate from savedCrop data:
        // The rendered dimensions are CSS pixels of the <img> element.
        // We can't get naturalWidth without loading, but we can compute
        // the ratio in rendered space and it's the same ratio in natural space.
        const cropSizeInRendered = d.savedCrop.size;
        const shorterSideRendered = Math.min(rw, rh);
        const ratio =
          shorterSideRendered > 0
            ? cropSizeInRendered / shorterSideRendered
            : 0.6;
        referenceCrops[d.label] = {
          sizeRatioToImage: Math.max(0.1, Math.min(1.0, ratio)),
        };
      }
    }

    for (const sample of pending) {
      setDataset((prev) =>
        prev.map((d) =>
          d.id === sample.id ? { ...d, uploadStatus: "uploading" } : d,
        ),
      );

      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = sample.url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        if (!res) throw new Error("No resolution configured");
        canvas.width = res.width;
        canvas.height = res.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No context");

        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        // If user already manually cropped this specific sample, use that directly
        if (sample.savedCrop) {
          const sc = sample.savedCrop;
          const scaleX = sc.renderedWidth > 0 ? natW / sc.renderedWidth : 1;
          const scaleY = sc.renderedHeight > 0 ? natH / sc.renderedHeight : 1;
          const srcX = Math.max(0, Math.min(sc.x * scaleX, natW - 1));
          const srcY = Math.max(0, Math.min(sc.y * scaleY, natH - 1));
          const srcW = Math.max(1, Math.min(sc.size * scaleX, natW - srcX));
          const srcH = Math.max(1, Math.min(sc.size * scaleY, natH - srcY));
          ctx.drawImage(
            img,
            srcX,
            srcY,
            srcW,
            srcH,
            0,
            0,
            res.width,
            res.height,
          );
        } else {
          // ── Smart Auto-Crop Pipeline ──
          // 1. Use smartcrop.js to find the most interesting region
          // 2. Use the learned sizeRatio from the user's reference crop (or default 0.65)
          // 3. Center a square crop of that size on the detected subject center
          // 4. Clamp to image bounds

          const ref = referenceCrops[sample.label];
          const targetRatio = ref ? ref.sizeRatioToImage : 0.65;

          let cropX: number, cropY: number, cropSize: number;

          try {
            // smartcrop works best with a square target
            const scResult = await smartcrop.crop(img, {
              width: res.width,
              height: res.height,
            });
            const top = scResult.topCrop;

            // The center of the detected subject (in natural pixel coords)
            const subjectCx = top.x + top.width / 2;
            const subjectCy = top.y + top.height / 2;

            // Our desired crop size based on the user's learned ratio
            cropSize = Math.round(Math.min(natW, natH) * targetRatio);
            // Ensure crop is at least as big as the detected region to not cut the subject
            cropSize = Math.max(cropSize, Math.max(top.width, top.height));
            // But never bigger than the image
            cropSize = Math.min(cropSize, Math.min(natW, natH));

            // Center the crop on the subject
            cropX = Math.round(subjectCx - cropSize / 2);
            cropY = Math.round(subjectCy - cropSize / 2);
          } catch (e) {
            console.warn("Smartcrop detection failed, using center crop:", e);
            cropSize = Math.round(Math.min(natW, natH) * targetRatio);
            cropX = Math.round((natW - cropSize) / 2);
            cropY = Math.round((natH - cropSize) / 2);
          }

          // Clamp to image bounds
          cropX = Math.max(0, Math.min(cropX, natW - cropSize));
          cropY = Math.max(0, Math.min(cropY, natH - cropSize));
          // Final safety: ensure size doesn't exceed remaining space
          cropSize = Math.min(cropSize, natW - cropX, natH - cropY);
          cropSize = Math.max(1, cropSize);

          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropSize,
            cropSize,
            0,
            0,
            res.width,
            res.height,
          );
        }

        const finalBlob = await new Promise<Blob | null>((r) =>
          canvas.toBlob(r, "image/jpeg", 0.9),
        );
        if (finalBlob && projectId) {
          const fileName = `${Date.now()}_${sample.label}.jpg`;
          const fileRef = storageRef(
            storage,
            `projects/${projectId}/ml_data/${fileName}`,
          );
          await uploadBytes(fileRef, finalBlob);
          const downloadURL = await getDownloadURL(fileRef);

          const primaryLabel =
            isFomo && sample.objects?.length
              ? sample.objects[0].label
              : sample.label;
          const sampleRef = await addDoc(
            collection(db, "projects", projectId, "ml_samples"),
            {
              label: primaryLabel,
              arch: architecture,
              resolution: res,
              type: "image",
              imageUrl: downloadURL,
              ...(isFomo && sample.objects?.length
                ? {
                    objects: sample.objects,
                    detection: "fomo_centroids" as const,
                  }
                : {}),
              createdAt: serverTimestamp(),
            },
          );
          setSamples((s) => s + 1);
          setCloudSamples((prev) => [
            ...prev,
            {
              id: sampleRef.id,
              label: primaryLabel,
              type: "image",
              imageUrl: downloadURL,
              ...(isFomo && sample.objects ? { objects: sample.objects } : {}),
            },
          ]);

          setDataset((prev) => prev.filter((d) => d.id !== sample.id));
        }
      } catch (err) {
        console.error("Upload error:", err);
        setDataset((prev) =>
          prev.map((d) =>
            d.id === sample.id ? { ...d, uploadStatus: "error" } : d,
          ),
        );
      }
    }
    setIsProcessingAll(false);
  };

  const applyBulkLabel = () => {
    if (!dataLabel) return;
    setDataset((prev) => prev.map((d) => ({ ...d, label: dataLabel })));
  };

  const removeSample = (id: string) => {
    setDataset((prev) => prev.filter((d) => d.id !== id));
    if (selectedSample === id) setSelectedSample(null);
  };

  const handleStop = async () => {
    setIsRecording(false);
    isCanceledRef.current = true;
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) {}
    }
  };

  const handleRecord = async () => {
    if (!dataLabel) {
      await alert("Enter a label first");
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
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const parts = line.trim().split(",");
          if (parts.length >= (inputType === "IMU" ? 3 : 1)) {
            const features = parts
              .slice(0, inputType === "IMU" ? 3 : parts.length)
              .map(Number)
              .filter((n) => !isNaN(n));
            if (features.length > 0) {
              localSamples++;
              setSamples(localSamples);
              setStreamData((prev) => {
                const next = [...prev, features];
                return next.length > 20 ? next.slice(next.length - 20) : next;
              });

              if (projectId) {
                addDoc(collection(db, "projects", projectId, "ml_samples"), {
                  label: dataLabel,
                  features,
                  arch: architecture || null,
                  type:
                    inputType === "IMU"
                      ? "imu"
                      : inputType === "Audio"
                        ? "audio"
                        : "sensor",
                  createdAt: serverTimestamp(),
                }).catch(console.error);
              }
            }
          }
        }
      }
      setIsRecording(false);
    } catch (e: any) {
      if (e.name !== "NotFoundError" && e.name !== "NetworkError") {
        await alert("Serial error: " + e.message);
      }
      setIsRecording(false);
    } finally {
      if (readerRef.current) {
        try {
          readerRef.current.releaseLock();
        } catch (e) {}
        readerRef.current = null;
      }
    }
  };

  return (
    <div
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        gap: 0,
      }}
    >
      {zipReview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#12031C",
              border: "1px solid rgba(157,39,222,0.4)",
              borderRadius: 12,
              padding: 20,
              width: 800,
              maxWidth: "95%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3 style={{ margin: "0 0 16px", color: "#F2F2F0" }}>
              Import Settings & Labels
            </h3>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                color: "rgba(242,242,240,0.6)",
              }}
            >
              Select which folders to import, set maximum limits, and choose how
              to label the images.
            </p>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {zipReview.map((folder, idx) => (
                <div
                  key={folder.folderPath}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    padding: 12,
                    borderRadius: 8,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={folder.selected}
                    onChange={(e) =>
                      setZipReview((prev) =>
                        prev!.map((f, i) =>
                          i === idx ? { ...f, selected: e.target.checked } : f,
                        ),
                      )
                    }
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                  <div style={{ flex: "1 1 150px" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: folder.selected
                          ? "#D8B4FE"
                          : "rgba(242,242,240,0.3)",
                        marginBottom: 4,
                      }}
                    >
                      Folder: {folder.folderName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: folder.selected
                          ? "rgba(242,242,240,0.5)"
                          : "rgba(242,242,240,0.2)",
                      }}
                    >
                      {folder.entries.length} images (e.g.{" "}
                      {folder.sampleFileName})
                    </div>
                  </div>

                  {folder.selected && (
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                        flex: "2 1 300px",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "rgba(242,242,240,0.6)",
                          }}
                        >
                          Import max:
                        </span>
                        <input
                          type="number"
                          min="1"
                          max={folder.entries.length}
                          value={folder.importLimit}
                          onChange={(e) =>
                            setZipReview((prev) =>
                              prev!.map((f, i) =>
                                i === idx
                                  ? {
                                      ...f,
                                      importLimit:
                                        e.target.value === ""
                                          ? ""
                                          : parseInt(e.target.value) || "",
                                    }
                                  : f,
                              ),
                            )
                          }
                          placeholder="All"
                          style={{
                            background: "#050008",
                            border: "1px solid rgba(157,39,222,0.3)",
                            color: "#F2F2F0",
                            padding: "6px",
                            borderRadius: 6,
                            fontSize: 12,
                            width: 60,
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <select
                          value={folder.labelStrategy}
                          onChange={(e) => {
                            const v = e.target.value as any;
                            setZipReview((prev) =>
                              prev!.map((f, i) =>
                                i === idx ? { ...f, labelStrategy: v } : f,
                              ),
                            );
                          }}
                          style={{
                            background: "#050008",
                            border: "1px solid rgba(157,39,222,0.3)",
                            color: "#F2F2F0",
                            padding: "6px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <option value="folderName">
                            Use folder name ({folder.folderName})
                          </option>
                          <option value="fileName">
                            Use file names (e.g.{" "}
                            {folder.sampleFileName.replace(/\.[^/.]+$/, "")})
                          </option>
                          <option value="custom">Custom label...</option>
                        </select>
                        {folder.labelStrategy === "custom" && (
                          <input
                            value={folder.customLabel}
                            onChange={(e) =>
                              setZipReview((prev) =>
                                prev!.map((f, i) =>
                                  i === idx
                                    ? { ...f, customLabel: e.target.value }
                                    : f,
                                ),
                              )
                            }
                            placeholder="Enter label"
                            style={{
                              background: "#050008",
                              border: "1px solid rgba(157,39,222,0.3)",
                              color: "#F2F2F0",
                              padding: "6px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              width: 100,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}
            >
              <button onClick={() => setZipReview(null)} className="btn-ghost">
                Cancel
              </button>
              <button
                onClick={async () => {
                  const newItems: DatasetItem[] = [];
                  for (const folder of zipReview) {
                    if (!folder.selected) continue;
                    let count = 0;
                    let limit =
                      typeof folder.importLimit === "number"
                        ? folder.importLimit
                        : folder.entries.length;
                    for (const zipEntry of folder.entries) {
                      if (count >= limit) break;
                      count++;
                      let lab = folder.folderName;
                      if (folder.labelStrategy === "fileName") {
                        const parts = zipEntry.name.split("/");
                        const fileName = parts[parts.length - 1];
                        lab = fileName.replace(/\.[^/.]+$/, "");
                      } else if (folder.labelStrategy === "custom") {
                        lab = folder.customLabel.trim() || "unlabeled";
                      }

                      const blob = await zipEntry.async("blob");
                      const url = URL.createObjectURL(blob);
                      newItems.push({
                        id: Math.random().toString(36).substr(2, 9),
                        url,
                        label: lab,
                        ...(isFomo
                          ? {
                              objects: [] as {
                                label: string;
                                cx: number;
                                cy: number;
                              }[],
                            }
                          : {}),
                      });
                    }
                  }
                  setDataset((prev) => [...prev, ...newItems]);
                  setZipReview(null);
                }}
                className="btn-primary"
              >
                Confirm and Load
              </button>
            </div>
          </div>
        </div>
      )}
      {smartCropAssistantOpen &&
        (() => {
          const classes = Array.from(new Set(dataset.map((d) => d.label)));
          const readyCount = classes.filter((cls) =>
            dataset.some((d) => d.label === cls && d.savedCrop),
          ).length;
          const allReady = readyCount === classes.length && classes.length > 0;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.8)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "#12031C",
                  border: "1px solid rgba(157,39,222,0.4)",
                  borderRadius: 12,
                  padding: 20,
                  width: 520,
                  maxWidth: "90%",
                  maxHeight: "80vh",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h3
                  style={{ margin: "0 0 6px", color: "#F2F2F0", fontSize: 16 }}
                >
                  Smart Crop Assistant
                </h3>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 12,
                    color: "rgba(242,242,240,0.5)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#D8B4FE" }}>How it works:</strong>{" "}
                  Crop <strong>one</strong> sample per class to teach the AI
                  your framing style. Then hit "Process All" and it will
                  auto-detect the subject in every remaining image and crop them
                  the same way.
                </p>

                {/* Progress bar */}
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(242,242,240,0.4)",
                        textTransform: "uppercase",
                      }}
                    >
                      Progress
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: allReady ? "#4ade80" : "#f59e0b",
                        fontWeight: 600,
                      }}
                    >
                      {readyCount}/{classes.length} classes ready
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 2,
                        width: `${classes.length > 0 ? (readyCount / classes.length) * 100 : 0}%`,
                        background: allReady ? "#4ade80" : "#f59e0b",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {classes.map((cls) => {
                    const classSamples = dataset.filter((d) => d.label === cls);
                    const croppedSample = classSamples.find((d) => d.savedCrop);
                    const hasCropped = !!croppedSample;
                    return (
                      <div
                        key={cls}
                        style={{
                          background: hasCropped
                            ? "rgba(34,197,94,0.06)"
                            : "rgba(255,255,255,0.04)",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: `1px solid ${hasCropped ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          {croppedSample && (
                            <img
                              src={croppedSample.url}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 4,
                                objectFit: "cover",
                                border: "1px solid rgba(34,197,94,0.3)",
                              }}
                              alt=""
                            />
                          )}
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#D8B4FE",
                              }}
                            >
                              {cls}{" "}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 400,
                                  color: "rgba(242,242,240,0.4)",
                                }}
                              >
                                ({classSamples.length} images)
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: hasCropped ? "#10B981" : "#F59E0B",
                                marginTop: 2,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {hasCropped ? (
                                <>
                                  <CheckCircle size={11} /> Learned
                                </>
                              ) : (
                                <>
                                  <Circle size={11} /> Needs 1 crop
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            // Find an uncropped sample first, or fall back to the first one
                            const target =
                              classSamples.find((d) => !d.savedCrop) ||
                              classSamples[0];
                            setSelectedSample(target.id);
                            setSmartCropAssistantOpen(false);
                          }}
                          className={hasCropped ? "btn-ghost" : "btn-primary"}
                          style={{ fontSize: 11, padding: "5px 12px" }}
                        >
                          {hasCropped ? "Recrop" : "Crop Sample"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <button
                    onClick={() => setSmartCropAssistantOpen(false)}
                    className="btn-ghost"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSmartCropAssistantOpen(false);
                      void processAllSamples();
                    }}
                    disabled={isProcessingAll}
                    className="btn-primary"
                    style={{
                      padding: "8px 20px",
                      fontSize: 12,
                      opacity: isProcessingAll ? 0.6 : 1,
                    }}
                  >
                    {allReady
                      ? "Process All (AI Crop)"
                      : `Process All (${readyCount > 0 ? readyCount + " learned, rest auto" : "auto-detect all"})`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setDataCollectionTab("capture")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            border:
              dataCollectionTab === "capture"
                ? "1px solid rgba(157,39,222,0.45)"
                : "1px solid rgba(255,255,255,0.06)",
            background:
              dataCollectionTab === "capture"
                ? "rgba(157,39,222,0.12)"
                : "rgba(0,0,0,0.25)",
            color:
              dataCollectionTab === "capture"
                ? "#F2F2F0"
                : "rgba(242,242,240,0.45)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Camera size={14} /> Capture
        </button>
        <button
          type="button"
          onClick={() => setDataCollectionTab("cloud")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            border:
              dataCollectionTab === "cloud"
                ? "1px solid rgba(157,39,222,0.45)"
                : "1px solid rgba(255,255,255,0.06)",
            background:
              dataCollectionTab === "cloud"
                ? "rgba(157,39,222,0.12)"
                : "rgba(0,0,0,0.25)",
            color:
              dataCollectionTab === "cloud"
                ? "#F2F2F0"
                : "rgba(242,242,240,0.45)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <LayoutGrid size={14} /> Cloud library
          <span
            style={{
              fontSize: 10,
              opacity: 0.7,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            ({samples})
          </span>
        </button>
      </div>

      {dataCollectionTab === "capture" ? (
        <>
          {/* Toolbar */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 14,
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, position: "relative" }}>
              <Tag
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  top: 12,
                  color: "rgba(242,242,240,0.3)",
                }}
              />
              <input
                placeholder="Dataset Label (e.g. apple, background)"
                value={dataLabel}
                onChange={(e) => setDataLabel(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0D0018",
                  border: "1px solid rgba(157,39,222,0.3)",
                  color: "#F2F2F0",
                  padding: "10px 12px 10px 32px",
                  fontSize: 13,
                  borderRadius: 8,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {inputType === "Image" && dataset.length > 0 && (
              <button
                onClick={applyBulkLabel}
                className="btn-ghost"
                style={{
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Check size={14} /> Bulk Label
              </button>
            )}
            {inputType === "Image" && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingAll}
                  style={{
                    background: "rgba(157,39,222,0.1)",
                    color: "#9D27DE",
                    border: "1px solid rgba(157,39,222,0.3)",
                    borderRadius: 8,
                    padding: "0 16px",
                    cursor: isProcessingAll ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    opacity: isProcessingAll ? 0.6 : 1,
                  }}
                >
                  <Upload size={16} /> Upload Dataset (Zip or Images)
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,.zip"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <button
                  onClick={handleSnapshot}
                  className="btn-primary"
                  style={{
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Camera size={16} /> Snapshot
                </button>
              </>
            )}
            {inputType !== "Image" && (
              <button
                onClick={isRecording ? handleStop : handleRecord}
                disabled={(!isRecording && !dataLabel) || !architecture}
                style={{
                  background: isRecording
                    ? "#EF4444"
                    : !dataLabel || !architecture
                      ? "rgba(157,39,222,0.3)"
                      : "#9D27DE",
                  color: "#fff",
                  padding: "0 20px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  cursor:
                    (!isRecording && !dataLabel) || !architecture
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "0.2s",
                }}
              >
                {isRecording ? "Stop Recording" : `Record ${inputType}`}
              </button>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", gap: 20, minHeight: 0 }}>
            {/* Main Visualizer / Workspace */}
            <div
              style={{
                flex: 2,
                minWidth: 0,
                minHeight: 0,
                background: "#0D0018",
                borderRadius: 12,
                border: "1px solid rgba(157,39,222,0.15)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(242,242,240,0.5)",
                    fontFamily: "JetBrains Mono",
                    textTransform: "uppercase",
                  }}
                >
                  {selectedSample ? "IMAGE CROPPER" : "LIVE PREVIEW"}
                </span>
                {selectedSample && (
                  <span style={{ fontSize: 10, color: "#9D27DE" }}>
                    Target: {res.width}x{res.height}px
                  </span>
                )}
                {selectedSample && isFomo && (
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <span
                      style={{ fontSize: 9, color: "rgba(242,242,240,0.45)" }}
                    >
                      FOMO
                    </span>
                    <button
                      type="button"
                      onClick={() => setFomoMode("crop")}
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background:
                          fomoMode === "crop"
                            ? "rgba(157,39,222,0.35)"
                            : "rgba(0,0,0,0.35)",
                        color: "#F2F2F0",
                      }}
                    >
                      Crop
                    </button>
                    <button
                      type="button"
                      onClick={() => setFomoMode("mark")}
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background:
                          fomoMode === "mark"
                            ? "rgba(34,197,94,0.35)"
                            : "rgba(0,0,0,0.35)",
                        color: "#F2F2F0",
                      }}
                    >
                      Mark objects
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "stretch",
                  background: "#050008",
                }}
              >
                {inputType === "Image" ? (
                  selectedSample ? (
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 8,
                        boxSizing: "border-box",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        ref={cropContainerRef}
                        style={{
                          position: "relative",
                          display: "inline-block",
                          userSelect: "none",
                        }}
                      >
                        <img
                          ref={cropImageRef}
                          src={
                            dataset.find((d) => d.id === selectedSample)?.url
                          }
                          onLoad={() => {
                            // Re-initialize crop when image loads
                            const el = cropImageRef.current;
                            if (
                              el &&
                              el.clientWidth > 0 &&
                              el.clientHeight > 0
                            ) {
                              const sz = Math.round(
                                Math.min(el.clientWidth, el.clientHeight) * 0.6,
                              );
                              setCrop(
                                clampCropToContainer({
                                  x: Math.round((el.clientWidth - sz) / 2),
                                  y: Math.round((el.clientHeight - sz) / 2),
                                  size: sz,
                                }),
                              );
                            }
                          }}
                          style={{
                            display: "block",
                            maxWidth: "100%",
                            maxHeight: "calc(100vh - 320px)",
                            width: "auto",
                            height: "auto",
                            borderRadius: 4,
                            pointerEvents: "none",
                          }}
                          alt="Crop target"
                          draggable={false}
                        />
                        {/* Draggable Crop Box */}
                        <div
                          onMouseDown={handleCropMouseDown}
                          style={{
                            position: "absolute",
                            left: crop.x,
                            top: crop.y,
                            width: crop.size,
                            height: crop.size,
                            border: "2px solid #9D27DE",
                            boxShadow: "0 0 0 4000px rgba(0,0,0,0.6)",
                            cursor:
                              isFomo && fomoMode === "mark"
                                ? "default"
                                : isDragging
                                  ? "grabbing"
                                  : "grab",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition:
                              isDragging || isResizing
                                ? "none"
                                : "left 0.1s, top 0.1s, width 0.1s, height 0.1s",
                            pointerEvents:
                              isFomo && fomoMode === "mark" ? "none" : "auto",
                          }}
                        >
                          <Scissors
                            size={16}
                            color="#9D27DE"
                            style={{ opacity: 0.5 }}
                          />
                          {/* Resize corner handle */}
                          <div
                            onMouseDown={handleResizeMouseDown}
                            style={{
                              position: "absolute",
                              bottom: -5,
                              right: -5,
                              width: 12,
                              height: 12,
                              borderRadius: 2,
                              background: "#9D27DE",
                              cursor: "nwse-resize",
                              border: "1px solid #12031C",
                              pointerEvents:
                                isFomo && fomoMode === "mark" ? "none" : "auto",
                            }}
                          />
                        </div>
                        {isFomo && fomoMode === "mark" && (
                          <div
                            onClick={handleFomoMarkClick}
                            title="Click inside purple square to add object center for current class"
                            style={{
                              position: "absolute",
                              left: crop.x,
                              top: crop.y,
                              width: crop.size,
                              height: crop.size,
                              zIndex: 6,
                              cursor: "crosshair",
                              background: "rgba(74,222,128,0.06)",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        minHeight: "min(52vh, 560px)",
                        width: "100%",
                        padding: 8,
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          minHeight: 240,
                          maxHeight: "min(72vh, 900px)",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#000",
                          border: "1px solid rgba(157,39,222,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{
                            width: "100%",
                            height: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {streamData.length === 0 && !isRecording && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "rgba(242,242,240,0.2)",
                          fontSize: 12,
                        }}
                      >
                        Connect board and press Record...
                      </div>
                    )}
                    {streamData.map((d, i) => {
                      const hx = Math.min(
                        100,
                        Math.max(0, (d[0] + 16384) / 327.68),
                      );
                      const hy =
                        d.length > 1
                          ? Math.min(100, Math.max(0, (d[1] + 16384) / 327.68))
                          : 0;
                      const hz =
                        d.length > 2
                          ? Math.min(100, Math.max(0, (d[2] + 16384) / 327.68))
                          : 0;
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            display: "flex",
                            gap: 1,
                            alignItems: "flex-end",
                            height: "100%",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              background: "#ef4444",
                              height: `${hx}%`,
                              opacity: 0.8,
                            }}
                          />
                          {d.length > 1 && (
                            <div
                              style={{
                                flex: 1,
                                background: "#22c55e",
                                height: `${hy}%`,
                                opacity: 0.8,
                              }}
                            />
                          )}
                          {d.length > 2 && (
                            <div
                              style={{
                                flex: 1,
                                background: "#3b82f6",
                                height: `${hz}%`,
                                opacity: 0.8,
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {selectedSample && (
                <div
                  style={{
                    padding: 8,
                    background: "rgba(157,39,222,0.05)",
                    borderTop: "1px solid rgba(157,39,222,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    position: "sticky",
                    bottom: 0,
                    zIndex: 3,
                  }}
                >
                  {isFomo && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 10,
                          color: "rgba(242,242,240,0.62)",
                          lineHeight: 1.45,
                        }}
                      >
                        <strong style={{ color: "#86efac" }}>
                          FOMO quick flow:
                        </strong>{" "}
                        1) use <strong>Crop</strong> to frame area, 2) choose
                        class, 3) switch to <strong>Mark objects</strong>, click
                        centers, 4) save.
                      </p>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                      >
                        <button
                          type="button"
                          onClick={() => setFomoMode("crop")}
                          style={{
                            fontSize: 10,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border:
                              fomoMode === "crop"
                                ? "1px solid rgba(157,39,222,0.55)"
                                : "1px solid rgba(255,255,255,0.14)",
                            background:
                              fomoMode === "crop"
                                ? "rgba(157,39,222,0.2)"
                                : "rgba(0,0,0,0.25)",
                            color: "#F2F2F0",
                            cursor: "pointer",
                          }}
                        >
                          1. Position crop
                        </button>
                        <button
                          type="button"
                          onClick={() => setFomoMode("mark")}
                          style={{
                            fontSize: 10,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border:
                              fomoMode === "mark"
                                ? "1px solid rgba(34,197,94,0.55)"
                                : "1px solid rgba(255,255,255,0.14)",
                            background:
                              fomoMode === "mark"
                                ? "rgba(34,197,94,0.2)"
                                : "rgba(0,0,0,0.25)",
                            color: "#F2F2F0",
                            cursor: "pointer",
                          }}
                        >
                          2. Mark centers
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDataset((prev) =>
                              prev.map((d) =>
                                d.id === selectedSample
                                  ? {
                                      ...d,
                                      objects: (d.objects || []).slice(0, -1),
                                    }
                                  : d,
                              ),
                            )
                          }
                          disabled={!selectedQueueItem?.objects?.length}
                          style={{
                            fontSize: 10,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(251,191,36,0.45)",
                            background: "rgba(251,191,36,0.12)",
                            color: selectedQueueItem?.objects?.length
                              ? "#fde68a"
                              : "rgba(253,230,138,0.45)",
                            cursor: selectedQueueItem?.objects?.length
                              ? "pointer"
                              : "not-allowed",
                          }}
                        >
                          Undo last
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDataset((prev) =>
                              prev.map((d) =>
                                d.id === selectedSample
                                  ? { ...d, objects: [] }
                                  : d,
                              ),
                            )
                          }
                          disabled={!selectedQueueItem?.objects?.length}
                          style={{
                            fontSize: 10,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(239,68,68,0.45)",
                            background: "rgba(239,68,68,0.12)",
                            color: selectedQueueItem?.objects?.length
                              ? "#fecaca"
                              : "rgba(254,202,202,0.45)",
                            cursor: selectedQueueItem?.objects?.length
                              ? "pointer"
                              : "not-allowed",
                          }}
                        >
                          Clear points
                        </button>
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(134,239,172,0.95)",
                            marginLeft: "auto",
                          }}
                        >
                          {selectedQueueItem?.objects?.length || 0} center(s)
                          marked
                        </span>
                      </div>
                    </div>
                  )}
                  {isFomo && (selectedQueueItem?.objects?.length ?? 0) > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(selectedQueueItem?.objects || []).map((o, idx) => (
                        <span
                          key={`${o.label}-${idx}-${o.cx}-${o.cy}`}
                          style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "rgba(157,39,222,0.2)",
                            border: "1px solid rgba(157,39,222,0.35)",
                            color: "#E9D5FF",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {o.label} @ ({(o.cx * 100).toFixed(0)}%,{" "}
                          {(o.cy * 100).toFixed(0)}%)
                          <button
                            type="button"
                            onClick={() =>
                              setDataset((prev) =>
                                prev.map((d) =>
                                  d.id === selectedSample
                                    ? {
                                        ...d,
                                        objects: (d.objects || []).filter(
                                          (_, j) => j !== idx,
                                        ),
                                      }
                                    : d,
                                ),
                              )
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "rgba(239,68,68,0.85)",
                              cursor: "pointer",
                              padding: 0,
                              fontSize: 12,
                              lineHeight: 1,
                            }}
                            title="Remove this point"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flex: "1 1 220px",
                        minWidth: 180,
                      }}
                    >
                      <input
                        value={selectedQueueItem?.label || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDataset((prev) =>
                            prev.map((d) =>
                              d.id === selectedSample
                                ? { ...d, label: val }
                                : d,
                            ),
                          );
                        }}
                        style={{
                          width: "100%",
                          background: "#0D0018",
                          border: "1px solid rgba(157,39,222,0.2)",
                          color: "#F2F2F0",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                        placeholder={
                          isFomo
                            ? "Current class for next click"
                            : "Label for this sample"
                        }
                      />
                      {isFomo && fomoLabelSuggestions.length > 0 && (
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                        >
                          {fomoLabelSuggestions.map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                setDataLabel(label);
                                setDataset((prev) =>
                                  prev.map((d) =>
                                    d.id === selectedSample
                                      ? { ...d, label }
                                      : d,
                                  ),
                                );
                              }}
                              style={{
                                fontSize: 10,
                                padding: "3px 8px",
                                borderRadius: 6,
                                border: "1px solid rgba(157,39,222,0.35)",
                                background: "rgba(157,39,222,0.12)",
                                color: "#E9D5FF",
                                cursor: "pointer",
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginLeft: "auto",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        onClick={() => setSelectedSample(null)}
                        className="btn-ghost"
                        style={{ fontSize: 11 }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() =>
                          processAndSaveSample(
                            dataset.find((d) => d.id === selectedSample)!,
                          )
                        }
                        disabled={
                          dataset.find((d) => d.id === selectedSample)
                            ?.uploadStatus === "uploading" ||
                          dataset.find((d) => d.id === selectedSample)?.uploaded
                        }
                        className="btn-primary"
                        style={{
                          padding: "6px 16px",
                          fontSize: 11,
                          opacity:
                            dataset.find((d) => d.id === selectedSample)
                              ?.uploadStatus === "uploading" ||
                            dataset.find((d) => d.id === selectedSample)
                              ?.uploaded
                              ? 0.6
                              : 1,
                        }}
                      >
                        {dataset.find((d) => d.id === selectedSample)
                          ?.uploadStatus === "uploading"
                          ? "Uploading..."
                          : dataset.find((d) => d.id === selectedSample)
                                ?.uploaded
                            ? "Uploaded"
                            : isFomo
                              ? "Save FOMO sample"
                              : "Crop & Save"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Dataset Sidebar */}
            {inputType === "Image" && (
              <div
                style={{
                  width: 240,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "rgba(242,242,240,0.5)",
                        textTransform: "uppercase",
                      }}
                    >
                      Dataset Queue
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        background: "rgba(157,39,222,0.2)",
                        color: "#9D27DE",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {dataset.length} pending
                    </span>
                  </div>
                  {dataset.length > 0 && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setSmartCropAssistantOpen(true)}
                        className="btn-ghost"
                        style={{ flex: 1, fontSize: 10, padding: "6px 8px" }}
                      >
                        Smart Crop
                      </button>
                      <button
                        onClick={() => void processAllSamples()}
                        disabled={isProcessingAll}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          fontSize: 10,
                          padding: "6px 8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                          opacity: isProcessingAll ? 0.6 : 1,
                        }}
                      >
                        {isProcessingAll ? (
                          <RefreshCw
                            size={10}
                            style={{ animation: "spin 1s linear infinite" }}
                          />
                        ) : (
                          <Save size={10} />
                        )}
                        Process All
                      </button>
                    </div>
                  )}
                </div>
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 8,
                    paddingRight: 4,
                  }}
                >
                  {dataset.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.uploadStatus !== "uploading")
                          setSelectedSample(item.id);
                      }}
                      style={{
                        background:
                          selectedSample === item.id
                            ? "rgba(157,39,222,0.1)"
                            : "#0D0018",
                        border: `1px solid ${item.uploadStatus === "error" ? "#EF4444" : selectedSample === item.id ? "#9D27DE" : "rgba(157,39,222,0.1)"}`,
                        borderRadius: 8,
                        padding: 8,
                        cursor:
                          item.uploadStatus === "uploading"
                            ? "wait"
                            : "pointer",
                        transition: "0.2s",
                        position: "relative",
                        opacity: item.uploadStatus === "uploading" ? 0.6 : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <img
                          src={item.url}
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: "cover",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            setPreviewImageModal({
                              url: item.url,
                              label: item.label || "Unknown",
                            })
                          }
                          alt="Preview"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color:
                                item.uploadStatus === "error"
                                  ? "#EF4444"
                                  : "#F2F2F0",
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.label}
                          </p>
                          <p
                            style={{
                              fontSize: 9,
                              color: "rgba(242,242,240,0.4)",
                              margin: "2px 0 0",
                            }}
                          >
                            {item.uploadStatus === "error" ? (
                              <span
                                style={{ color: "#EF4444", fontWeight: "bold" }}
                              >
                                Error! Click to retry
                              </span>
                            ) : item.uploadStatus === "uploading" ? (
                              <span style={{ color: "#EAB308" }}>
                                <RefreshCw
                                  size={10}
                                  style={{
                                    display: "inline",
                                    marginBottom: -2,
                                  }}
                                  className="animate-spin"
                                />{" "}
                                Uploading...
                              </span>
                            ) : item.uploaded ? (
                              <span style={{ color: "#22c55e" }}>
                                <Check
                                  size={10}
                                  style={{
                                    display: "inline",
                                    marginBottom: -2,
                                  }}
                                />{" "}
                                Uploaded
                              </span>
                            ) : isFomo ? (
                              `${item.objects?.length || 0} centers · crop`
                            ) : (
                              "Ready to crop"
                            )}
                          </p>
                        </div>
                        {item.uploadStatus === "error" && (
                          <div
                            style={{
                              background: "rgba(239,68,68,0.2)",
                              color: "#EF4444",
                              borderRadius: "50%",
                              width: 24,
                              height: 24,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Upload failed"
                          >
                            !
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSample(item.id);
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          background: "none",
                          border: "none",
                          color: "rgba(239,68,68,0.4)",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {dataset.length === 0 && (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.3,
                        padding: "40px 0",
                      }}
                    >
                      <Upload size={32} />
                      <p
                        style={{
                          fontSize: 10,
                          marginTop: 8,
                          textAlign: "center",
                        }}
                      >
                        No images yet
                        <br />
                        Upload or take snapshot
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            background: "#0D0018",
            borderRadius: 14,
            border: "1px solid rgba(157,39,222,0.12)",
            boxSizing: "border-box",
          }}
        >
          {/* -- SIDEBAR -- */}
          <div
            style={{
              width: 340,
              display: "flex",
              flexDirection: "column",
              background: "rgba(0,0,0,0.2)",
              borderRight: "1px solid rgba(157,39,222,0.1)",
            }}
          >
            {/* Sidebar Header */}
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#F2F2F0", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ background: "rgba(157,39,222,0.15)", padding: 6, borderRadius: 8 }}>
                       <Database size={14} color="#c084fc" />
                    </div>
                    Cloud Library
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(242,242,240,0.5)", marginTop: 6, marginLeft: 2 }}>
                    {samples} samples · {distinctCloudLabels.length} class{distinctCloudLabels.length !== 1 ? "es" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadCloudSamples()}
                  disabled={loadingCloud}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#E9D5FF",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 10,
                    cursor: loadingCloud ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <RefreshCw
                    size={12}
                    style={{ animation: loadingCloud ? "spin 1s linear infinite" : "none" }}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {/* Deletion progress bar */}
            {deleteProgress && (
              <div style={{ padding: "8px 16px", background: "rgba(239,68,68,0.06)", borderBottom: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#fca5a5", fontWeight: 600 }}>
                    Deleting samples...
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(252,165,165,0.7)" }}>
                    {deleteProgress.done} / {deleteProgress.total} ({Math.round((deleteProgress.done / deleteProgress.total) * 100)}%)
                  </span>
                </div>
                <div style={{ height: 4, width: "100%", borderRadius: 999, background: "rgba(239,68,68,0.15)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round((deleteProgress.done / deleteProgress.total) * 100)}%`,
                    background: "linear-gradient(90deg, #ef4444, #f87171)",
                    transition: "width 0.3s ease",
                    borderRadius: 999,
                  }} />
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Classes */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(242,242,240,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                  Class Distribution
                </div>
                {(() => {
                  const groups: Record<string, number> = {};
                  cloudSamples.forEach((s) => {
                    const l = (s.label || "").trim();
                    if (l) groups[l] = (groups[l] || 0) + 1;
                  });
                  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
                  if (entries.length === 0) return <div style={{fontSize: 11, color: "rgba(242,242,240,0.3)"}}>No classes yet.</div>;
                  const colors = ["#c084fc", "#60a5fa", "#34d399", "#fbbf24", "#fb923c", "#f87171", "#a78bfa", "#2dd4bf"];
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {entries.map(([label, count], i) => (
                        <div
                          key={label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            border: `1px solid ${colors[i % colors.length]}15`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: colors[i % colors.length] }} />
                            <span style={{ fontSize: 12, color: "#F2F2F0", fontWeight: 500 }}>{label}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                             <span style={{ fontSize: 11, color: "rgba(242,242,240,0.5)" }}>{count}</span>
                             <button
                               type="button"
                               onClick={() => void clearLabelSamples(label)}
                               title={`Delete all "${label}"`}
                               style={{ background: "none", border: "none", color: "rgba(239,68,68,0.4)", cursor: "pointer", padding: 0 }}
                             >
                               <Trash2 size={12} />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Snapshots */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(242,242,240,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Saved Datasets
                  </div>
                  <span style={{ fontSize: 10, background: "rgba(157,39,222,0.15)", color: "#c084fc", padding: "2px 6px", borderRadius: 4 }}>
                    {savedDatasets.length} total
                  </span>
                </div>
                
                {savedDatasets.length === 0 && (
                  <p style={{ fontSize: 11, color: "rgba(242,242,240,0.3)", margin: 0 }}>
                    No datasets yet. Create one from the toolbar.
                  </p>
                )}
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {savedDatasetsGrouped.map(([groupLabel, list]) => (
                    <div key={groupLabel}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#D8B4FE", marginBottom: 8, opacity: 0.9 }}>
                        {groupLabel === "Other datasets" ? "Other / mixed" : groupLabel} <span style={{ opacity: 0.5, fontWeight: 400 }}>({list.length})</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {list.map((ds) => {
                          const ids = ds.sampleIds || [];
                          let resolved = 0;
                          for (const id of ids) {
                            if (cloudSampleById.has(id)) resolved++;
                          }
                          const missing = ids.length - resolved;
                          return (
                            <div key={ds.id} style={{ borderRadius: 8, border: ds.selected ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.06)", background: ds.selected ? "rgba(74,222,128,0.05)" : "rgba(0,0,0,0.2)", padding: "10px", display: "flex", gap: 10 }}>
                              <button type="button" onClick={() => toggleDatasetSelection(ds.id, ds.selected)} style={{ background: "none", border: "none", color: ds.selected ? "#4ade80" : "rgba(242,242,240,0.2)", cursor: "pointer", padding: 0, marginTop: 2 }} title={ds.selected ? "Used for training" : "Not used"}>
                                {ds.selected ? <CheckCircle size={14} /> : <Circle size={14} />}
                              </button>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#F2F2F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ds.name}</div>
                                <div style={{ fontSize: 10, color: "rgba(242,242,240,0.4)", marginTop: 4 }}>
                                  {ids.length} imgs {missing > 0 ? <span style={{color: "#fbbf24"}}>({missing} missing)</span> : null}
                                </div>
                                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                  <button type="button" onClick={() => {
                                      if (expandedPreview?.datasetId === ds.id) { expandPreviewSeq.current += 1; setExpandedPreview(null); setExpandedPreviewLoading(false); return; }
                                      const seq = ++expandPreviewSeq.current;
                                      setExpandedPreviewLoading(true); setExpandedPreview({ datasetId: ds.id, samples: [] });
                                      void (async () => { const slice = ids.slice(0, 16); const fetched = await fetchSamplesByIds(slice); if (seq !== expandPreviewSeq.current) return; const m = new Map(fetched.map((s) => [s.id, s])); setExpandedPreview({ datasetId: ds.id, samples: slice.map((id) => m.get(id) ?? null) }); setExpandedPreviewLoading(false); })();
                                    }} style={{ fontSize: 9, padding: "3px 8px", background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 4, color: "#e9d5ff", cursor: "pointer" }}>
                                    {expandedPreview?.datasetId === ds.id ? "Hide" : "Preview"}
                                  </button>
                                  <button type="button" onClick={() => void deleteSavedDataset(ds.id, ds.name)} style={{ fontSize: 9, padding: "3px 8px", background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 4, color: "#fca5a5", cursor: "pointer" }}>Delete</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* -- MAIN CONTENT -- */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Toolbar */}
            <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  value={cloudFilter}
                  onChange={(e) => setCloudFilter(e.target.value)}
                  placeholder="Search samples by label or ID..."
                  style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", color: "#F2F2F0", padding: "10px 14px", borderRadius: 8, fontSize: 13, outline: "none", transition: "0.2s border-color", boxSizing: "border-box" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(157,39,222,0.4)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                />
                
                {/* Dataset Action */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                  <Save size={14} color="#a855f7" />
                  <input 
                    placeholder="Dataset name..." 
                    value={datasetName} 
                    onChange={(e) => setDatasetName(e.target.value)}
                    style={{ width: 140, background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.2)", color: "#F2F2F0", padding: "4px 0", fontSize: 12, outline: "none" }}
                  />
                  <select 
                    value={snapshotLabelPick} 
                    onChange={(e) => setSnapshotLabelPick(e.target.value)}
                    disabled={distinctCloudLabels.length === 0}
                    style={{ width: 100, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", color: "#F2F2F0", padding: "6px", borderRadius: 6, fontSize: 11 }}
                  >
                    {distinctCloudLabels.length === 0 ? <option value="">No classes</option> : distinctCloudLabels.map((l) => (<option key={l} value={l}>{l}</option>))}
                  </select>
                  <button 
                    type="button" 
                    onClick={() => void saveLabelSnapshot()} 
                    disabled={!normLabel(snapshotLabelPick)} 
                    className="btn-primary"
                    style={{ fontSize: 11, padding: "6px 12px" }}
                  >
                    Save Class
                  </button>
                  <button 
                    type="button" 
                    onClick={() => void saveAsDataset()} 
                    disabled={!datasetName.trim()}
                    style={{ fontSize: 11, padding: "6px 12px", background: "rgba(255,255,255,0.05)", color: datasetName.trim() ? "#e9d5ff" : "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: datasetName.trim() ? "pointer" : "not-allowed" }}
                  >
                    Save All
                  </button>
                </div>
              </div>
              
              {/* Contextual Toolbar */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 28 }}>
                <button type="button" onClick={selectedCloudIds.size > 0 ? clearCloudSelection : selectAllFiltered} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(242,242,240,0.8)", cursor: "pointer" }}>
                  {selectedCloudIds.size > 0 ? "Deselect all" : "Select all visible"}
                </button>
                
                {selectedCloudIds.size > 0 && (
                  <>
                    <span style={{ fontSize: 11, color: "#c084fc", fontWeight: 600, marginLeft: 8 }}>{selectedCloudIds.size} selected</span>
                    <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
                    <button type="button" onClick={() => openRelabel(Array.from(selectedCloudIds))} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(157,39,222,0.3)", background: "rgba(157,39,222,0.1)", color: "#E9D5FF", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Pencil size={12} /> Relabel
                    </button>
                    <button type="button" onClick={() => void bulkDeleteSelected()} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#fca5a5", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <Trash2 size={12} /> Delete
                    </button>
                    <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 8px" }} />
                    
                    {/* Add to dataset */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Append to:</span>
                      <select value={appendDsId} onChange={(e) => setAppendDsId(e.target.value)} style={{ width: 140, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#F2F2F0", padding: "6px 8px", borderRadius: 6, fontSize: 11 }}>
                        <option value="">Choose dataset...</option>
                        {savedDatasetsGrouped.map(([gLabel, list]) => (
                          <optgroup key={gLabel} label={gLabel === "Other datasets" ? "Other / mixed" : gLabel}>
                            {list.map((ds) => (<option key={ds.id} value={ds.id}>{ds.name}</option>))}
                          </optgroup>
                        ))}
                      </select>
                      {appendDsId && <button type="button" onClick={() => void addSelectionToSavedDataset()} className="btn-primary" style={{ fontSize: 11, padding: "6px 12px" }}>Append</button>}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {samplesGroupedByLabel.map(([groupLabel, list]) => (
                <div key={groupLabel} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#E9D5FF" }}>
                      {groupLabel}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(242,242,240,0.4)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 12 }}>
                      {list.length} items
                    </div>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                    {list.slice(0, expandedCloudGroups.has(groupLabel) ? list.length : 14).map((s) => (
                      <div key={s.id} onClick={() => toggleCloudSelect(s.id)}
                        style={{ background: selectedCloudIds.has(s.id) ? "rgba(157,39,222,0.15)" : "rgba(0,0,0,0.2)", border: selectedCloudIds.has(s.id) ? "1px solid rgba(157,39,222,0.5)" : "1px solid rgba(255,255,255,0.05)", borderRadius: 8, overflow: "hidden", cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ position: "relative", aspectRatio: "1", background: "#050008", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setPreviewImageModal({ url: s.imageUrl!, label: s.label || 'Unknown' }); }} />
                          ) : (
                            <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", padding: 8, textAlign: "center" }}>{s.type || "data"}</span>
                          )}
                          <div style={{ position: "absolute", top: 6, left: 6, width: 16, height: 16, borderRadius: 4, background: selectedCloudIds.has(s.id) ? "#a855f7" : "rgba(0,0,0,0.5)", border: selectedCloudIds.has(s.id) ? "none" : "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.15s" }}>
                            {selectedCloudIds.has(s.id) && <Check size={10} color="#fff" />}
                          </div>
                          <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 4, opacity: selectedCloudIds.has(s.id) ? 1 : 0.8 }}>
                            <button type="button" onClick={(e) => { e.stopPropagation(); openRelabel([s.id]); }} title="Relabel"
                              style={{ background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, padding: 4, color: "#e9d5ff", cursor: "pointer", transition: "0.15s" }}><Pencil size={10} /></button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); void deleteCloudSampleOne(s.id); }} title="Delete"
                              style={{ background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 4, padding: 4, color: "#fca5a5", cursor: "pointer", transition: "0.15s" }}><Trash2 size={10} /></button>
                          </div>
                        </div>
                        <div style={{ padding: "8px" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#F2F2F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</div>
                          <div style={{ fontSize: 9, color: "rgba(242,242,240,0.4)", marginTop: 4 }}>{formatSampleDate(s)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!expandedCloudGroups.has(groupLabel) && list.length > 14 && (
                     <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                        <button 
                          onClick={() => setExpandedCloudGroups(prev => new Set(prev).add(groupLabel))} 
                          style={{ padding: "8px 24px", fontSize: 11, border: "1px solid rgba(157,39,222,0.3)", background: "rgba(157,39,222,0.05)", color: "#e9d5ff", borderRadius: 20, cursor: "pointer", transition: "0.15s" }}
                        >
                          Show {list.length - 14} more {groupLabel} samples
                        </button>
                     </div>
                  )}
                </div>
              ))}
              
              {filteredCloudSamples.length === 0 && (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "rgba(242,242,240,0.4)", fontSize: 13 }}>
                  {cloudSamples.length === 0 ? (
                    <>
                      <Database size={32} style={{ opacity: 0.3, marginBottom: 16 }} />
                      <div>Your cloud library is empty.</div>
                      <div style={{ fontSize: 11, marginTop: 8 }}>Switch to the Capture tab to upload or record new data.</div>
                    </>
                  ) : "No samples match your search criteria."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {relabelModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setRelabelModal(null)}
        >
          <div
            style={{
              background: "#12031C",
              border: "1px solid rgba(157,39,222,0.35)",
              borderRadius: 12,
              padding: 20,
              maxWidth: 400,
              width: "100%",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "#F2F2F0",
              }}
            >
              Relabel {relabelModal.ids.length} sample
              {relabelModal.ids.length > 1 ? "s" : ""}
            </p>
            <input
              autoFocus
              value={relabelValue}
              onChange={(e) => setRelabelValue(e.target.value)}
              placeholder="New label"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(157,39,222,0.3)",
                background: "#0D0018",
                color: "#F2F2F0",
                fontSize: 13,
                marginBottom: 16,
              }}
            />
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setRelabelModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void applyRelabel()}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImageModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 1500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "85vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImageModal.url}
              alt={previewImageModal.label}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                border: "1px solid rgba(157,39,222,0.5)",
                borderRadius: 8,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -40,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#F2F2F0",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              Class: {previewImageModal.label}
            </div>
          </div>
          <p
            style={{
              marginTop: 60,
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              maxWidth: 400,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            <strong>Note:</strong> Because BitBlock applies Smart Crop directly
            in your browser before uploading, the original uncropped images are
            not saved to the cloud. This saves you huge amounts of Firebase
            storage costs and upload time.
          </p>
          <button
            onClick={() => setPreviewImageModal(null)}
            className="btn-ghost"
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Close
          </button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
