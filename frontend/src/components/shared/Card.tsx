import { ReactNode, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  glow?: boolean;
}

export default function Card({ children, className = '', hover = false, onClick, glow = false }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  // 3D tilt
  const rotateX = useSpring(useTransform(my, [0, 1], [3, -3]), { damping: 25, stiffness: 150 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-3, 3]), { damping: 25, stiffness: 150 });

  // Spotlight position
  const spotX = useTransform(mx, (v) => `${v * 100}%`);
  const spotY = useTransform(my, (v) => `${v * 100}%`);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!hover || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }, [hover, mx, my]);

  const handleLeave = useCallback(() => {
    mx.set(0.5);
    my.set(0.5);
  }, [mx, my]);

  const baseStyle: React.CSSProperties = {
    background: 'rgba(15, 15, 15, 0.75)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: glow
      ? '0 0 0 1px rgba(255, 107, 53, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 8px 32px -8px rgba(0, 0, 0, 0.8), 0 0 40px -12px rgba(255, 107, 53, 0.12)'
      : '0 0 0 1px rgba(255, 255, 255, 0.02), inset 0 1px 0 0 rgba(255, 255, 255, 0.03), 0 4px 24px -4px rgba(0, 0, 0, 0.7)',
  };

  if (!hover) {
    return (
      <div
        ref={ref}
        className={`relative overflow-hidden group ${className}`}
        style={baseStyle}
        onClick={onClick}
      >
        {/* Top shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={`relative overflow-hidden group cursor-pointer ${className}`}
      style={{
        ...baseStyle,
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: '800px',
        transition: 'border-color 0.4s, box-shadow 0.4s',
      }}
      whileHover={{
        borderColor: 'rgba(255, 107, 53, 0.15)',
        boxShadow: '0 0 0 1px rgba(255, 107, 53, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.04), 0 16px 48px -8px rgba(0, 0, 0, 0.8), 0 0 50px -15px rgba(255, 107, 53, 0.15)',
        y: -3,
      }}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Interactive spotlight */}
      <motion.div
        className="absolute w-[200px] h-[200px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          left: spotX,
          top: spotY,
          x: '-50%',
          y: '-50%',
          background: 'radial-gradient(circle, rgba(255, 107, 53, 0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
