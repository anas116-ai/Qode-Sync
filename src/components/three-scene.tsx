import { useEffect, useRef } from "react";

const COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#06b6d4"];

interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  speedZ: number;
  opacity: number;
}

export default function ThreeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    // Mouse tracking
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });

    // Init particles
    const particleCount = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 15000));
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: Math.random() * 2,
      size: 0.5 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speedX: (Math.random() - 0.5) * 0.005,
      speedY: (Math.random() - 0.5) * 0.005,
      speedZ: (Math.random() - 0.5) * 0.003,
      opacity: 0.2 + Math.random() * 0.6,
    }));

    const spheres: { x: number; y: number; size: number; color: string; phase: number; speed: number }[] = [
      { x: -0.4, y: 0.15, size: 120, color: "#6366f1", phase: 0, speed: 0.008 },
      { x: 0.35, y: -0.1, size: 90, color: "#a855f7", phase: 2, speed: 0.01 },
      { x: -0.15, y: -0.3, size: 60, color: "#ec4899", phase: 4, speed: 0.006 },
      { x: 0.5, y: 0.2, size: 75, color: "#06b6d4", phase: 1, speed: 0.009 },
      { x: -0.5, y: -0.15, size: 100, color: "#8b5cf6", phase: 3, speed: 0.007 },
    ];

    const animate = (time: number) => {
      frameRef.current = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;

      // Draw glowing orbs
      spheres.forEach((s) => {
        const x = w * 0.5 + w * 0.4 * (s.x + Math.sin(time * s.speed + s.phase) * 0.1 + mouseRef.current.x * 0.05);
        const y = h * 0.5 + h * 0.4 * (s.y + Math.cos(time * s.speed * 0.7 + s.phase) * 0.1 + mouseRef.current.y * 0.05);
        const size = s.size + Math.sin(time * 0.003 + s.phase) * 10;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, s.color + "60");
        gradient.addColorStop(0.4, s.color + "30");
        gradient.addColorStop(1, s.color + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw torus knots (simplified as rotating rings)
      for (let ring = 0; ring < 2; ring++) {
        const cx = w * 0.5 + mouseRef.current.x * 20;
        const cy = h * 0.5 + mouseRef.current.y * 15;
        const radius = 150 + ring * 60;
        const rotation = time * 0.0004 * (ring + 1);

        ctx.strokeStyle = ring === 0 ? "rgba(99, 102, 241, 0.15)" : "rgba(168, 85, 247, 0.1)";
        ctx.lineWidth = 2;
        ctx.beginPath();

        const segments = 60;
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2 + rotation;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius * 0.6;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Second ring perpendicular
        ctx.strokeStyle = ring === 0 ? "rgba(129, 140, 248, 0.1)" : "rgba(192, 132, 252, 0.08)";
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2 + rotation + 1;
          const x = cx + Math.sin(angle) * radius * 0.6;
          const y = cy + Math.cos(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.speedX + mouseRef.current.x * 0.0003;
        p.y += p.speedY + mouseRef.current.y * 0.0003;
        p.z += p.speedZ;

        const px = w * 0.5 + w * 0.5 * p.x;
        const py = h * 0.5 + h * 0.5 * p.y;
        const size = p.size * (1 + p.z * 0.5);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * (0.5 + Math.sin(time * 0.002 + i) * 0.3);
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-full h-full opacity-80 dark:opacity-100"
    />
  );
}