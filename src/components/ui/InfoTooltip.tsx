'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 280;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Clamp to viewport edges
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;

    // Show below the trigger to avoid top clipping
    setCoords({
      top: rect.bottom + 8,
      left,
    });
  }, []);

  const handleShow = useCallback(() => {
    updatePosition();
    setShow(true);
  }, [updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    function handleClick(e: MouseEvent) {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    }
    function handleScroll() { setShow(false); }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [show]);

  const tooltip = show && mounted ? createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 99999,
        width: 280,
        padding: '10px 14px',
        borderRadius: '10px',
        background: '#1f1f1f',
        border: '1px solid #27272a',
        color: '#a1a1aa',
        fontSize: '12px',
        lineHeight: '1.6',
        fontWeight: 400,
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        pointerEvents: 'none' as const,
      }}
    >
      {/* Arrow pointing up */}
      <div style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: '6px solid #1f1f1f',
      }} />
      {text}
    </div>,
    document.body
  ) : null;

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        onMouseEnter={handleShow}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); show ? setShow(false) : handleShow(); }}
        className="inline-flex items-center justify-center rounded-full transition-colors hover:bg-white/10 p-0.5"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Info"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {tooltip}
    </span>
  );
}
