import { ReactNode, useRef, useCallback, useState } from 'react';
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
  const [hovered, setHovered] = useState(false);

  // 3D tilt
  const rotateX = useSpring(useTransform(my, [0, 1], [4, -4]), { damping: 30, stiffness: 180 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-4, 4]), { damping: 30, stiffness: 180 });

  // Spotlight position
  const spotX = useTransform(mx, (v) => `${v * 100}%`);
  const spotY = useTransform(my, (v) => `${v * 100}%`);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }, [mx, my]);

  const handleLeave = useCallback(() => {
    mx.set(0.5);
    my.set(0.5);
    setHovered(false);
  }, [mx, my]);

  const baseStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.8) 0%, rgba(12, 12, 12, 0.65) 100%)',
    backdropFilter: 'blur(24px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: glow
      ? '0 0 0 1px rgba(255, 107, 53, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.05), inset 0 0 30px 0 rgba(255, 107, 53, 0.03), 0 8px 32px -8px rgba(0, 0, 0, 0.8), 0 0 50px -12px rgba(255, 107, 53, 0.15)'
      : '0 0 0 1px rgba(255, 255, 255, 0.02), inset 0 1px 0 0 rgba(255, 255, 255, 0.04), inset 0 0 20px 0 rgba(255, 255, 255, 0.01), 0 4px 24px -4px rgba(0, 0, 0, 0.7)',
  };

  if (!hover) {
    return (
      <div
        ref={ref}
        className={`relative overflow-hidden group ${className}`}
        style={baseStyle}
        onClick={onClick}
        onMouseMove={handleMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleLeave}
      >
        {/* Top shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
        {/* Bottom subtle accent line */}
        <div className="absolute bottom-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-teal/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        {/* Ambient inner glow on hover */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-[20px]"
          style={{
            background: 'radial-gradient(ellipse at 30% 20%, rgba(255, 107, 53, 0.03) 0%, transparent 60%)',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        />
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
        perspective: '900px',
        transition: 'border-color 0.5s, box-shadow 0.5s',
      }}
      whileHover={{
        borderColor: 'rgba(255, 107, 53, 0.18)',
        boxShadow: '0 0 0 1px rgba(255, 107, 53, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 20px 60px -8px rgba(0, 0, 0, 0.8), 0 0 60px -15px rgba(255, 107, 53, 0.18)',
        y: -4,
      }}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {/* Top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* Interactive spotlight */}
      <motion.div
        className="absolute w-[280px] h-[280px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-600"
        style={{
          left: spotX,
          top: spotY,
          x: '-50%',
          y: '-50%',
          background: 'radial-gradient(circle, rgba(255, 107, 53, 0.1) 0%, rgba(255, 107, 53, 0.04) 40%, transparent 70%)',
        }}
      />

      {/* Edge highlight on hover */}
      <motion.div
        className="absolute inset-0 rounded-[20px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.05) 0%, transparent 50%, rgba(255, 61, 0, 0.03) 100%)',
        }}
      />

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
