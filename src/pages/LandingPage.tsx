import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Zap, Puzzle, CloudLightning, Usb, Cpu, Globe, CheckCircle2, ChevronRight } from "lucide-react";
import MobileMenuButton from "../components/ui/MobileMenuButton";

const features = [
  {
    icon: <Puzzle size={28} color="#B94FF0" />,
    title: "Visual Block Editor",
    desc: "Drag, drop, and snap blocks together to build complex logic. If you can build a puzzle, you can program hardware.",
  },
  {
    icon: <Zap size={28} color="#B94FF0" />,
    title: "Zero Setup Required",
    desc: "No drivers to install, no libraries to configure, no IDEs to download. Everything runs directly in your browser.",
  },
  {
    icon: <CloudLightning size={28} color="#B94FF0" />,
    title: "Cloud Compilation",
    desc: "We compile your firmware instantly on powerful cloud servers, translating your blocks into highly optimized C++ code.",
  },
  {
    icon: <Usb size={28} color="#B94FF0" />,
    title: "1-Click Flashing",
    desc: "Connect your board via USB and flash it directly from the browser using WebSerial API. No external tools needed.",
  },
  {
    icon: <Cpu size={28} color="#B94FF0" />,
    title: "Edge AI Built-in",
    desc: "Collect data, train machine learning models, and deploy them to your microcontroller without writing any Python.",
  },
  {
    icon: <Globe size={28} color="#B94FF0" />,
    title: "Community Marketplace (Soon)",
    desc: "Need a block for a specific sensor? Download community-built extensions instantly from our integrated marketplace. Launching in Q3.",
  },
];

