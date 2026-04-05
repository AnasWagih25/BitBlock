import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const slides = [
  {
    title: "Visual Coding IDE",
    desc: "150+ professional hardware blocks with a retro-futuristic 8-bit aesthetic. Drag, connect, and build complex firmware in seconds.",
    img: "/demo/ide_overview.png",
    accent: "#9D27DE"
  },
  {
    title: "AI Dataset Lab",
    desc: "Manage datasets, manually crop images to model resolution (96x96), and track cloud training progress in real-time.",
    img: "/demo/ai_lab.png",
    accent: "#3B82F6"
  },
  {
    title: "Cloud Compilation",
    desc: "Fastest cloud build system for ESP32 and Arduino. No toolchains, no local dependencies, just production-ready code.",
    img: "/demo/flash_wizard.png",
    accent: "#10B981"
  },
  {
    title: "Component Marketplace",
    desc: "Discover community-built block extensions for LoRa, GPS, and advanced sensors. Expand your IDE instantly.",
    img: "/demo/marketplace.png",
    accent: "#F59E0B"
  }
];

export default function DemoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((c) => (c + 1) % slides.length);
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} 
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{ 
              position: 'relative', width: '100%', maxWidth: 1000, background: '#0D0018', 
              border: '1px solid rgba(157,39,222,0.2)', borderRadius: 24, overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: 8, borderRadius: '50%', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', height: 600 }}>
              {/* Media Section */}
              <div style={{ background: '#05000A', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={current}
                    src={slides[current].img}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    style={{ width: '90%', height: 'auto', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,1)' }}
                  />
                </AnimatePresence>

                {/* Navigation Arrows */}
                <button onClick={prev} style={{ position: 'absolute', left: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', padding: 12, borderRadius: '50%', cursor: 'pointer' }}>
                  <ChevronLeft size={24} />
                </button>
                <button onClick={next} style={{ position: 'absolute', right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', padding: 12, borderRadius: '50%', cursor: 'pointer' }}>
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* Text Section */}
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, #0D0018 0%, #1A0628 100%)' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                  {slides.map((_, i) => (
                    <div key={i} style={{ width: 30, height: 3, background: i === current ? slides[i].accent : 'rgba(255,255,255,0.1)', borderRadius: 2, transition: '0.3s' }} />
                  ))}
                </div>

                <motion.div
                  key={current + "text"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 style={{ fontSize: 32, fontFamily: 'Superstar, fantasy', color: '#F2F2F0', marginBottom: 16, letterSpacing: '0.05em' }}>
                    {slides[current].title}
                  </h2>
                  <p style={{ fontSize: 16, color: 'rgba(242,242,240,0.6)', lineHeight: 1.6, marginBottom: 32 }}>
                    {slides[current].desc}
                  </p>
                </motion.div>

                <div style={{ marginTop: 'auto', display: 'flex', gap: 12 }}>
                  <Link to="/signup" className="btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
                    Start Building Now
                  </Link>
                  <button onClick={next} className="btn-ghost" style={{ fontSize: 14 }}>
                    Next Feature
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
