import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function SpotlightCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 200, damping: 30 });
  const springY = useSpring(y, { stiffness: 200, damping: 30 });
  const visible = useRef(false);
  const opacity = useMotionValue(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      if (!visible.current) { visible.current = true; opacity.set(1); }
    };
    const leave = () => { visible.current = false; opacity.set(0); };
    window.addEventListener('mousemove', move);
    document.addEventListener('mouseleave', leave);
    return () => { window.removeEventListener('mousemove', move); document.removeEventListener('mouseleave', leave); };
  }, [x, y, opacity]);

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] hidden md:block"
      style={{
        x: springX,
        y: springY,
        opacity,
        width: 400,
        height: 400,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(255, 107, 53, 0.06) 0%, rgba(255, 61, 0, 0.02) 30%, transparent 60%)',
        filter: 'blur(1px)',
      }}
    />
  );
}