export default function LandingPage() {
  const { isBetaMode } = useAuth();
  
  return (
    <div data-page="landing" style={{ background: "#0A0A0A", minHeight: "100vh", fontFamily: "Space Grotesk, sans-serif" }}>

      {/* Nav */}
      <nav className="glass-dark" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 40px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(157,39,222,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "Superstar, fantasy", fontSize: 28, color: "#9D27DE", letterSpacing: "0.08em" }}>
            BIT<span style={{ color: "#F2F2F0" }}>BLOCK</span>
          </span>
          <span className="badge badge-purple" style={{ marginLeft: 4 }}>BETA</span>
          <MobileMenuButton targetId="landing-nav-links" />
        </div>
        <div id="landing-nav-links" className="nav-links" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isBetaMode && <Link to="/pricing" className="btn-ghost">Pricing</Link>}
          <Link to="/login" className="btn-ghost">Log In</Link>
          <Link to="/signup" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13 }}>
            {isBetaMode ? "Join the Beta" : "Get Started Free"}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="grid-bg hero-section" style={{
        padding: "160px 40px 80px",
        position: "relative",
        overflow: "hidden",
        textAlign: "center"
      }}>
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(157,39,222,0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>
          <div className="badge badge-purple animate-slide-up" style={{ marginBottom: 24, padding: "8px 16px", fontSize: 13 }}>
            🚀 The easiest way to program microcontrollers
          </div>
          <h1 className="animate-slide-up" style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(40px, 6vw, 72px)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginBottom: 24,
            color: "#F2F2F0",
            animationDelay: "0.1s"
          }}>
            Program Hardware.<br />
            <span className="gradient-text">Without Writing Code.</span>
          </h1>
          <p className="animate-slide-up" style={{
            fontSize: "clamp(16px, 2vw, 20px)", 
            lineHeight: 1.6,
            color: "rgba(242,242,240,0.65)",
            marginBottom: 40, maxWidth: 650, margin: "0 auto 40px",
            animationDelay: "0.2s"
          }}>
            Stop fighting with C++ pointers, missing libraries, and broken toolchains. BitBlock is a visual programming platform that lets anyone build complex device firmware in minutes directly from the browser.
          </p>
          <div className="hero-cta animate-slide-up" style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.3s" }}>
            <Link to="/signup" className="btn-primary" style={{ fontSize: 16, padding: "16px 36px" }}>
              {isBetaMode ? "Start Building for Free" : "Start Building Free"}
            </Link>
          </div>
          <p className="animate-slide-up" style={{ marginTop: 16, fontSize: 13, color: "rgba(242,242,240,0.4)", animationDelay: "0.4s" }}>
            Works with ESP32, Arduino, and ESP8266. No credit card required.
          </p>
        </div>

        {/* Hero Image / App Preview */}
        <div className="animate-slide-up" style={{
          marginTop: 80,
          position: "relative",
          zIndex: 10,
          maxWidth: 1000,
          margin: "80px auto 0",
          animationDelay: "0.5s",
          perspective: 1000
        }}>
          <div style={{
            background: "#0A0A0A",
            border: "1px solid rgba(157,39,222,0.3)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(157,39,222,0.2)",
            transform: "rotateX(2deg)",
          }}>
             {/* Simple mock header of IDE */}
            <div style={{ height: 40, background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
               <div style={{width: 10, height: 10, borderRadius: "50%", background: "#EF4444"}} />
               <div style={{width: 10, height: 10, borderRadius: "50%", background: "#F59E0B"}} />
               <div style={{width: 10, height: 10, borderRadius: "50%", background: "#22C55E"}} />
               <span style={{fontSize: 12, color: "#888", marginLeft: 12, fontFamily: "monospace"}}>bitblock.lol</span>
            </div>
            <img src="/demo/ide_overview.png" alt="BitBlock Visual Editor" style={{ width: "100%", display: "block" }} />
          </div>
        </div>
      </section>

      {/* Edge ML Section */}
      <section style={{ padding: "100px 40px", background: "linear-gradient(180deg, #0A0A0A 0%, rgba(157,39,222,0.05) 100%)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="badge badge-purple" style={{ marginBottom: 16 }}>TinyML Built-In</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, color: "#F2F2F0", marginBottom: 16 }}>
              Train AI models for the edge. <br /><span className="gradient-text">Without Python.</span>
            </h2>
            <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 18, maxWidth: 650, margin: "0 auto" }}>
              Our integrated Machine Learning pipeline lets you collect data from sensors, train neural networks in the cloud, and deploy them to your microcontroller as a single visual block.
            </p>
          </div>

          <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap", flexDirection: "row-reverse" }}>
             <div style={{ flex: "1 1 400px" }}>
                <ul style={{ display: "flex", flexDirection: "column", gap: 24, padding: 0, listStyle: "none" }}>
                  <li>
                    <h4 style={{ color: "#F2F2F0", fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(157,39,222,0.1)", color: "#9D27DE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>1</span>
                      Live Data Collection
                    </h4>
                    <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 15, paddingLeft: 44, margin: 0, lineHeight: 1.5 }}>Stream raw accelerometer or sensor data directly from your board into our browser-based data labeling tool.</p>
                  </li>
                  <li>
                    <h4 style={{ color: "#F2F2F0", fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(157,39,222,0.1)", color: "#9D27DE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>2</span>
                      Cloud Training
                    </h4>
                    <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 15, paddingLeft: 44, margin: 0, lineHeight: 1.5 }}>We handle the TensorFlow logic. Just choose your architecture, click train, and let our cloud compute nodes build your model.</p>
                  </li>
                  <li>
                    <h4 style={{ color: "#F2F2F0", fontSize: 18, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(157,39,222,0.1)", color: "#9D27DE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>3</span>
                      Instant Inference
                    </h4>
                    <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 15, paddingLeft: 44, margin: 0, lineHeight: 1.5 }}>The trained model is automatically quantized and converted into a custom visual block. Snap it into your workspace and run offline inference.</p>
                  </li>
                </ul>
             </div>
             <div style={{ flex: "1 1 400px", background: "#0A0A0A", borderRadius: 16, border: "1px solid rgba(157,39,222,0.3)", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
               <div style={{ height: 40, background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
                  <div style={{width: 10, height: 10, borderRadius: "50%", background: "#EF4444"}} />
                  <div style={{width: 10, height: 10, borderRadius: "50%", background: "#F59E0B"}} />
                  <div style={{width: 10, height: 10, borderRadius: "50%", background: "#22C55E"}} />
                  <span style={{fontSize: 12, color: "#888", marginLeft: 12, fontFamily: "monospace"}}>bitblock.lol</span>
               </div>
               <img src="/demo/ai_lab.png" alt="ML Pipeline" style={{ width: "100%", display: "block" }} />
             </div>
          </div>
        </div>
      </section>

      {/* The Problem / Solution Section */}
      <section style={{ padding: "100px 40px", background: "rgba(157,39,222,0.03)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, color: "#F2F2F0", marginBottom: 16 }}>
              Hardware is hard. <span className="gradient-text">We made it easy.</span>
            </h2>
            <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 18, maxWidth: 600, margin: "0 auto" }}>
              Traditional embedded development takes hours of setup before you can blink an LED. We've removed all the friction.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32 }}>
            <div className="card" style={{ background: "rgba(239, 68, 68, 0.05)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
              <div style={{ color: "#EF4444", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>The Old Way</div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 12, color: "rgba(242,242,240,0.6)", padding: 0, listStyle: "none" }}>
                <li style={{ display: "flex", gap: 8 }}><span style={{ color: "#EF4444" }}>✕</span> Download gigabytes of IDEs</li>
                <li style={{ display: "flex", gap: 8 }}><span style={{ color: "#EF4444" }}>✕</span> Hunt down USB drivers</li>
                <li style={{ display: "flex", gap: 8 }}><span style={{ color: "#EF4444" }}>✕</span> Struggle with C++ syntax errors</li>
                <li style={{ display: "flex", gap: 8 }}><span style={{ color: "#EF4444" }}>✕</span> Spend hours finding the right libraries</li>
              </ul>
            </div>
            <div className="card" style={{ background: "rgba(157, 39, 222, 0.05)", borderColor: "rgba(157, 39, 222, 0.4)", boxShadow: "0 0 20px rgba(157,39,222,0.1)" }}>
               <div style={{ color: "#9D27DE", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>The BitBlock Way</div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 12, color: "#F2F2F0", padding: 0, listStyle: "none" }}>
                <li style={{ display: "flex", gap: 8 }}><CheckCircle2 size={20} color="#9D27DE" /> Open browser</li>
                <li style={{ display: "flex", gap: 8 }}><CheckCircle2 size={20} color="#9D27DE" /> Snap visual blocks together</li>
                <li style={{ display: "flex", gap: 8 }}><CheckCircle2 size={20} color="#9D27DE" /> Click "Compile & Flash"</li>
                <li style={{ display: "flex", gap: 8 }}><CheckCircle2 size={20} color="#9D27DE" /> Hardware running instantly</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works visuals */}
      <section style={{ padding: "100px 40px" }}>
         <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <h2 style={{ textAlign: "center", fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, marginBottom: 60 }}>Build hardware in 3 simple steps</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>
               {/* Step 1 */}
               <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 400px" }}>
                     <div style={{ color: "#9D27DE", fontWeight: 800, fontSize: 64, lineHeight: 1, opacity: 0.5, marginBottom: 16 }}>1</div>
                     <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Design visually with blocks</h3>
                     <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 16, lineHeight: 1.6 }}>Choose from over 150+ pre-built logic and hardware blocks. Read sensors, control motors, and build complex state machines without writing a single line of syntax.</p>
                  </div>
                  <div style={{ flex: "1 1 400px", background: "#0A0A0A", borderRadius: 16, border: "1px solid rgba(157,39,222,0.3)", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                    <div style={{ height: 40, background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#EF4444"}} />
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#F59E0B"}} />
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#22C55E"}} />
                       <span style={{fontSize: 12, color: "#888", marginLeft: 12, fontFamily: "monospace"}}>bitblock.lol</span>
                    </div>
                    <img src="/demo/ide_overview.png" alt="Blocks" style={{ width: "100%", display: "block" }} />
                  </div>
               </div>

               {/* Step 2 */}
               <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap", flexDirection: "row-reverse" }}>
                  <div style={{ flex: "1 1 400px" }}>
                     <div style={{ color: "#9D27DE", fontWeight: 800, fontSize: 64, lineHeight: 1, opacity: 0.5, marginBottom: 16 }}>2</div>
                     <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Cloud compile instantly</h3>
                     <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 16, lineHeight: 1.6 }}>Our cloud infrastructure takes your visual blocks, generates optimized C++ code, and compiles it for your specific board architecture in seconds. No local toolchains required.</p>
                  </div>
                  <div style={{ flex: "1 1 400px", background: "#0A0A0A", borderRadius: 16, border: "1px solid rgba(157,39,222,0.3)", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                    <div style={{ height: 40, background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#EF4444"}} />
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#F59E0B"}} />
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#22C55E"}} />
                       <span style={{fontSize: 12, color: "#888", marginLeft: 12, fontFamily: "monospace"}}>bitblock.lol</span>
                    </div>
                    <img src="/demo/compile.png" alt="Cloud Compile" style={{ width: "100%", display: "block" }} />
                  </div>
               </div>

               {/* Step 3 */}
               <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 400px" }}>
                     <div style={{ color: "#9D27DE", fontWeight: 800, fontSize: 64, lineHeight: 1, opacity: 0.5, marginBottom: 16 }}>3</div>
                     <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Flash directly from Chrome</h3>
                     <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 16, lineHeight: 1.6 }}>Plug your ESP32 or Arduino into your computer's USB port. BitBlock uses the secure WebSerial API to flash the firmware directly from the browser window. It just works.</p>
                  </div>
                  <div style={{ flex: "1 1 400px", background: "#0A0A0A", borderRadius: 16, border: "1px solid rgba(157,39,222,0.3)", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                    <div style={{ height: 40, background: "#111", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8 }}>
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#EF4444"}} />
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#F59E0B"}} />
                       <div style={{width: 10, height: 10, borderRadius: "50%", background: "#22C55E"}} />
                       <span style={{fontSize: 12, color: "#888", marginLeft: 12, fontFamily: "monospace"}}>bitblock.lol</span>
                    </div>
                    <img src="/demo/flash_wizard.png" alt="Flash Wizard" style={{ width: "100%", display: "block" }} />
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* Testimonial Section */}
      <section style={{ padding: "80px 40px", background: "#0A0A0A" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 48, color: "#9D27DE", marginBottom: -20, fontFamily: "serif" }}>"</div>
          <p style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 500, color: "#F2F2F0", lineHeight: 1.5, marginBottom: 24 }}>
            I used to spend 3 hours just setting up my C++ environment and fighting driver errors. With BitBlock, I had a working gesture-recognition glove built and flashed in 20 minutes.
          </p>
          <div style={{ fontSize: 16, color: "rgba(242,242,240,0.6)", fontWeight: 600 }}>
            &mdash; Marawan T., Engineering Student
          </div>
        </div>
      </section>

      {/* Edge Impulse Comparison Section */}
      <section style={{ padding: "100px 40px", background: "linear-gradient(180deg, rgba(157,39,222,0.04) 0%, #0A0A0A 100%)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="badge badge-purple" style={{ marginBottom: 16 }}>Switching from Edge Impulse?</div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, color: "#F2F2F0", marginBottom: 16 }}>
              Same goal. <span className="gradient-text">Radically simpler path.</span>
            </h2>
            <p style={{ color: "rgba(242,242,240,0.6)", fontSize: 18, maxWidth: 700, margin: "0 auto" }}>
              Edge Impulse was acquired by Qualcomm and is pivoting toward enterprise industrial IoT. If you're a maker, student, or startup — you're no longer their priority. We built BitBlock for you.
            </p>
          </div>

          {/* Comparison Table */}
          <div style={{ borderRadius: 16, border: "1px solid rgba(157,39,222,0.2)", overflow: "hidden", background: "#0A0A0A" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#111", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ padding: "16px 20px", fontSize: 13, color: "rgba(242,242,240,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}></div>
              <div style={{ padding: "16px 20px", fontSize: 13, color: "rgba(242,242,240,0.5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Edge Impulse</div>
              <div style={{ padding: "16px 20px", fontSize: 13, color: "#9D27DE", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>BitBlock</div>
            </div>

            {[
              { label: "Setup Required", ei: "Install Node.js CLI tools, serial daemon, data forwarder packages", bb: "Open Chrome. That's it.", bbWin: true },
              { label: "Data Collection", ei: "Run edge-impulse-data-forwarder from terminal, configure serial manually", bb: "Click \"Collect\" — WebSerial streams sensor data directly in the browser", bbWin: true },
              { label: "Model Deployment", ei: "Download a ZIP file, extract C++ library, manually integrate into Arduino/PlatformIO project", bb: "Model auto-compiles into firmware and flashes via WebSerial in one click", bbWin: true },
              { label: "Inference Code", ei: "Write C++ tensor allocation, input normalization, and output parsing yourself", bb: "Drag a visual block into your workspace. Zero code.", bbWin: true },
              { label: "Free Tier Limits", ei: "3 private projects, 10 experiments, no GPU, no RAM-optimized compiler", bb: "Unlimited projects during beta. No paywalls on any ML feature.", bbWin: true },
              { label: "Architectures", ei: "Generic pipelines — you configure DSP blocks, learning blocks, impulse design manually", bb: "12 pre-tuned architectures across 8 task types with auto-optimization for your specific board", bbWin: true },
              { label: "Training Feedback", ei: "Train, wait, see final accuracy. Limited experiment tracking on free tier.", bb: "Live epoch-by-epoch loss/accuracy, per-class F1, confusion matrix, hard-example identification", bbWin: true },
              { label: "Production License", ei: "Enterprise subscription required for >1000 units. Contact sales for pricing.", bb: "Open source firmware output. Deploy wherever you want.", bbWin: true },
            ].map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ padding: "16px 20px", fontSize: 13, color: "#F2F2F0", fontWeight: 600, display: "flex", alignItems: "center" }}>{row.label}</div>
                <div style={{ padding: "16px 20px", fontSize: 13, color: "rgba(242,242,240,0.4)", lineHeight: 1.5, display: "flex", alignItems: "center", borderLeft: "1px solid rgba(255,255,255,0.05)", borderRight: "1px solid rgba(255,255,255,0.05)" }}>{row.ei}</div>
                <div style={{ padding: "16px 20px", fontSize: 13, color: row.bbWin ? "#F2F2F0" : "rgba(242,242,240,0.4)", lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8, background: row.bbWin ? "rgba(157,39,222,0.05)" : "transparent" }}>
                  {row.bbWin && <CheckCircle2 size={14} color="#9D27DE" style={{flexShrink: 0}} />}
                  {row.bb}
                </div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: "rgba(242,242,240,0.4)", fontStyle: "italic" }}>
            Comparison based on Edge Impulse Developer (free) plan as of May 2026. Enterprise features require contacting their sales team.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section" style={{ padding: "80px 40px", background: "#0D0018", borderTop: "1px solid rgba(157,39,222,0.1)", borderBottom: "1px solid rgba(157,39,222,0.1)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 36px)", fontWeight: 700, color: "#F2F2F0", marginBottom: 16 }}>
              Everything you need to build the future
            </h2>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{ cursor: "default", background: "rgba(10,10,10,0.5)" }}>
                <div style={{ marginBottom: 20, width: 56, height: 56, borderRadius: 16, background: "rgba(157,39,222,0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(157,39,222,0.2)" }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F2F2F0", marginBottom: 12 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(242,242,240,0.55)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-section" style={{ padding: "100px 40px" }}>
        <div className="cta-card" style={{
          maxWidth: 900, margin: "0 auto",
          background: "linear-gradient(135deg, rgba(157,39,222,0.2), rgba(42,10,61,0.9))",
          border: "1px solid rgba(157,39,222,0.4)",
          borderRadius: 24, padding: "80px 40px",
          textAlign: "center",
          position: "relative", overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(157,39,222,0.2) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, color: "#F2F2F0", marginBottom: 20 }}>
              Ready to start building?
            </h2>
            <p style={{ color: "rgba(242,242,240,0.7)", fontSize: 18, marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
              Join 200+ makers and students already building with BitBlock. It takes 30 seconds to sign up.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <Link to="/signup" className="btn-primary" style={{ fontSize: 18, padding: "16px 40px" }}>
                {isBetaMode ? "Create Free Account" : "Start Building for Free"} <ChevronRight size={20} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "40px",
        borderTop: "1px solid rgba(157,39,222,0.1)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 24,
      }}>
        <div>
           <span style={{ fontFamily: "Superstar, fantasy", fontSize: 20, color: "#9D27DE" }}>BITBLOCK</span>
           <div style={{ fontSize: 13, color: "rgba(242,242,240,0.4)", marginTop: 8 }}>The visual programming language for hardware.</div>
        </div>
        <div className="footer-links" style={{ display: "flex", gap: 32 }}>
          {[
            { label: "Pricing", to: "/pricing" },
            { label: "Marketplace", to: "/marketplace" },
            { label: "Privacy Policy", to: "/privacy" },
            { label: "Terms", to: "/terms" },
            { label: "GitHub", href: "https://github.com/AnasWagih25/BitBlock" }
          ].map((l) => (
            l.to ? (
              <Link key={l.label} to={l.to} style={{ color: "rgba(242,242,240,0.6)", fontSize: 14, textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.6)")}>
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} style={{ color: "rgba(242,242,240,0.6)", fontSize: 14, textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#F2F2F0")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,240,0.6)")}>
                {l.label}
              </a>
            )
          ))}
        </div>
      </footer>
    </div>
  );
}
