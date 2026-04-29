import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection, increment, getDocs, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useAppDialog } from "../contexts/DialogContext";
import { useUsage } from "../hooks/useUsage";
import CassetteMascot from "../components/ui/CassetteMascot";
import PlanLimitBanner from "../components/PlanLimitBanner";
import { BOARDS, getBoardConfig } from "../boards/registry";
import { TASK_ARCHITECTURES, ML_ARCHITECTURES } from "../boards/MLCapabilities";
import { compiler } from "../compiler/assembler";
import { defineCoreBlocks, getCoreToolboxBlocks } from "../blocks/core";
import { defineAllLibraryBlocks, getAllLibraryCategories } from "../libraries";
import { MARKETPLACE_EXAMPLES } from "../blocks/marketplaceExamples";
import QuickHelpPanel from "../components/QuickHelpPanel";
import DataCollection from "../ml/DataCollection";
import TrainingView from "../ml/TrainingView";
import TestingView from "../ml/Testing";
import ModelRegistry from "../ml/ModelRegistry";
import { generateMLBlock } from "../ml/Deployment";
import { flashESPBlock } from "../flash/esptoolProtocol";
import { flashSTK500 } from "../flash/stk500Protocol";
import { flashUF2 } from "../flash/uf2Flashing";


// Dynamically import Blockly to avoid SSR issues
let Blockly: any = null;

