import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

/**
 * Hamburger toggle button for mobile nav.
 * Renders nothing on desktop (hidden via CSS).
 * Controls the "nav-open" class on the sibling nav-links container.
 */
export default function MobileMenuButton({
  targetId,
}: {
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Close on resize
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  // Sync class on target element
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (open) {
      el.classList.add("nav-open");
    } else {
      el.classList.remove("nav-open");
    }
  }, [open, targetId]);

  // Close when clicking outside (with small delay to avoid instant close)
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const timer = setTimeout(() => {
      if (!mounted) return;
      const handler = (e: MouseEvent) => {
        const el = document.getElementById(targetId);
        const btn = (e.target as HTMLElement).closest(".mobile-menu-toggle");
        if (!el?.contains(e.target as Node) && !btn) {
          setOpen(false);
        }
      };
      document.addEventListener("click", handler);
      // Save cleanup ref
      cleanupRef = handler;
    }, 100);
    let cleanupRef: ((e: MouseEvent) => void) | null = null;
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (cleanupRef) document.removeEventListener("click", cleanupRef);
    };
  }, [open, targetId]);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  return (
    <button
      className="mobile-menu-toggle"
      onClick={toggle}
      aria-label={open ? "Close menu" : "Open menu"}
    >
      {open ? <X size={22} /> : <Menu size={22} />}
    </button>
  );
}