const PANEL_TABS = ["code", "serial", "info"] as const;
type PanelTab = typeof PANEL_TABS[number];
const ML_PIPELINE_TABS = ["collect", "train", "versions", "test"] as const;
type MLPipelineTab = typeof ML_PIPELINE_TABS[number];
const MARKETPLACE_CATEGORIES = ["GPIO", "Sensors", "Display", "Communication", "ML / AI", "Actuators", "Networking"];

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function IDEPage() {
  const { projectId } = useParams();
  const { user, userPlan } = useAuth();
  const { alert } = useAppDialog();
  const { canCompile, compileBlockReason, canStartTraining, trainingBlockReason, incrementCompileCount, incrementTrainingCount } = useUsage(user?.uid, userPlan);
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("// Connect blocks in the editor to generate code");
  const [panelTab, setPanelTab] = useState<PanelTab>("code");
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "success" | "error">("idle");
  const [compileMessage, setCompileMessage] = useState("");
  const [compileProgress, setCompileProgress] = useState(0);
  const [compileStartedAt, setCompileStartedAt] = useState<number | null>(null);
  const [firmwareReady, setFirmwareReady] = useState(false);
  const [firmwareBinary, setFirmwareBinary] = useState<ArrayBuffer | { parts: { offset: number, data: Uint8Array }[] } | null>(null);
  const [flashSupported, setFlashSupported] = useState(false);
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [serialAutoScroll, setSerialAutoScroll] = useState(true);
  const [blocklyReady, setBlocklyReady] = useState(false);
  const [showCamWizard, setShowCamWizard] = useState(false);
  const [viewMode, setViewMode] = useState<"blocks" | "ml">("blocks");
  const [mlPipelineTab, setMlPipelineTab] = useState<MLPipelineTab>("collect");
  /** When set while on the Test tab, inference uses this job id (from Versions). Cleared when leaving Test. */
  const [inferenceJobOverride, setInferenceJobOverride] = useState<string | null>(null);
  const [connectedPort, setConnectedPort] = useState<any>(null);
  const [mlTask, setMlTask] = useState<string>("gesture");
  const [mlArch, setMlArch] = useState<string>("");
  const [trainedModel, setTrainedModel] = useState<{ blockId: string, arch: string, headerUrl: string, labels: string[] } | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeGuide, setActiveGuide] = useState<{ label: string, content: any } | null>(null);
  const [promptDialog, setPromptDialog] = useState<{ message: string, defaultValue: string, callback: (v: string | null) => void } | null>(null);
  const [showMlOnboarding, setShowMlOnboarding] = useState(false);
  const [showMarketplaceExport, setShowMarketplaceExport] = useState(false);
  const [exportingMarketplace, setExportingMarketplace] = useState(false);
  const [compileArtifactHash, setCompileArtifactHash] = useState("");
  const [marketplaceToolboxBlocks, setMarketplaceToolboxBlocks] = useState<string[]>([]);
  const [marketplaceImportItems, setMarketplaceImportItems] = useState<Array<{ id: string; name: string; blocksXml: string }>>([]);
  const [marketplaceInstalledCount, setMarketplaceInstalledCount] = useState(0);
  const [importingInstalled, setImportingInstalled] = useState(false);
  const [exportName, setExportName] = useState("");
  const [exportFunctionality, setExportFunctionality] = useState("");
  const [exportDescription, setExportDescription] = useState("");
  const [exportCategory, setExportCategory] = useState("GPIO");
  const [compiledSourceHash, setCompiledSourceHash] = useState("");
  const [showExamplesPanel, setShowExamplesPanel] = useState(false);
  const mlOnboardingShownRef = useRef(false);
  const showPlanBanner = !canCompile || !canStartTraining;

  const QUICK_GUIDES: Record<string, any> = {
    "Control Logic": (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p>Execution flow blocks natively map to C++ control structures, directly determining how the CPU processes your logic algorithm.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>If Statements:</b> Dynamically route CPU execution based on Boolean conditions. These evaluate natively at runtime.</li>
          <li><b>While Loops:</b> Trap the execution thread in a continuous loop until a break condition clears. <i>Warning: Always yield to OS so the watchdog timer doesn't reset your MCU.</i></li>
          <li><b>Forever Loops:</b> Automatically inject your logic into the board’s foundational <code>void loop()</code> structure for recursive polling.</li>
        </ul>
      </div>
    ),
    "Math & Data": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Your microcontroller contains an Arithmetic Logic Unit (ALU) to process math cleanly. These blocks ensure your data scaling is safe and explicitly bounded.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Map ():</b> Interpolates linear data across ranges dynamically. For example, compressing 12-bit Analog Reads (0-4095) perfectly down to 8-bit PWM signals (0-255).</li>
          <li><b>Constrain ():</b> Creates absolute hardware safety walls. Essential for ensuring servo motors never attempt to strip gears by driving past physical geometry limits.</li>
        </ul>
      </div>
    ),
    "Text & Serial": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Handling strings requires CPU overhead and active memory allocation, but provides fundamental telemetry over USB for debugging.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Serial Print:</b> Flushes character data over the generic UART interface at an explicit <b>115,200 baud</b>. Open the Serial Monitor tab right in the IDE to view telemetry in real-time.</li>
          <li><b>String Construction:</b> Dynamically concatenates variables. The compiler attempts to cast logic conservatively to prevent fragmentation of the tiny heap memory space.</li>
        </ul>
      </div>
    ),
    "Variables": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Variables act as memory vaults in your microcontroller's RAM. They allow your application state to persist and mutate securely across clock cycles.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Global Scope:</b> Declaring a variable globally places it in generic heap space, allowing any decoupled function block to interact with and mutate the memory address consistently.</li>
          <li><b>Type Inference:</b> Behind the scenes, the BitBlock compiler infers optimal C++ types (like doubles, floats, or explicit ints) dynamically to optimize flash footprints without manual memory casts.</li>
        </ul>
      </div>
    ),
    "Functions": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Functions represent the ultimate tool for scalable hardware abstraction. Packaging blocks inside a function slashes the size of your final compiled binary.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Code Reusability:</b> Avoid ballooning the compiled execution timeline. The compiler generates the subroutine once, enabling your C++ execution pointer to jump securely rather than duplicating flash segments.</li>
          <li><b>Arguments:</b> Pass specific sensors or arrays efficiently into execution environments with tightly coupled tracking.</li>
        </ul>
      </div>
    ),
    "GPIO": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>General Purpose Input/Output (GPIO) accesses the lowest level of physical silicon on the MCU, directly controlling pin states and monitoring voltages.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Digital Writes:</b> Bit-bangs pins HIGH (3.3V/5V) or LOW (0V). This is the electrical foundation of turning on LEDs or triggering remote MOSFET gates.</li>
          <li><b>Analog Reads:</b> Accesses the internal Analog-to-Digital Converter (ADC). ESP boards read these natively at a raw 12-bit resolution, feeding precise integers back into your logic pipeline.</li>
        </ul>
      </div>
    ),
    "Timing": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Manipulating the timeline of your firmware directly impacts overall system responsiveness and loop performance metrics.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Blocking Delays:</b> A hard CPU halt. While a block delays, the main thread essentially sleeps. This is easy to read, but blocks sensor pipelines.</li>
          <li><b>Yielding to OS:</b> Boards like the ESP32 utilize a Real-Time Operating System (FreeRTOS) underneath. Highly intensive recursive calculations must occasionally 'Yield' so background tasks (like WiFi tracking) can breathe.</li>
        </ul>
      </div>
    ),
    "Sensors": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Sensors act as the digital nervous system for your hardware array. These abstractions shield you from manually handling raw communication registers.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Protocol Handshakes:</b> Whether connecting an I2C or SPI device, the compiler isolates the Wire clock dependencies and initializes bus streams dynamically within the void setup.</li>
          <li><b>Parsing Logic:</b> Custom C++ driver headers are injected directly into your artifact at compile time to parse esoteric binary streams into highly manageable floats.</li>
        </ul>
      </div>
    ),
    "Actuators": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>Translating programmatic state into raw mechanical actuation and kinetic energy relies entirely on extremely accurate sub-millisecond CPU timing.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Hardware PWM:</b> Simulates analog voltages by strobing a digital pin instantly. The compiler orchestrates optimal frequencies by dynamically binding to the onboard LEDC hardware sub-system.</li>
          <li><b>Servos & NeoPixels:</b> Block libraries map arrays to Direct Memory Access (DMA) lines and explicitly configure PWM to the standardized 50Hz requirement.</li>
        </ul>
      </div>
    ),
    "AI Workspace": (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p>High-end modern development boards featuring extensive RAM processing capabilities natively run Machine Learning on the edge without the cloud.</p>
        <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><b>Data Collection:</b> Route serial telemetry (IMU accelerometers, Audio signals) straight into the visual frontend analyzer matrix.</li>
          <li><b>Cloud Model Training:</b> The platform leverages scalable infrastructure nodes to asynchronously train robust neural networks matching your topology parameters.</li>
          <li><b>C++ Tensor Conversion:</b> Quantizes trained model weights explicitly into C++ header representations, allowing raw edge inference through natively abstracted model execution blocks.</li>
        </ul>
      </div>
    )
  };

  const SIDEBAR_ITEMS = [
    { label: "Control Logic", hint: "If, loops, flow" },
    { label: "Variables", hint: "Store and read values" },
    { label: "Functions", hint: "Reusable block code" },
    { label: "Math & Data", hint: "Numbers and scaling" },
    { label: "Text & Serial", hint: "Strings and printing" },
    { label: "GPIO", hint: "Digital and Analog pins" },
    { label: "Timing", hint: "Delays and OS yielding" },
    { label: "Sensors", hint: "DHT, IMU, Distance" },
    { label: "Actuators", hint: "LEDs, PWM, Motors" },
    { label: "AI Workspace", hint: "Machine Learning tasks" }
  ];

  const workspaceRef = useRef<any>(null);
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<any>(null);
  const serialScrollRef = useRef<HTMLDivElement>(null);

  const currentBoard = getBoardConfig(project?.board || "esp32-wroom");
  const isMlSupported = currentBoard.mlSupport;

  const asMillis = (v: any) => {
    if (!v) return 0;
    if (typeof v.toMillis === "function") return v.toMillis();
    if (v.seconds) return Number(v.seconds) * 1000;
    const n = new Date(v).getTime();
    return Number.isFinite(n) ? n : 0;
  };

  useEffect(() => {
    // @ts-ignore
    setFlashSupported("serial" in navigator);
  }, []);

  // Auto-sync ML task & architecture when board changes
  useEffect(() => {
    if (!currentBoard.mlSupport || currentBoard.supportedMLTasks.length === 0) return;
    const firstTask = currentBoard.supportedMLTasks[0];
    setMlTask(firstTask);
    const archs = TASK_ARCHITECTURES[firstTask as keyof typeof TASK_ARCHITECTURES] || [];
    setMlArch(archs.length > 0 ? archs[0] : "");
  }, [currentBoard.id]);

  useEffect(() => {
    if (!projectId || !user) return;
    fetchProject();
  }, [projectId, user]);

  useEffect(() => {
    if (mlPipelineTab !== "test") setInferenceJobOverride(null);
  }, [mlPipelineTab]);

  // Keep project fields (e.g. mlActiveTrainingJobId) in sync after registry / other updates
  useEffect(() => {
    if (!projectId || !user?.uid) return;
    const unsub = onSnapshot(doc(db, "projects", projectId), (snap) => {
      if (!snap.exists()) {
        navigate("/dashboard");
        return;
      }
      const data = snap.data();
      if (data.ownerId !== user.uid) {
        navigate("/dashboard");
        return;
      }
      setProject({ id: snap.id, ...data });
    });
    return () => unsub();
  }, [projectId, user?.uid, navigate]);

  // Handle automatic Blockly workspace resizing when container flex expands/shrinks
  useEffect(() => {
    if (!blocklyReady || !workspaceRef.current || !blocklyDivRef.current) return;
    const observer = new ResizeObserver(() => {
      if (Blockly && workspaceRef.current) {
        Blockly.svgResize(workspaceRef.current);
      }
    });
    observer.observe(blocklyDivRef.current);
    return () => observer.disconnect();
  }, [blocklyReady]);

  const fetchProject = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "projects", projectId));
      if (!snap.exists()) { navigate("/dashboard"); return; }
      const data = snap.data();
      if (data.ownerId !== user?.uid) { navigate("/dashboard"); return; }
      setProject({ id: snap.id, ...data });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Toolbox ML block: prefer explicit active job, else latest completed training run
  useEffect(() => {
    if (!projectId) return;
    const activeId =
      typeof project?.mlActiveTrainingJobId === "string" && project.mlActiveTrainingJobId.length > 0
        ? project.mlActiveTrainingJobId
        : null;

    const applyJob = (job: Record<string, unknown> | undefined) => {
      if (job?.headerUrl && job?.arch && job?.labels) {
        const arch = String(job.arch);
        setTrainedModel({
          blockId: `ml_model_${arch.toLowerCase().replace(/ /g, "_")}`,
          arch,
          headerUrl: String(job.headerUrl),
          labels: job.labels as string[],
        });
      } else {
        setTrainedModel(null);
      }
    };

    if (activeId) {
      const unsub = onSnapshot(doc(db, "projects", projectId, "jobs", activeId), (snap) => {
        if (!snap.exists()) {
          setTrainedModel(null);
          return;
        }
        const data = snap.data();
        if (data.status === "completed") applyJob(data);
        else setTrainedModel(null);
      });
      return () => unsub();
    }

    const jobsQ = query(
      collection(db, "projects", projectId, "jobs"),
      where("type", "==", "training"),
      where("status", "==", "completed"),
    );
    const unsubscribe = onSnapshot(jobsQ, (snap) => {
      const docs = snap.docs
        .slice()
        .sort((a, b) => asMillis(b.data().startedAt) - asMillis(a.data().startedAt));
      if (docs.length > 0) applyJob(docs[0].data());
      else setTrainedModel(null);
    });
    return () => unsubscribe();
  }, [projectId, project?.mlActiveTrainingJobId]);

  const getToolboxConfig = useCallback((currentModel: any, blocklyInstance: any) => {
    const tb = {
      kind: "categoryToolbox",
      contents: [
        ...getCoreToolboxBlocks(),
        {
          kind: "category", name: "Control",
          contents: [
            { kind: "block", type: "controls_if" },
            { kind: "block", type: "controls_whileUntil" },
            { kind: "block", type: "controls_for" },
            { kind: "block", type: "controls_forEach" },
            { kind: "block", type: "controls_repeat_ext" },
            { kind: "block", type: "logic_compare" },
            { kind: "block", type: "logic_operation" },
            { kind: "block", type: "logic_negate" },
            { kind: "block", type: "logic_boolean" },
          ],
        },
        {
          kind: "category", name: "Math",
          contents: [
            { kind: "block", type: "math_number" },
            { kind: "block", type: "math_arithmetic" },
            { kind: "block", type: "math_modulo" },
            { kind: "block", type: "math_random_int" },
            { kind: "block", type: "math_constrain" },
            { kind: "block", type: "math_map" },
          ],
        },
        {
          kind: "category", name: "Text",
          contents: [
            { kind: "block", type: "text" },
            { kind: "block", type: "text_join" },
            { kind: "block", type: "text_print" },
            { kind: "block", type: "text_length" },
          ],
        },
        {
          kind: "category", name: "Variables", custom: "VARIABLE",
        },
        {
          kind: "category", name: "Functions", custom: "PROCEDURE",
        },
        { kind: "sep" },
        ...getAllLibraryCategories(),
      ],
    } as any;

    if (marketplaceInstalledCount > 0 || marketplaceToolboxBlocks.length > 0 || marketplaceImportItems.length > 0) {
      const importButtons = marketplaceImportItems.map((item) => ({
        kind: "button",
        text: `Insert: ${item.name}`,
        callbackKey: `MARKETPLACE_IMPORT_${item.id}`,
      }));
      tb.contents.push({ kind: "sep" });
      tb.contents.push({
        kind: "category",
        name: "Marketplace",
        colour: "#B94FF0",
        contents: [
          ...importButtons,
          ...(importButtons.length > 0 && marketplaceToolboxBlocks.length > 0 ? [{ kind: "sep" }] : []),
          ...(marketplaceToolboxBlocks.length > 0
            ? marketplaceToolboxBlocks.map((type) => ({ kind: "block", type }))
            : []),
          ...(importButtons.length === 0 && marketplaceToolboxBlocks.length === 0
            ? [{ kind: "label", text: "No installable marketplace items yet" }]
            : []),
        ],
      });
    }

    if (currentModel && blocklyInstance) {
      const archName = ML_ARCHITECTURES[currentModel.arch]?.name || currentModel.arch;
      generateMLBlock(blocklyInstance, currentModel.arch, archName, currentModel.labels);
      tb.contents.push({ kind: "sep" } as any);
      tb.contents.push({
        kind: "category",
        name: "Machine Learning",
        contents: [{ kind: "block", type: currentModel.blockId }]
      } as any);
    }
    return tb;
  }, [marketplaceInstalledCount, marketplaceToolboxBlocks, marketplaceImportItems]);

  // Update Toolbox dynamically when trainedModel changes
  useEffect(() => {
    if (!workspaceRef.current || !Blockly) return;
    const toolbox = getToolboxConfig(trainedModel, Blockly);
    workspaceRef.current.updateToolbox(toolbox);
  }, [trainedModel, marketplaceToolboxBlocks, marketplaceImportItems, getToolboxConfig]);

  useEffect(() => {
    if (!workspaceRef.current || !Blockly) return;
    for (const item of marketplaceImportItems) {
      const callbackKey = `MARKETPLACE_IMPORT_${item.id}`;
      workspaceRef.current.registerButtonCallback(callbackKey, () => {
        try {
          const snippetXml = Blockly.utils.xml.textToDom(item.blocksXml);
          Blockly.Xml.domToWorkspace(snippetXml, workspaceRef.current);
          appendLog(`[Marketplace] Inserted "${item.name}" into workspace.`);
        } catch (e) {
          console.warn(`Failed to insert marketplace item ${item.id}:`, e);
        }
      });
    }
  }, [marketplaceImportItems]);

  // Initialize Blockly once project is loaded
  useEffect(() => {
    if (loading || !project || !blocklyDivRef.current || blocklyReady) return;
    initBlockly();
  }, [project, loading]);

  const initBlockly = async () => {
    if (workspaceRef.current) return; // Prevent double injection
    try {
      const blocklyMod = await import("blockly");
      const baseBlockly = blocklyMod.default || blocklyMod;
      Blockly = { ...baseBlockly }; // Spread explicitly prevents the 'read only' shadow error on modules

      const jsMod = await import("blockly/javascript");
      Blockly.javascriptGenerator = jsMod.javascriptGenerator;
      Blockly.JavaScript = jsMod.javascriptGenerator;

      // Custom variable prompt
      Blockly.dialog.setPrompt((message: string, defaultValue: string, callback: (value: string | null) => void) => {
        setPromptDialog({ message, defaultValue, callback });
      });

      // Custom theme
      const theme = Blockly.Theme.defineTheme("bitblock", {
        base: Blockly.Themes?.Classic,
        blockStyles: {
          logic_blocks: { colourPrimary: "#9D27DE", colourSecondary: "#2A0A3D", colourTertiary: "#6B1A99" },
          math_blocks: { colourPrimary: "#3182CE", colourSecondary: "#1A365D", colourTertiary: "#2B6CB0" },
          loop_blocks: { colourPrimary: "#38A169", colourSecondary: "#1C4532", colourTertiary: "#276749" },
          procedure_blocks: { colourPrimary: "#D69E2E", colourSecondary: "#744210", colourTertiary: "#B7791F" },
          variable_blocks: { colourPrimary: "#E53E3E", colourSecondary: "#742A2A", colourTertiary: "#C53030" },
          text_blocks: { colourPrimary: "#38B2AC", colourSecondary: "#1D4044", colourTertiary: "#2C7A7B" },
          colour_blocks: { colourPrimary: "#B794F4", colourSecondary: "#4A1772", colourTertiary: "#6B46C1" },
          hat_blocks: { colourPrimary: "#9D27DE", colourSecondary: "#2A0A3D", colourTertiary: "#6B1A99" },
        },
        categoryStyles: {
          logic_category: { colour: "#9D27DE" },
          loops_category: { colour: "#38A169" },
          math_category: { colour: "#3182CE" },
          text_category: { colour: "#38B2AC" },
          lists_category: { colour: "#E53E3E" },
          colour_category: { colour: "#B794F4" },
          variable_category: { colour: "#D69E2E" },
          procedure_category: { colour: "#F59E0B" },
        },
        componentStyles: {
          workspaceBackgroundColour: "#0A0A0A",
          toolboxBackgroundColour: "#12031C",
          toolboxForegroundColour: "#F2F2F0",
          flyoutBackgroundColour: "#1A0628",
          flyoutForegroundColour: "#E0D8F0",
          flyoutOpacity: 0.95,
          scrollbarColour: "#2A0A3D",
          insertionMarkerColour: "#9D27DE",
          insertionMarkerOpacity: 0.7,
          cursorColour: "#9D27DE",
        },
      });

      // Register custom renderer to fix the bottom fang overlap issue on housing blocks
      class CustomConstantsProvider extends Blockly.geras.ConstantProvider {
        constructor() {
          super();
          // Add extra padding at the bottom of statement inputs so inner fangs don't overlap flat housing blocks
          this.STATEMENT_BOTTOM_SPACER = 12;
        }
      }

      class CustomRenderer extends Blockly.geras.Renderer {
        makeConstants_() {
          return new CustomConstantsProvider();
        }
      }

      try {
        Blockly.blockRendering.register("bitblock_renderer", CustomRenderer);
      } catch (rendererErr: any) {
        // During hot reload or repeated init, Blockly may already have this renderer.
        // In that case we reuse the existing registration.
        const msg = String(rendererErr?.message || "");
        if (!msg.includes('already registered')) {
          throw rendererErr;
        }
      }

      // Define default and custom blocks
      defineCoreBlocks(Blockly);
      defineAllLibraryBlocks(Blockly);

      // Load installed marketplace blocks/snippets for this user
      const loadedMarketplaceTypes: string[] = [];
      const pendingMarketplaceImports: { id: string; name: string; blocksXml: string }[] = [];
      if (user) {
        try {
          const installedSnap = await getDocs(collection(db, "users", user.uid, "installedBlocks"));
          const installedIds = installedSnap.docs.map(d => d.id);
          setMarketplaceInstalledCount(installedIds.length);

          for (const blockId of installedIds) {
            try {
              const mpSnap = await getDoc(doc(db, "marketplace", blockId));
              if (!mpSnap.exists()) continue;
              const mpData = mpSnap.data();
              const storedBlocksXml = typeof mpData.blocksXml === "string"
                ? mpData.blocksXml
                : (typeof mpData.projectBlocksXml === "string" ? mpData.projectBlocksXml : "");
              if (storedBlocksXml) {
                pendingMarketplaceImports.push({
                  id: blockId,
                  name: String(mpData.name || "Marketplace item"),
                  blocksXml: storedBlocksXml,
                });
              }

              // Register the block definition if it has blockJSON
              const rawBlockJson = mpData.blockJSON ?? mpData.blockJson;
              if (rawBlockJson) {
                const blockDef = typeof rawBlockJson === 'string' ? JSON.parse(rawBlockJson) : rawBlockJson;
                if (!blockDef?.type) continue;
                Blockly.Blocks[blockDef.type] = {
                  init() { this.jsonInit(blockDef); }
                };
                loadedMarketplaceTypes.push(blockDef.type);

                // Register the code generator if provided
                const generatorCode = mpData.generatorCode ?? mpData.generator;
                if (generatorCode) {
                  const gen = Blockly.javascriptGenerator || Blockly.JavaScript;
                  try {
                    const genFn = new Function('block', 'generator', generatorCode);
                    gen.forBlock[blockDef.type] = function (block: any) {
                      return genFn(block, gen);
                    };
                  } catch (genErr) {
                    console.warn(`Failed to parse generator for marketplace block ${blockId}:`, genErr);
                  }
                }

                console.log(`[Marketplace] Loaded block: ${mpData.name || blockId}`);
              }
            } catch (blockErr) {
              console.warn(`Failed to load marketplace block ${blockId}:`, blockErr);
            }
          }
        } catch (err) {
          console.warn("Could not load installed marketplace blocks:", err);
        }
      }
      setMarketplaceToolboxBlocks(Array.from(new Set(loadedMarketplaceTypes)));

      workspaceRef.current = Blockly.inject(blocklyDivRef.current, {
        toolbox: getToolboxConfig(trainedModel, Blockly),
        theme,
        renderer: 'bitblock_renderer',
        trashcan: true,
        zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1 },
        grid: { spacing: 24, length: 4, colour: "rgba(157,39,222,0.1)", snap: true },
        move: { scrollbars: false, drag: true, wheel: true },
        sounds: false,
      });

      // Restore saved XML
      if (project?.blocksXml) {
        try {
          const xml = Blockly.utils.xml.textToDom(project.blocksXml);
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
        } catch (e) {
          console.warn("Could not restore blocks:", e);
        }
      }

      setMarketplaceImportItems(pendingMarketplaceImports);

      // Listen for changes
      workspaceRef.current.addChangeListener((event: any) => {
        if (event.isUiEvent || workspaceRef.current.isDragging()) {
          return;
        }
        setTimeout(() => {
          generateCode();
          scheduleAutoSave();
        }, 10);
      });

      setBlocklyReady(true);
    } catch (e: any) {
      console.error("Blockly init error:", e);
      setCompileStatus("error");
      setCompileMessage(`Blockly Init Failed: ${e.message}`);
      setBlocklyReady(true); // Allow screen to render so we see the error
    }
  };

  const generateCode = useCallback(() => {
    if (!workspaceRef.current || !Blockly) return;
    try {
      const gen = Blockly.javascriptGenerator || Blockly.JavaScript;
      if (gen) {
        const boardId = project?.board || "esp32-wroom";
        compiler.init(boardId);

        let code = gen.workspaceToCode(workspaceRef.current);
        const wrapped = compiler.assemble(code);
        setGeneratedCode(wrapped || "// Add blocks to generate code");

        const warning = compiler.getMemoryWarning();
        if (warning) {
          setCompileMessage(warning);
          setCompileStatus("error"); // use error styling for warning for now
        } else if (compileStatus === "error" && compileMessage.includes("Estimated memory usage is high")) {
          setCompileStatus("idle");
        }
      }
    } catch (e) {
      // ignore
    }
  }, [project?.board]);

  useEffect(() => {
    if (!compiling || !compileStartedAt) return;
    const tick = () => {
      const elapsed = Date.now() - compileStartedAt;
      const estimated = Math.min(92, 10 + (elapsed / 120000) * 82);
      setCompileProgress((prev) => Math.max(prev, estimated));
    };
    tick();
    const timer = setInterval(tick, 1500);
    return () => clearInterval(timer);
  }, [compiling, compileStartedAt]);

  const scheduleAutoSave = () => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveProject(), 3000);
  };

  const importInstalledMarketplaceItems = async () => {
    if (!user || !projectId || !workspaceRef.current || !Blockly) return;
    setImportingInstalled(true);
    try {
      const installedSnap = await getDocs(collection(db, "users", user.uid, "installedBlocks"));
      const installedIds = installedSnap.docs.map((d) => d.id);
      setMarketplaceInstalledCount(installedIds.length);

      const refreshedImportItems: Array<{ id: string; name: string; blocksXml: string }> = [];
      const missingPayloadNames: string[] = [];
      const staleInstalledIds: string[] = [];
      const refreshedBlockTypes: string[] = [];

      for (const d of installedSnap.docs) {
        const blockId = d.id;
        try {
          const installedData = d.data() as any;
          let itemName = String(installedData?.name || "Marketplace item");
          let storedBlocksXml = typeof installedData?.blocksXml === "string"
            ? installedData.blocksXml
            : (typeof installedData?.projectBlocksXml === "string" ? installedData.projectBlocksXml : "");
          if (!storedBlocksXml) {
            const mpSnap = await getDoc(doc(db, "marketplace", blockId));
            if (mpSnap.exists()) {
              const mpData = mpSnap.data() as any;
              itemName = String(mpData?.name || itemName);
              storedBlocksXml = typeof mpData?.blocksXml === "string"
                ? mpData.blocksXml
                : (typeof mpData?.projectBlocksXml === "string" ? mpData.projectBlocksXml : "");
            }
          }
          if (!storedBlocksXml) {
            missingPayloadNames.push(itemName);
            staleInstalledIds.push(blockId);
            continue;
          }
          refreshedImportItems.push({ id: blockId, name: itemName, blocksXml: storedBlocksXml });
          const rawBlockJson = installedData?.blockJSON || installedData?.blockJson;
          if (rawBlockJson) {
            try {
              const blockDef = typeof rawBlockJson === "string" ? JSON.parse(rawBlockJson) : rawBlockJson;
              if (blockDef?.type) refreshedBlockTypes.push(String(blockDef.type));
            } catch {
              // ignore invalid stored block json
            }
          }
        } catch (importErr) {
          console.warn(`Failed to import installed marketplace item ${blockId}:`, importErr);
          const name = String((d.data() as any)?.name || blockId);
          missingPayloadNames.push(name);
        }
      }

      if (staleInstalledIds.length > 0) {
        await Promise.all(
          staleInstalledIds.map((id) =>
            deleteDoc(doc(db, "users", user.uid, "installedBlocks", id)).catch(() => { }),
          ),
        );
      }
      setMarketplaceImportItems(refreshedImportItems);
      if (refreshedBlockTypes.length > 0) {
        setMarketplaceToolboxBlocks((prev) => Array.from(new Set([...prev, ...refreshedBlockTypes])));
      }
      if (refreshedImportItems.length > 0) {
        const extraMissing = missingPayloadNames.length > 0
          ? ` Removed ${missingPayloadNames.length} stale item${missingPayloadNames.length === 1 ? "" : "s"} missing payload (${missingPayloadNames.slice(0, 2).join(", ")}${missingPayloadNames.length > 2 ? "..." : ""}).`
          : "";
        await alert(
          `Marketplace toolbar updated with ${refreshedImportItems.length} installable item${refreshedImportItems.length === 1 ? "" : "s"}. Open the "Marketplace" toolbox category and click item name to insert blocks.` +
          extraMissing,
        );
      } else {
        const suffix = missingPayloadNames.length > 0
          ? ` Removed stale installed item${missingPayloadNames.length === 1 ? "" : "s"} missing payload: ${missingPayloadNames.slice(0, 3).join(", ")}${missingPayloadNames.length > 3 ? "..." : ""}.`
          : "";
        await alert("No installable marketplace items found." + suffix + " Install a listing that includes workspace snapshot payload.");
      }
    } finally {
      setImportingInstalled(false);
    }
  };

  const saveProject = async () => {
    if (!projectId || !workspaceRef.current || !Blockly) return;
    setSaving(true);
    try {
      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      const xmlText = Blockly.utils.xml.domToText(xml);
      const blockCount = workspaceRef.current.getAllBlocks(false).length;
      await updateDoc(doc(db, "projects", projectId), {
        blocksXml: xmlText,
        blockCount,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleCompile = async () => {
    if (!user || !projectId) return;
    let codeToCompile = generatedCode;
    try {
      if (workspaceRef.current && Blockly) {
        const gen = Blockly.javascriptGenerator || Blockly.JavaScript;
        if (gen) {
          const boardId = project?.board || "esp32-wroom";
          compiler.init(boardId);
          const rawCode = gen.workspaceToCode(workspaceRef.current);
          const wrapped = compiler.assemble(rawCode);
          if (wrapped && wrapped.trim()) {
            codeToCompile = wrapped;
            setGeneratedCode(wrapped);
          }
        }
      }
    } catch (regenErr: any) {
      await alert(`Code generation failed before compile: ${regenErr?.message || "Unknown generator error"}`);
      return;
    }
    if (!/void\s+setup\s*\(/.test(codeToCompile) || !/void\s+loop\s*\(/.test(codeToCompile)) {
      await alert("Compile blocked: generated code is incomplete (missing setup/loop). Reinsert or fix invalid marketplace blocks, then try again.");
      return;
    }

    // ── Plan limit check ──
    if (!canCompile) {
      await alert(compileBlockReason || "Compile limit reached. Upgrade your plan for more compiles.");
      return;
    }

    setCompiling(true);
    setCompileStartedAt(Date.now());
    setCompileProgress(8);
    setCompileArtifactHash("");
    setCompiledSourceHash("");
    setFirmwareReady(false);
    setFirmwareBinary(null);
    setCompileStatus("compiling");
    setCompileMessage("Queuing compilation job... this usually takes 1-2 minutes.");
    setPanelTab("code");

    try {
      const board = getBoardConfig(project?.board || "esp32-wroom");
      // Create a compilation job in Firestore
      const jobRef = await addDoc(collection(db, "compilationJobs"), {
        userId: user.uid,
        projectId,
        board: board.id,
        code: codeToCompile,
        status: "queued",
        createdAt: serverTimestamp(),
      });

      // Fetch ML header if needed
      const compileHeaders: Record<string, string> = {};
      if (trainedModel?.headerUrl && codeToCompile.includes(`${trainedModel.blockId}`)) {
        setCompileProgress((p) => Math.max(p, 15));
        setCompileMessage("Fetching ML model weights... this usually takes 1-2 minutes.");
        try {
          const hdrRes = await fetch(trainedModel.headerUrl);
          if (hdrRes.ok) {
            const safeModelName = trainedModel.arch.toLowerCase().replace(/[^a-z0-9]/g, "_");
            compileHeaders[`${safeModelName}_model_data.h`] = await hdrRes.text();
          }
        } catch (err) {
          console.warn("Failed to fetch ML header", err);
        }
      }

      setCompileProgress((p) => Math.max(p, 28));
      setCompileMessage("Job queued · ID: " + jobRef.id.slice(0, 8) + " · compiling now (1-2 min).");
      const endpoint = (import.meta.env.VITE_COMPILER_URL as string) || "/.netlify/functions/compile-firmware";
      // For local dev, call Cloud Run directly since Netlify functions aren't available
      const compileUrl = endpoint === "/.netlify/functions/compile-firmware" && window.location.hostname === "localhost"
        ? "https://bitblock-compiler-409440684176.us-central1.run.app/compile"
        : endpoint;
      const includeAuthHeader = !compileUrl.startsWith("http");
      const response = await fetch(compileUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(includeAuthHeader && auth.currentUser
            ? { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }
            : {}),
        },
        body: JSON.stringify({
          jobId: jobRef.id,
          projectId,
          boardId: board.id,
          fqbn: board.fqbn,
          code: codeToCompile,
          format: board.platform === "esp32" || board.platform === "esp8266" ? "bin" : (board.isAVR ? "hex" : "bin"),
          headers: compileHeaders,
        }),
      });
      setCompileProgress((p) => Math.max(p, 82));

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        const detail = typeof payload?.details === "string" ? payload.details.trim() : "";
        const base = payload?.error || `Compiler service failed (${response.status})`;
        throw new Error(detail ? `${base}: ${detail}` : base);
      }
      if (payload?.parts && Array.isArray(payload.parts)) {
        // Multi-part firmware (ESP32/ESP8266)
        const parsedParts = payload.parts.map((p: any) => ({
          offset: p.offset,
          data: new Uint8Array(atob(p.dataBase64).split("").map(c => c.charCodeAt(0)))
        }));

        const totalSize = parsedParts.reduce((acc: number, p: any) => acc + p.data.byteLength, 0);
        if (totalSize < 32768) {
          throw new Error(`Firmware bundle is too small (${totalSize} bytes) and looks invalid for app flash.`);
        }

        setFirmwareBinary({ parts: parsedParts });
        setCompileArtifactHash(await hashCompiledArtifact({ parts: parsedParts }));
        const kb = (totalSize / 1024).toFixed(1);
        setCompileProgress(100);
        setCompileMessage(`✓ Firmware built (multi-part bin) · ${kb}KB · Ready to flash`);

      } else {
        // Legacy single-part firmware
        const artifactBase64 = payload?.artifactBase64 as string | undefined;
        if (!artifactBase64) {
          throw new Error("Compiler service returned no firmware artifact.");
        }
        const fileName = String(payload?.fileName || "");
        const lowerName = fileName.toLowerCase();
        if (
          lowerName.includes("boot_app0") ||
          lowerName.includes("bootloader") ||
          lowerName.includes("partition")
        ) {
          throw new Error(`Compiler returned non-application binary (${fileName}).`);
        }
        const binary = Uint8Array.from(atob(artifactBase64), (c) => c.charCodeAt(0)).buffer;
        setFirmwareBinary(binary);
        setCompileArtifactHash(await hashCompiledArtifact(binary));
        const kb = (binary.byteLength / 1024).toFixed(1);
        setCompileProgress(100);
        setCompileMessage(`✓ Firmware built (${(payload?.format || "bin").toUpperCase()}) · ${kb}KB · ${fileName || "artifact"} · Ready to flash`);
      }

      setFirmwareReady(true);
      setCompileStatus("success");
      setCompiledSourceHash(await sha256Hex(codeToCompile));
      appendLog(`[Compile] Cloud compile complete for ${board.name}`);
      // Update compilation stat for user profile
      try {
        await updateDoc(doc(db, "users", user.uid), { compilationCount: increment(1) });
        await incrementCompileCount();
      } catch (err) {
        console.warn("Failed to increment compilation count", err);
      }
    } catch (e: any) {
      setCompileStatus("error");
      setCompileProgress(0);
      setCompileMessage(`Compilation failed: ${e?.message || "Unknown error"}`);
      appendLog(`[Error] Compile failed: ${e?.message || "Unknown error"}`);
    } finally {
      setCompiling(false);
      setCompileStartedAt(null);
    }
  };

  const appendLog = (msg: string) => setSerialLog(l => [...l, msg]);

  const loadExample = async (example: typeof MARKETPLACE_EXAMPLES[0]) => {
    if (!workspaceRef.current || !Blockly) return;
    // Set the correct board for this example
    if (project && example.boardId !== project.board) {
      setProject((p: any) => ({ ...p, board: example.boardId }));
      if (projectId) {
        await updateDoc(doc(db, "projects", projectId), { board: example.boardId });
      }
    }
    // Clear workspace and load the example blocks
    workspaceRef.current.clear();
    try {
      const xml = Blockly.utils.xml.textToDom(example.blocksXml);
      Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
      workspaceRef.current.scrollCenter();
      setTimeout(() => generateCode(), 50);
      setShowExamplesPanel(false);
      appendLog(`[Examples] Loaded "${example.name}" (${example.category})`);
    } catch (e: any) {
      console.error("Failed to load example:", e);
      await alert(`Failed to load example: ${e?.message}`);
    }
  };

  useEffect(() => {
    if (!serialAutoScroll || panelTab !== "serial") return;
    if (!serialScrollRef.current) return;
    serialScrollRef.current.scrollTop = serialScrollRef.current.scrollHeight;
  }, [serialLog, serialAutoScroll, panelTab]);

  const hashCompiledArtifact = async (
    artifact: ArrayBuffer | { parts: { offset: number, data: Uint8Array }[] } | null,
  ) => {
    if (!artifact) return "";
    if (artifact instanceof ArrayBuffer) {
      const bytes = Array.from(new Uint8Array(artifact)).map((b) => String.fromCharCode(b)).join("");
      return sha256Hex(bytes);
    }
    const fingerprint = artifact.parts
      .map((p) => `${p.offset}:${p.data.byteLength}:${Array.from(p.data.slice(0, 64)).join(",")}`)
      .join("|");
    return sha256Hex(fingerprint);
  };

  const handleExportToMarketplace = async () => {
    if (!user || !projectId || exportingMarketplace) return;
    if (compileStatus !== "success") {
      await alert("Compile your current workspace project successfully before exporting.");
      return;
    }
    const currentSourceHash = await sha256Hex(generatedCode);
    if (compiledSourceHash && compiledSourceHash !== currentSourceHash) {
      await alert("Blocks changed after your last compile. Compile again before exporting.");
      return;
    }

    const name = exportName.trim();
    const functionality = exportFunctionality.trim();
    const description = exportDescription.trim();
    if (!name || !functionality || !description) {
      await alert("Please complete name, functionality, and description.");
      return;
    }
    if (name.length > 128 || description.length > 2000) {
      await alert("Name/description is too long.");
      return;
    }

    setExportingMarketplace(true);
    try {
      const sourceHash = currentSourceHash;
      const compiledHash = compileArtifactHash || sourceHash;
      let blocksXmlSnapshot = "";
      try {
        if (workspaceRef.current && Blockly) {
          const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
          blocksXmlSnapshot = Blockly.utils.xml.domToText(xml) || "";
        }
      } catch {
        blocksXmlSnapshot = "";
      }
      if (!blocksXmlSnapshot.trim()) {
        await alert("Export blocked: this listing has no workspace block snapshot. Save your workspace and try again.");
        return;
      }
      const existingSnap = await getDocs(collection(db, "marketplace"));
      const existing = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

      const sameOutput = existing.find((b) => b.compiledOutputHash === compiledHash || b.sourceHash === sourceHash);
      if (sameOutput) {
        await alert(`Export blocked: "${sameOutput.name || "existing block"}" already outputs exactly the same code.`);
        return;
      }

      const normalizedName = normalizeText(name);
      const normalizedFn = normalizeText(functionality);
      const normalizedDesc = normalizeText(description);
      const nameMatches = existing.filter((b) => normalizeText(String(b.name || "")) === normalizedName).length;
      const functionMatches = existing.filter((b) => normalizeText(String(b.functionality || "")) === normalizedFn).length;
      const descMatches = existing.filter((b) => normalizeText(String(b.description || b.desc || "")) === normalizedDesc).length;
      if (nameMatches >= 2 || functionMatches >= 2 || descMatches >= 2) {
        await alert("Export blocked: similar community blocks already exist (anti-spam protection).");
        return;
      }

      await addDoc(collection(db, "marketplace"), {
        authorId: user.uid,
        author: user.displayName || user.email || "BitBuilder",
        projectId,
        name,
        functionality,
        description,
        desc: description,
        category: exportCategory,
        boardId: currentBoard.id,
        boards: [currentBoard.name],
        sourceCode: generatedCode,
        blocksXml: blocksXmlSnapshot,
        sourceHash,
        compiledOutputHash: compiledHash,
        verified: false,
        downloads: 0,
        rating: 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid), { publishedBlocks: increment(1) });

      setShowMarketplaceExport(false);
      setExportName("");
      setExportFunctionality("");
      setExportDescription("");
      await alert("Your compiled project has been exported to the marketplace.");
    } catch (e: any) {
      await alert(`Marketplace export failed: ${e?.message || "Unknown error"}`);
    } finally {
      setExportingMarketplace(false);
    }
  };

  /** AVR/STK500: single buffer. ESP multi-part builds must use the full `parts` object — never take only one segment. */
  const getPrimaryFirmwareBuffer = (artifact: ArrayBuffer | { parts: { offset: number, data: Uint8Array }[] } | null): ArrayBuffer | null => {
    if (!artifact) return null;
    if (artifact instanceof ArrayBuffer) return artifact;
    const firstPart = artifact.parts?.[0];
    if (!firstPart?.data) return null;
    return new Uint8Array(firstPart.data).buffer;
  };

  const getEspFlashPayload = (
    artifact: ArrayBuffer | { parts: { offset: number; data: Uint8Array }[] } | null,
  ): ArrayBuffer | { parts: { offset: number; data: Uint8Array }[] } | null => {
    if (!artifact) return null;
    if (artifact instanceof ArrayBuffer) return artifact.byteLength ? artifact : null;
    const parts = artifact.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const nonEmpty = parts.filter((p) => p?.data && p.data.byteLength > 0);
    if (nonEmpty.length === 0) return null;
    return { parts: nonEmpty };
  };

  const ensureSerialPort = async () => {
    // Reuse an already connected port first to avoid repeated pairing prompts.
    if (connectedPort) return connectedPort;

    // @ts-ignore
    const rememberedPorts = await navigator.serial.getPorts();
    if (rememberedPorts.length > 0) {
      const rememberedPort = rememberedPorts[0];
      setConnectedPort(rememberedPort);
      return rememberedPort;
    }

    // @ts-ignore
    const requestedPort = await navigator.serial.requestPort();
    setConnectedPort(requestedPort);
    return requestedPort;
  };

  const releaseOpenSerialPorts = async () => {
    // Some flows keep a serial handle open; esptool-js requires closed handles before it opens.
    try {
      if (connectedPort?.readable) {
        await connectedPort.close();
      }
    } catch {
      // ignore close errors from stale handles
    }
    try {
      // @ts-ignore
      const ports = await navigator.serial.getPorts();
      for (const p of ports) {
        try {
          if (p.readable) await p.close();
        } catch {
          // ignore close errors per port
        }
      }
    } catch {
      // ignore if serial api errors
    }
  };

  const handleDisconnectBoard = async () => {
    try {
      await releaseOpenSerialPorts();
      setConnectedPort(null);
      appendLog("[WebSerial] Device disconnected.");
    } catch (e: any) {
      appendLog(`[WebSerial] Disconnect issue: ${e?.message || "Unknown error"}`);
      setConnectedPort(null);
    }
  };

  const handleConnectBoard = async () => {
    if (!flashSupported) {
      await alert("WebSerial is not supported in your browser.\n\nPlease use Chrome or Edge.");
      return;
    }
    try {
      const port = await ensureSerialPort();
      setConnectedPort(port);
      const info = port.getInfo();
      if (info.usbVendorId) {
        appendLog(`[WebSerial] Paired hardware: VID ${info.usbVendorId} PID ${info.usbProductId}`);
      } else {
        appendLog(`[WebSerial] Device paired successfully`);
      }
    } catch (e: any) {
      console.warn("Connection cancelled or failed", e);
    }
  };

  const handleFlash = async () => {
    const board = getBoardConfig(project?.board || "esp32-wroom");
    if (!firmwareReady) {
      setPanelTab("serial");
      appendLog("[Error] No compiled firmware artifact available.");
      appendLog("[Hint] Current flow generated source code only.");
      appendLog("[Hint] Export .ino and flash from Arduino IDE.");
      await alert("No firmware binary available yet. Export .ino and flash from Arduino IDE for now.");
      return;
    }

    if (board.id === "arduino-nano-esp32" || board.id === "rp2040-pico") {
      setPanelTab("serial");
      if (firmwareBinary) {
        const buffer = firmwareBinary instanceof ArrayBuffer ? firmwareBinary : (firmwareBinary as any).parts[0].data.buffer;
        flashUF2(buffer, appendLog);
      }
      return;
    }

    if (!flashSupported) {
      await alert("WebSerial is not supported in your browser.\n\nPlease use Chrome or Edge.");
      return;
    }

    if (board.id === "esp32-cam") {
      setShowCamWizard(true);
      return;
    }

    await performSerialFlash(board);
  };

  const performSerialFlash = async (board: any) => {
    setShowCamWizard(false);
    setPanelTab("serial");

    try {
      const port = await ensureSerialPort();
      appendLog("[WebSerial] Port acquired for flashing");
      await releaseOpenSerialPorts();

      if (board.platform === "esp32" || board.platform === "esp8266") {
        const espPayload = getEspFlashPayload(firmwareBinary);
        if (!espPayload) {
          appendLog("[Error] Firmware artifact missing or empty.");
          return;
        }
        if (typeof espPayload === "object" && "parts" in espPayload) {
          appendLog(`[Flash] Multi-part image (${espPayload.parts.length} regions) — bootloader, partition table, and app.`);
        }
        // esptool-js Transport handles port.open() internally,
        // flashESPBlock now closes the port first before opening via Transport.
        appendLog(`[Flash] Starting ESP flash for ${board.name}...`);
        await flashESPBlock(port, 115200, espPayload, appendLog);
      } else if (board.isAVR) {
        const primaryFirmware = getPrimaryFirmwareBuffer(firmwareBinary);
        if (!primaryFirmware || primaryFirmware.byteLength === 0) {
          appendLog("[Error] Firmware artifact missing or empty.");
          return;
        }
        // STK500 protocol needs the port; close any existing streams first
        // so stk500Protocol can open fresh reader/writer handles.
        try {
          if (port.readable || port.writable) {
            await port.close();
          }
        } catch {
          // already closed — that's fine
        }
        appendLog(`[Flash] Starting AVR/STK500 flash for ${board.name}...`);
        // The compiler returns Intel HEX text for AVR boards (format: "hex").
        // firmwareBinary contains the ASCII bytes of that hex file — decode
        // it back to a string and pass directly to the STK500 flasher.
        const hexData = new TextDecoder().decode(primaryFirmware);
        await flashSTK500(port, hexData, appendLog);
      } else {
        appendLog(`[Error] No flash protocol available for platform: ${board.platform}`);
        appendLog("[Hint] Export the .ino file and flash using Arduino IDE.");
      }

    } catch (e: any) {
      if (e.name !== "NotFoundError") {
        appendLog(`[Error] ${e.message}`);
      }
    } finally {
      // Ensure WebSerial state is clean so repeated ESP flashes
      // work without forcing a full page refresh.
      try {
        await releaseOpenSerialPorts();
      } catch {
        // ignore cleanup errors
      }
      setConnectedPort(null);
    }
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A0A" }}>
        <CassetteMascot size={120} mood="thinking" animate />
      </div>
    );
  }

  return (
    <div className="ide-layout" style={{
      fontFamily: "Space Grotesk, sans-serif",
      gridTemplateColumns: viewMode === "ml" ? "1fr" : (sidebarExpanded ? "260px 1fr 340px" : "48px 1fr 340px"),
      gridTemplateRows: "72px 1fr 32px",
      transition: "grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
    }}>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <header className="ide-toolbar glass-dark" style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "0 20px", borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <Link to="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(242,242,240,0.5)" strokeWidth="3">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 18, color: "#9D27DE", paddingTop: 3 }}>BB</span>
        </Link>

        <div style={{ width: 1, height: 24, background: "rgba(157,39,222,0.2)" }} />

        <div style={{ flex: 1, display: "flex", gap: 32, alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#F2F2F0" }}>{project?.name}</span>

          {/* View Mode Toggle */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 3, border: "1px solid rgba(157,39,222,0.15)" }}>
            <button
              onClick={() => setViewMode("blocks")}
              style={{
                background: viewMode === "blocks" ? "rgba(157,39,222,0.2)" : "transparent",
                color: viewMode === "blocks" ? "#F2F2F0" : "rgba(242,242,240,0.5)",
                border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                display: "flex", alignItems: "center", gap: 6, transition: "0.2s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9h16v11H4z" /><path d="M4 9l8-5 8 5" /></svg>
              Workspace
            </button>
            <button
              onClick={() => {
                if (isMlSupported) {
                  setViewMode("ml");
                  if (!mlOnboardingShownRef.current) {
                    mlOnboardingShownRef.current = true;
                    setShowMlOnboarding(true);
                  }
                }
              }}
              title={!isMlSupported ? "Board does not support ML Pipeline" : ""}
              style={{
                background: viewMode === "ml" ? "rgba(157,39,222,0.2)" : "transparent",
                color: isMlSupported ? (viewMode === "ml" ? "#F2F2F0" : "rgba(242,242,240,0.5)") : "rgba(242,242,240,0.2)",
                border: "none", padding: "4px 12px", borderRadius: 4, cursor: isMlSupported ? "pointer" : "not-allowed", fontSize: 12,
                display: "flex", alignItems: "center", gap: 6, transition: "0.2s"
              }}
            >
              {!isMlSupported ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></svg>
              )}
              ML Pipeline
            </button>
          </div>
        </div>

        {/* Board selector */}
        <select
          id="board-selector"
          value={project?.board || "esp32-wroom"}
          onChange={async (e) => {
            setProject((p: any) => ({ ...p, board: e.target.value }));
            if (projectId) {
              await updateDoc(doc(db, "projects", projectId), { board: e.target.value });
            }
          }}
          style={{
            background: "#1A0628", border: "1px solid rgba(157,39,222,0.3)",
            color: "#F2F2F0", borderRadius: 8, padding: "5px 10px", fontSize: 12,
            cursor: "pointer", outline: "none",
          }}
        >
          {BOARDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {/* Board color dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: getBoardConfig(project?.board || "esp32-wroom").color,
          boxShadow: `0 0 8px ${getBoardConfig(project?.board || "esp32-wroom").color}`,
        }} />

        <div style={{ width: 1, height: 24, background: "rgba(157,39,222,0.2)" }} />

        {/* Save indicator */}
        <span style={{ fontSize: 11, color: saving ? "#9D27DE" : "rgba(242,242,240,0.3)" }}>
          {saving ? "Saving..." : "Auto-saved"}
        </span>

        <button
          id="save-btn"
          onClick={saveProject}
          className="btn-ghost"
          style={{ fontSize: 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
          </svg>
          Save
        </button>

        {/* Connect Board */}
        <button
          id="connect-btn"
          onClick={connectedPort ? handleDisconnectBoard : handleConnectBoard}
          className="btn-ghost"
          style={{ padding: "7px 18px", fontSize: 12, color: connectedPort ? "#4ade80" : "inherit" }}
          title={connectedPort ? "Disconnect currently paired board" : "Pair board via WebSerial"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
            <path d="M8 8v8M16 8v8M4 12h16" />
          </svg>
          {connectedPort ? "Disconnect Board" : "Connect Board"}
        </button>

        {/* Compile */}
        <button
          id="compile-btn"
          onClick={handleCompile}
          disabled={compiling || !canCompile}
          className="btn-primary"
          style={{ padding: "7px 18px", fontSize: 12, opacity: !canCompile ? 0.55 : 1 }}
          title={!canCompile ? (compileBlockReason || "Compile limit reached") : "Compile project"}
        >
          {compiling ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "spin-slow 0.8s linear infinite" }}>
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
              </svg>
              Compiling...
              {" "}1-2 min
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Compile
            </>
          )}
        </button>

        {/* Flash */}
        <button
          id="flash-btn"
          onClick={handleFlash}
          disabled={compileStatus !== "success" || !firmwareReady}
          className="btn-secondary"
          style={{ padding: "7px 18px", fontSize: 12, opacity: (compileStatus !== "success" || !firmwareReady) ? 0.4 : 1 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Flash Device
        </button>

        <button
          id="export-marketplace-btn"
          onClick={() => setShowMarketplaceExport(true)}
          disabled={compileStatus !== "success"}
          className="btn-ghost"
          style={{ fontSize: 12, opacity: compileStatus === "success" ? 1 : 0.45 }}
          title={compileStatus === "success" ? "Export compiled project to marketplace" : "Compile first to enable export"}
        >
          Export to Marketplace
        </button>
        <button
          id="examples-btn"
          onClick={() => setShowExamplesPanel(true)}
          className="btn-ghost"
          style={{ fontSize: 12 }}
          title="Browse and load pre-built example projects"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Examples
        </button>
        {showPlanBanner && (
          <div style={{ width: "100%", marginTop: 0 }}>
            <PlanLimitBanner fullBleed squareTop />
          </div>
        )}
      </header>

      {/* ── Sidebar: Block categories info ──────────────── */}
      <aside className="ide-sidebar" style={{
        background: "#0D0018",
        borderRight: "1px solid rgba(157,39,222,0.1)",
        padding: sidebarExpanded ? "12px 0" : 0,
        display: viewMode === "blocks" ? "flex" : "none",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}>
        {!sidebarExpanded ? (
          <button
            type="button"
            aria-expanded={false}
            aria-label="Expand Quick Help"
            title="Expand Quick Help"
            onClick={() => setSidebarExpanded(true)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              width: "100%",
              minHeight: 0,
              border: "none",
              background: "rgba(157,39,222,0.04)",
              cursor: "pointer",
              padding: "12px 0",
              borderRight: "2px solid rgba(157,39,222,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(157,39,222,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(157,39,222,0.04)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(157,39,222,0.65)" strokeWidth="2" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span
              style={{
                display: "inline-block",
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                transform: "rotate(180deg)",
                transformOrigin: "center center",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(242,242,240,0.55)",
                fontFamily: "Superstar, fantasy",
                userSelect: "none",
              }}
            >
              Quick Help
            </span>
          </button>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 8px" }}>
              <span style={{ fontSize: 10, color: "rgba(242,242,240,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Quick Help
              </span>
              <button
                type="button"
                aria-expanded
                aria-label="Collapse Quick Help"
                onClick={() => setSidebarExpanded(false)}
                className="btn-ghost"
                style={{ padding: "2px 6px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(242,242,240,0.5)" strokeWidth="2" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <QuickHelpPanel />
            </div>
          </>
        )}
      </aside>

      {/* ── Active Guide Modal Overlay ──────────────────── */}
      {activeGuide && (
        <div style={{ position: "fixed", inset: 0, zIndex: 105, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
          onClick={() => setActiveGuide(null)}
        >
          <div style={{ background: "#12031C", border: "1px solid #9D27DE", borderRadius: 12, padding: 32, width: 450, maxWidth: "90%", boxShadow: "0 24px 50px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: "#F2F2F0", fontWeight: 700, fontSize: 20, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9D27DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              {activeGuide.label} Guide
            </h2>
            <div style={{ height: 1, width: "100%", background: "rgba(157,39,222,0.2)", marginBottom: 16 }} />
            <p style={{ color: "#E0D8F0", fontSize: 14, lineHeight: 1.6, fontFamily: "Space Grotesk, sans-serif" }}>
              {activeGuide.content}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn-primary" onClick={() => setActiveGuide(null)} style={{ padding: "8px 16px" }}>Close Guide</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Canvas (Blockly) ────────────────────────── */}
      <main className="ide-canvas" style={{ position: "relative", overflow: "hidden", display: viewMode === "blocks" ? "block" : "none" }}>
        {!blocklyReady && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0A0A0A",
          }}>
            <div style={{ textAlign: "center" }}>
              <CassetteMascot size={100} mood="thinking" animate />
              <p style={{ fontSize: 13, color: "rgba(242,242,240,0.4)", marginTop: 12 }}>Loading editor...</p>
            </div>
          </div>
        )}
        <div ref={blocklyDivRef} style={{ width: "100%", height: "100%" }} />
      </main>

      {/* ── Right Panel ─────────────────────────────────── */}
      <aside className="ide-panel" style={{
        background: "#0D0018",
        borderLeft: "1px solid rgba(157,39,222,0.1)",
        display: viewMode === "blocks" ? "flex" : "none"
      }}>
        {/* Panel tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid rgba(157,39,222,0.1)",
          padding: "0 4px", flexWrap: "wrap"
        }}>
          {([
            { id: "code", label: "< > Code" },
            { id: "serial", label: "⌨ Serial" },
            { id: "info", label: "ℹ Info" },
          ] as { id: PanelTab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              id={`panel-tab-${tab.id}`}
              onClick={() => setPanelTab(tab.id)}
              style={{
                flex: 1, padding: "10px 8px", background: "transparent",
                border: "none", cursor: "pointer", fontSize: 11,
                color: panelTab === tab.id ? "#9D27DE" : "rgba(242,242,240,0.4)",
                borderBottom: panelTab === tab.id ? "2px solid #9D27DE" : "2px solid transparent",
                transition: "all 0.15s", fontFamily: "Space Grotesk, sans-serif",
                fontWeight: panelTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
          {panelTab === "code" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              {/* Compile status */}
              {compileStatus !== "idle" && (
                <div style={{
                  padding: "10px 14px",
                  background: compileStatus === "success" ? "rgba(34,197,94,0.08)" :
                    compileStatus === "error" ? "rgba(239,68,68,0.08)" : "rgba(157,39,222,0.08)",
                  borderBottom: `1px solid ${compileStatus === "success" ? "rgba(34,197,94,0.2)" :
                    compileStatus === "error" ? "rgba(239,68,68,0.2)" : "rgba(157,39,222,0.2)"}`,
                  fontSize: 11,
                  color: compileStatus === "success" ? "#4ade80" : compileStatus === "error" ? "#f87171" : "#B94FF0",
                }}>
                  {compileMessage}
                  {compileStatus === "compiling" && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{
                        height: 5,
                        width: "100%",
                        borderRadius: 999,
                        background: "rgba(185,79,240,0.22)",
                        overflow: "hidden",
                      }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.max(4, Math.min(100, compileProgress))}%`,
                            background: "linear-gradient(90deg, #9D27DE, #C084FC)",
                            transition: "width 0.8s ease",
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 6, fontSize: 10, color: "rgba(242,242,240,0.72)" }}>
                        Compiling in cloud... usually 1-2 minutes.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Code header */}
              <div style={{
                padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: "1px solid rgba(157,39,222,0.08)",
              }}>
                <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", letterSpacing: "0.1em" }}>
                  {project?.board?.toUpperCase()} · C/C++
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    id="copy-code-btn"
                    onClick={() => navigator.clipboard.writeText(generatedCode)}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "3px 8px" }}
                  >
                    Copy
                  </button>
                  <button
                    id="download-code-btn"
                    onClick={() => {
                      const blob = new Blob([generatedCode], { type: "text/plain" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${project?.name || "bitblock"}.ino`;
                      a.click();
                    }}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "3px 8px" }}
                  >
                    ↓ .ino
                  </button>
                </div>
              </div>

              {/* Code content */}
              <pre style={{
                flex: 1, padding: "14px", margin: 0,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11, lineHeight: 1.7,
                color: "#E0D8F0", overflow: "auto",
                background: "transparent", whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                <CodeHighlight code={generatedCode} />
              </pre>
            </div>
          )}

          {panelTab === "serial" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(157,39,222,0.08)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)" }}>Serial Monitor</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setSerialAutoScroll((v) => !v)}
                    className="btn-ghost"
                    style={{ fontSize: 10, padding: "2px 8px" }}
                    title={serialAutoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
                  >
                    {serialAutoScroll ? "Auto-scroll: On" : "Auto-scroll: Off"}
                  </button>
                  <button onClick={() => setSerialLog([])} className="btn-ghost" style={{ fontSize: 10, padding: "2px 8px" }}>Clear</button>
                </div>
              </div>
              <div ref={serialScrollRef} style={{ flex: 1, overflow: "auto", padding: 14 }}>
                {serialLog.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(242,242,240,0.25)", fontFamily: "JetBrains Mono, monospace" }}>
                    {flashSupported ? "Connect and flash your device to see output." : "⚠ WebSerial not supported.\nUse Chrome or Edge."}
                  </p>
                ) : serialLog.map((line, i) => (
                  <div key={i} style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: 11,
                    color: line.includes("[Error]") ? "#f87171" : line.includes("[Flash]") ? "#4ade80" : "#E0D8F0",
                    padding: "2px 0",
                  }}>
                    {line}
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(157,39,222,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: flashSupported ? "#22C55E" : "#EF4444",
                  }} />
                  <span style={{ fontSize: 10, color: "rgba(242,242,240,0.3)" }}>
                    {flashSupported ? "WebSerial available" : "WebSerial not supported"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {panelTab === "info" && (
            <div style={{ padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F2F0", marginBottom: 16 }}>Board Info</h3>
              <BoardInfo boardId={project?.board || "esp32-wroom"} />
            </div>
          )}
        </div>
      </aside>

      {/* ── Machine Learning Pipeline ──────────────────── */}
      {viewMode === "ml" && (
        <div style={{ gridColumn: "1 / -1", gridRow: 2, flex: 1, display: "flex", justifyContent: "center", background: "#0A0A0A", padding: 16, gap: 16, overflow: "auto", height: "100%", boxSizing: "border-box", position: "relative" }}>
          {!isMlSupported && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 50, background: "rgba(10,10,10,0.85)",
              backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", textAlign: "center", padding: 40
            }}>
              <div style={{ background: "#1A0628", border: "1px solid rgba(157,39,222,0.3)", borderRadius: 16, padding: "40px 60px", maxWidth: 500, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: "#F2F2F0", marginBottom: 12 }}>Hardware Incompatible</h2>
                <p style={{ fontSize: 14, color: "rgba(242,242,240,0.6)", lineHeight: 1.6, marginBottom: 24 }}>
                  The selected board (<strong>{currentBoard.name}</strong>) does not have the necessary hardware acceleration or memory to run Machine Learning tasks.
                  <br /><br />
                  To use the AI Workspace, please select an <strong>ESP32-S3</strong>, <strong>ESP32-CAM</strong>, or <strong>Arduino Nano ESP32</strong>.
                </p>
                <button
                  onClick={() => setViewMode("blocks")}
                  className="btn-primary"
                  style={{ padding: "10px 24px" }}
                >
                  Back to Workspace
                </button>
              </div>
            </div>
          )}

          <div style={{ width: "min(1440px, 100%)", background: "#1A0628", borderRadius: 12, border: "1px solid rgba(157,39,222,0.3)", display: "flex", flexDirection: "column", opacity: isMlSupported ? 1 : 0.4 }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(157,39,222,0.15)", background: "rgba(157,39,222,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F2F2F0", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9D27DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></svg>
                ML Pipeline
              </h2>
              <div style={{ display: "flex", background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 3, border: "1px solid rgba(157,39,222,0.15)", gap: 4 }}>
                <button
                  onClick={() => setMlPipelineTab("collect")}
                  style={{
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    background: mlPipelineTab === "collect" ? "rgba(157,39,222,0.2)" : "transparent",
                    color: mlPipelineTab === "collect" ? "#F2F2F0" : "rgba(242,242,240,0.45)",
                  }}
                >
                  Data Collection
                </button>
                <button
                  onClick={() => setMlPipelineTab("train")}
                  style={{
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    background: mlPipelineTab === "train" ? "rgba(157,39,222,0.2)" : "transparent",
                    color: mlPipelineTab === "train" ? "#F2F2F0" : "rgba(242,242,240,0.45)",
                  }}
                >
                  Training
                </button>
                <button
                  onClick={() => setMlPipelineTab("versions")}
                  style={{
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    background: mlPipelineTab === "versions" ? "rgba(157,39,222,0.2)" : "transparent",
                    color: mlPipelineTab === "versions" ? "#F2F2F0" : "rgba(242,242,240,0.45)",
                  }}
                >
                  Versions
                </button>
                <button
                  onClick={() => setMlPipelineTab("test")}
                  style={{
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: "pointer",
                    background: mlPipelineTab === "test" ? "rgba(157,39,222,0.2)" : "transparent",
                    color: mlPipelineTab === "test" ? "#F2F2F0" : "rgba(242,242,240,0.45)",
                  }}
                >
                  Inference Testing
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
              {mlPipelineTab === "collect" && (
                <DataCollection projectId={projectId || ""} boardId={project?.board || "esp32-wroom"} task={mlTask} architecture={mlArch} />
              )}
              {mlPipelineTab === "train" && (
                <TrainingView projectId={projectId || ""} boardId={project?.board || "esp32-wroom"} task={mlTask} setTask={setMlTask} selectedArch={mlArch} setSelectedArch={setMlArch} onGoToCollect={() => setMlPipelineTab("collect")} canStartTraining={canStartTraining} trainingBlockReason={trainingBlockReason} incrementTrainingCount={incrementTrainingCount} />
              )}
              {mlPipelineTab === "versions" && projectId && (
                <ModelRegistry
                  projectId={projectId}
                  pipelineArchitecture={mlArch}
                  activeJobId={project?.mlActiveTrainingJobId ?? null}
                  onTestModel={(jobId) => {
                    setInferenceJobOverride(jobId);
                    setMlPipelineTab("test");
                  }}
                />
              )}
              {mlPipelineTab === "test" && (
                <TestingView
                  projectId={projectId || ""}
                  architecture={mlArch}
                  inferenceJobId={
                    inferenceJobOverride ??
                    (typeof project?.mlActiveTrainingJobId === "string" && project.mlActiveTrainingJobId
                      ? project.mlActiveTrainingJobId
                      : undefined)
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ML Pipeline Onboarding Popup ──────────────── */}
      {showMlOnboarding && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fade-in 0.25s ease",
          }}
          onClick={() => setShowMlOnboarding(false)}
        >
          <div
            style={{
              background: "linear-gradient(170deg, #1A0628 0%, #12031C 100%)",
              border: "1px solid rgba(157,39,222,0.4)",
              borderRadius: 16,
              padding: "36px 40px",
              width: 520,
              maxWidth: "92vw",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(157,39,222,0.1)",
              animation: "slide-up 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "rgba(157,39,222,0.12)",
              border: "1px solid rgba(157,39,222,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B94FF0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F2F2F0", marginBottom: 8 }}>
              Before You Start
            </h2>
            <p style={{ fontSize: 13, color: "rgba(242,242,240,0.55)", lineHeight: 1.65, marginBottom: 20 }}>
              Your data collection format depends on the <strong style={{ color: "#E0D8F0" }}>task type</strong> and <strong style={{ color: "#E0D8F0" }}>model architecture</strong> you choose.
              Please verify these settings are correct before recording any samples.
            </p>

            {/* Current settings summary */}
            <div style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(157,39,222,0.15)",
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {[
                { label: "Board", value: currentBoard.name, color: currentBoard.color },
                { label: "Task Type", value: mlTask.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), color: "#B94FF0" },
                { label: "Architecture", value: ML_ARCHITECTURES[mlArch]?.name || mlArch || "Not selected", color: "#4ade80" },
                { label: "Expected Input", value: ML_ARCHITECTURES[mlArch]?.recommendedInput || "—", color: "#F59E0B" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "rgba(242,242,240,0.4)" }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: row.color, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.color, display: "inline-block", flexShrink: 0 }} />
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11, color: "rgba(242,242,240,0.35)", lineHeight: 1.6, marginBottom: 24 }}>
              You can change the task and architecture from the <strong style={{ color: "rgba(242,242,240,0.5)" }}>Training</strong> tab at any time before starting a training job.
              Collecting data in the wrong format may require re-recording samples.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                id="ml-onboarding-proceed-btn"
                className="btn-primary"
                style={{ padding: "10px 28px", fontSize: 13, fontWeight: 600, borderRadius: 8 }}
                onClick={() => setShowMlOnboarding(false)}
              >
                Got it — Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESP32-CAM Setup Wizard Modal */}
      {showCamWizard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1A0628", border: "1px solid #9D27DE", borderRadius: 8, padding: 24, width: 400, maxWidth: "90%" }}>
            <h2 style={{ color: "#F2F2F0", fontWeight: 700, fontSize: 18, marginBottom: 12 }}>ESP32-CAM Flash Mode</h2>
            <p style={{ color: "rgba(242,242,240,0.7)", fontSize: 13, marginBottom: 20 }}>
              The ESP32-CAM does not have a native USB port or auto-reset circuitry.
              In order to write the new firmware over the FTDI programmer:
            </p>
            <ol style={{ color: "#E0D8F0", fontSize: 13, paddingLeft: 16, lineHeight: 1.6, marginBottom: 24 }}>
              <li>Connect <b>GPIO 0</b> to <b>GND</b></li>
              <li>Press the <b>RST</b> (Reset) button on the board</li>
              <li>Release the <b>RST</b> button</li>
              <li>Click the "Continue Flash" button below</li>
            </ol>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn-ghost" onClick={() => setShowCamWizard(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => performSerialFlash(getBoardConfig("esp32-cam"))}>Continue Flash</button>
            </div>
          </div>
        </div>
      )}

      {showMarketplaceExport && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => !exportingMarketplace && setShowMarketplaceExport(false)}
        >
          <div
            style={{ background: "#12031C", border: "1px solid #9D27DE", borderRadius: 12, padding: 24, width: 520, maxWidth: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, color: "#F2F2F0", marginBottom: 8 }}>Export Compiled Project</h2>
            <p style={{ fontSize: 12, color: "rgba(242,242,240,0.55)", marginBottom: 14 }}>
              This publishes your current workspace project to the community marketplace.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input className="input" placeholder="Marketplace name" value={exportName} onChange={(e) => setExportName(e.target.value)} />
              <select className="input" value={exportCategory} onChange={(e) => setExportCategory(e.target.value)} style={{ cursor: "pointer" }}>
                {MARKETPLACE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input
              className="input"
              placeholder="Functionality (what this block does)"
              value={exportFunctionality}
              onChange={(e) => setExportFunctionality(e.target.value)}
            />
            <textarea
              className="input"
              placeholder="Description for community users"
              value={exportDescription}
              onChange={(e) => setExportDescription(e.target.value)}
              style={{ marginTop: 10, minHeight: 90, resize: "vertical" }}
            />
            <div style={{ marginTop: 12, fontSize: 11, color: "rgba(242,242,240,0.45)" }}>
              Board: {currentBoard.name} · Status: {compileStatus === "success" ? "Compiled" : "Not compiled"}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="btn-secondary" onClick={() => setShowMarketplaceExport(false)} disabled={exportingMarketplace}>Cancel</button>
              <button className="btn-primary" onClick={handleExportToMarketplace} disabled={exportingMarketplace || compileStatus !== "success"}>
                {exportingMarketplace ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Examples Browser Panel */}
      {showExamplesPanel && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fade-in 0.2s ease" }}
          onClick={() => setShowExamplesPanel(false)}
        >
          <div
            style={{ background: "linear-gradient(170deg, #1A0628 0%, #12031C 100%)", border: "1px solid rgba(157,39,222,0.4)", borderRadius: 16, padding: "28px 32px", width: 780, maxWidth: "94vw", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(157,39,222,0.1)", animation: "slide-up 0.3s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#F2F2F0", margin: 0 }}>Example Projects</h2>
                <p style={{ fontSize: 12, color: "rgba(242,242,240,0.45)", marginTop: 4 }}>Load a pre-configured example, compile it, and export to marketplace</p>
              </div>
              <button className="btn-ghost" onClick={() => setShowExamplesPanel(false)} style={{ padding: "6px 10px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingRight: 4 }}>
              {MARKETPLACE_EXAMPLES.map((ex, i) => {
                const boardCfg = getBoardConfig(ex.boardId);
                return (
                  <div
                    key={i}
                    style={{
                      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(157,39,222,0.15)", borderRadius: 10, padding: "14px 16px",
                      display: "flex", flexDirection: "column", gap: 8, transition: "border-color 0.2s, background 0.2s", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(157,39,222,0.5)"; e.currentTarget.style.background = "rgba(157,39,222,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(157,39,222,0.15)"; e.currentTarget.style.background = "rgba(0,0,0,0.3)"; }}
                    onClick={() => loadExample(ex)}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#F2F2F0" }}>{i + 1}. {ex.name}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(157,39,222,0.15)", color: "#B94FF0", fontWeight: 600 }}>{ex.category}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "rgba(242,242,240,0.5)", margin: 0, lineHeight: 1.5 }}>{ex.description}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                      <span style={{ fontSize: 10, color: boardCfg.color, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: boardCfg.color, display: "inline-block" }} />
                        {boardCfg.name}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(157,39,222,0.7)", fontWeight: 600 }}>Click to load →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Variable Prompt Dialog */}
      {promptDialog && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
          onClick={() => { promptDialog.callback(null); setPromptDialog(null); }}
        >
          <div style={{ background: "#12031C", border: "1px solid #9D27DE", borderRadius: 12, padding: 32, width: 400, maxWidth: "90%", boxShadow: "0 24px 50px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: "#F2F2F0", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
              {promptDialog.message}
            </h2>
            <input
              type="text"
              className="input"
              defaultValue={promptDialog.defaultValue}
              style={{ width: "100%", boxSizing: "border-box" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  promptDialog.callback(e.currentTarget.value);
                  setPromptDialog(null);
                } else if (e.key === "Escape") {
                  promptDialog.callback(null);
                  setPromptDialog(null);
                }
              }}
              ref={(input) => {
                if (input) setTimeout(() => input.focus(), 10);
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button className="btn-secondary" onClick={() => { promptDialog.callback(null); setPromptDialog(null); }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={(e) => {
                const val = (e.currentTarget.parentElement?.previousElementSibling as HTMLInputElement).value;
                promptDialog.callback(val);
                setPromptDialog(null);
              }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Bar ───────────────────────────────────── */}
      <footer className="ide-statusbar glass-dark" style={{
        display: "flex", alignItems: "center", padding: "0 16px", gap: 20,
        borderTop: "1px solid rgba(157,39,222,0.1)", fontSize: 10,
        color: "rgba(242,242,240,0.35)",
      }}>
        <span>BitBlock IDE v1.0</span>
        <span>·</span>
        <span style={{ color: currentBoard.color }}>
          ● {currentBoard.name}
        </span>
        <span>·</span>
        <span>{blocklyReady ? "Editor ready" : "Loading editor..."}</span>
        {!flashSupported ? (
          <>
            <span>·</span>
            <span style={{ color: "#F59E0B" }}>⚠ WebSerial not available (use Chrome/Edge)</span>
          </>
        ) : connectedPort ? (
          <>
            <span>·</span>
            <span style={{ color: "#4ade80" }}>USB Device Connected</span>
          </>
        ) : null}
        <span style={{ marginLeft: "auto" }}>
          {saving ? "Saving..." : "All changes saved"}
        </span>
      </footer>
    </div>
  );
}

// ── Syntax highlight (minimal) ────────────────────────────
function CodeHighlight({ code }: { code: string }) {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/(\/\/.*)|("[^"]*")|\b(void|int|float|bool|char|String|const|return|if|else|for|while|do|include|define)\b|\b(setup|loop|Serial|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|millis)\b|\b(\d+)\b/g,
    (match, comment, str, kw1, kw2, num) => {
      if (comment) return `<span style="color:#6B7280">${comment}</span>`;
      if (str) return `<span style="color:#38A169">${str}</span>`;
      if (kw1) return `<span style="color:#9D27DE;font-weight:600">${kw1}</span>`;
      if (kw2) return `<span style="color:#3182CE">${kw2}</span>`;
      if (num) return `<span style="color:#D69E2E">${num}</span>`;
      return match;
    });

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Board info panel ──────────────────────────────────────
function BoardInfo({ boardId }: { boardId: string }) {
  const info = getBoardConfig(boardId);
  const rows = [
    ["CPU / Platform", info.platform], ["Flash", `${info.flash} KB`], ["RAM", `${info.ram} KB`],
    ["PSRAM", `${info.psram} KB`], ["FQBN", info.fqbn],
  ];
  return (
    <div>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: info.color,
        display: "inline-block", marginRight: 8,
        boxShadow: `0 0 8px ${info.color}`,
      }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: info.color }}>{info.name}</span>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "rgba(242,242,240,0.4)" }}>{k}</span>
            <span style={{ fontSize: 11, color: "#F2F2F0", fontFamily: "JetBrains Mono, monospace" }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 10, color: "rgba(242,242,240,0.3)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Features</p>
        {[
          ...(info.wifi ? ["WiFi Enabled"] : []),
          ...(info.ble ? ["BLE Enabled"] : []),
          ...(info.camera ? ["Camera Support"] : []),
          ...(info.mlSupport ? ["Machine Learning Support"] : []),
          ...(info.isAVR ? ["AVR Architecture"] : [])
        ].map((s) => (
          <div key={s} style={{
            fontSize: 11, color: "rgba(242,242,240,0.6)", padding: "4px 0",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: "#9D27DE" }}>✓</span> {s}
          </div>
        ))}
        {info.notes && (
          <div style={{
            marginTop: 12, padding: "8px", background: "rgba(245, 101, 101, 0.1)",
            border: "1px solid rgba(245, 101, 101, 0.2)", borderRadius: "6px",
            fontSize: 10, color: "#FCA5A5"
          }}>
            <span style={{ fontWeight: 600 }}>Note:</span> {info.notes}
          </div>
        )}
      </div>
    </div>
  );
}

