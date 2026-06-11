import { useEffect, useRef } from "react";

interface Planet {
  angle: number;
  orbitRadius: number;
  size: number;
  color: string;
  speed: number;
  glowColor: string;
  ringColor: string;
  hasRing: boolean;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  hue: number;
  baseX: number;
  baseY: number;
}

interface Constellation {
  stars: number[];
  alpha: number;
}

export default function ThreeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetsRef = useRef<Planet[]>([]);
  const starsRef = useRef<Star[]>([]);
  const constellationsRef = useRef<Constellation[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const w = canvas.width;
      const h = canvas.height;
      const minDim = Math.min(w, h);

      // Stars with varied hues - golden, amber, warm white
      starsRef.current = Array.from({ length: 350 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        baseX: Math.random() * w,
        baseY: Math.random() * h,
        size: Math.random() * 2.5 + 0.3,
        alpha: Math.random() * 0.7 + 0.15,
        twinkleSpeed: Math.random() * 0.005 + 0.001,
        hue: 30 + Math.random() * 30, // warm golden tones
      }));

      // Planets with vibrant colors
      planetsRef.current = [
        { angle: 0, orbitRadius: minDim * 0.1, size: 5, color: "#f59e0b", speed: 0.01, glowColor: "rgba(245, 158, 11, 0.4)", ringColor: "rgba(245, 158, 11, 0.15)", hasRing: false },
        { angle: 1.8, orbitRadius: minDim * 0.16, size: 3.5, color: "#f97316", speed: 0.014, glowColor: "rgba(249, 115, 22, 0.35)", ringColor: "rgba(249, 115, 22, 0.12)", hasRing: false },
        { angle: 3.5, orbitRadius: minDim * 0.22, size: 7, color: "#e8f553", speed: 0.007, glowColor: "rgba(232, 245, 83, 0.5)", ringColor: "rgba(232, 245, 83, 0.18)", hasRing: false },
        { angle: 0.7, orbitRadius: minDim * 0.28, size: 4.5, color: "#fb7185", speed: 0.018, glowColor: "rgba(251, 113, 133, 0.35)", ringColor: "rgba(251, 113, 133, 0.12)", hasRing: true },
        { angle: 4.2, orbitRadius: minDim * 0.34, size: 6, color: "#f43f5e", speed: 0.005, glowColor: "rgba(244, 63, 94, 0.4)", ringColor: "rgba(244, 63, 94, 0.15)", hasRing: false },
        { angle: 2.5, orbitRadius: minDim * 0.4, size: 3, color: "#fbbf24", speed: 0.022, glowColor: "rgba(251, 191, 36, 0.3)", ringColor: "rgba(251, 191, 36, 0.1)", hasRing: false },
      ];

      // Constellation lines
      const starCount = starsRef.current.length;
      constellationsRef.current = [];
      for (let i = 0; i < 8; i++) {
        const idx1 = Math.floor(Math.random() * starCount);
        let idx2 = Math.floor(Math.random() * starCount);
        while (Math.abs(idx2 - idx1) < 10) idx2 = Math.floor(Math.random() * starCount);
        constellationsRef.current.push({
          stars: [idx1, idx2],
          alpha: Math.random() * 0.15 + 0.05,
        });
      }
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });

    const animate = (time: number) => {
      if (!canvas || !ctx) return;
      timeRef.current = time;

      // Smooth mouse follow
      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.05;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5 + mx * 12;
      const cy = h * 0.5 + my * 8;

      // ─── Background nebula glow ───
      const nebula1 = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, w * 0.4);
      nebula1.addColorStop(0, "rgba(245, 158, 11, 0.04)");
      nebula1.addColorStop(0.5, "rgba(249, 115, 22, 0.02)");
      nebula1.addColorStop(1, "transparent");
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, w, h);

      const nebula2 = ctx.createRadialGradient(w * 0.8, h * 0.7, 0, w * 0.8, h * 0.7, w * 0.3);
      nebula2.addColorStop(0, "rgba(232, 245, 83, 0.03)");
      nebula2.addColorStop(0.5, "rgba(251, 113, 133, 0.015)");
      nebula2.addColorStop(1, "transparent");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, w, h);

      // ─── Constellation lines ───
      constellationsRef.current.forEach((constellation) => {
        const s1 = starsRef.current[constellation.stars[0] % starsRef.current.length];
        const s2 = starsRef.current[constellation.stars[1] % starsRef.current.length];
        if (!s1 || !s2) return;
        const twinkle = 0.5 + Math.sin(time * 0.0005 + constellation.stars[0]) * 0.5;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.strokeStyle = `hsla(45, 60%, 70%, ${constellation.alpha * twinkle})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // ─── Stars with twinkle ───
      starsRef.current.forEach((star, i) => {
        // Slight parallax for depth
        const parallaxX = mx * star.size * 1.5;
        const parallaxY = my * star.size * 1.5;
        star.x = star.baseX + parallaxX;
        star.y = star.baseY + parallaxY;

        const twinkle = 0.4 + Math.sin(time * star.twinkleSpeed + i * 1.7) * 0.6;

        // Star outer glow
        const glowSize = star.size * 4;
        const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowSize);
        gradient.addColorStop(0, `hsla(${star.hue}, 70%, 75%, ${star.alpha * 0.15 * twinkle})`);
        gradient.addColorStop(1, `hsla(${star.hue}, 70%, 75%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(star.x, star.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Star core
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * (0.7 + twinkle * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 80%, 90%, ${star.alpha * twinkle})`;
        ctx.fill();

        // Star bright center
        if (star.size > 1.2) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(45, 100%, 100%, ${star.alpha * 0.6 * twinkle})`;
          ctx.fill();
        }
      });

      // ─── Central Sun - massive glow layers ───
      for (let i = 0; i < 5; i++) {
        const sunRadius = 60 + i * 50;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius);
        gradient.addColorStop(0, i === 0 ? "rgba(232, 245, 83, 0.35)" : i === 1 ? "rgba(249, 115, 22, 0.2)" : i === 2 ? "rgba(251, 191, 36, 0.1)" : i === 3 ? "rgba(245, 158, 11, 0.05)" : "rgba(232, 245, 83, 0.02)");
        gradient.addColorStop(1, "rgba(232, 245, 83, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sun corona rays
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + time * 0.0003;
        const rayLen = 70 + Math.sin(time * 0.001 + i * 2) * 20;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
        ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
        ctx.strokeStyle = `rgba(232, 245, 83, ${0.06 + Math.sin(time * 0.002 + i) * 0.04})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();

      // Sun core - pulsing
      const corePulse = 1 + Math.sin(time * 0.002) * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, 10 * corePulse, 0, Math.PI * 2);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 * corePulse);
      coreGrad.addColorStop(0, "#fef9c3");
      coreGrad.addColorStop(0.5, "#e8f553");
      coreGrad.addColorStop(1, "#c8d930");
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Sun inner bright dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fill();

      // ─── Orbital rings and planets ───
      planetsRef.current.forEach((planet, idx) => {
        // Orbit path
        ctx.strokeStyle = planet.ringColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, planet.orbitRadius, planet.orbitRadius * 0.55, 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Orbit path glow (faint)
        ctx.beginPath();
        ctx.ellipse(cx, cy, planet.orbitRadius, planet.orbitRadius * 0.55, 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = planet.ringColor.replace("0.15", "0.05").replace("0.12", "0.04").replace("0.18", "0.06").replace("0.1", "0.03");
        ctx.lineWidth = 3;
        ctx.stroke();

        // Update angle
        planet.angle += planet.speed;
        const px = cx + Math.cos(planet.angle) * planet.orbitRadius;
        const py = cy + Math.sin(planet.angle) * planet.orbitRadius * 0.55;

        // Planet glow aura
        const auraSize = planet.size * 4;
        const auraGrad = ctx.createRadialGradient(px, py, 0, px, py, auraSize);
        auraGrad.addColorStop(0, planet.glowColor);
        auraGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(px, py, auraSize, 0, Math.PI * 2);
        ctx.fill();

        // Planet ring (Saturn-like)
        if (planet.hasRing) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(0.3);
          ctx.beginPath();
          ctx.ellipse(0, 0, planet.size * 2.5, planet.size * 0.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = planet.color + "60";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Planet body with pulse
        const pulse = 0.9 + Math.sin(time * 0.003 + planet.angle * 2) * 0.1;
        const planetR = planet.size * pulse;

        // Planet gradient
        const planetGrad = ctx.createRadialGradient(
          px - planetR * 0.3, py - planetR * 0.3, 0,
          px, py, planetR
        );
        planetGrad.addColorStop(0, lightenColor(planet.color, 40));
        planetGrad.addColorStop(0.7, planet.color);
        planetGrad.addColorStop(1, darkenColor(planet.color, 30));
        ctx.beginPath();
        ctx.arc(px, py, planetR, 0, Math.PI * 2);
        ctx.fillStyle = planetGrad;
        ctx.fill();

        // Planet highlight
        ctx.beginPath();
        ctx.arc(px - planetR * 0.25, py - planetR * 0.25, planetR * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (<canvas ref={canvasRef} className="fixed inset-0 -z-10 w-full h-full opacity-100" />);
}

// Helper functions
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
  const b = Math.max(0, (num & 0x0000FF) - percent);
  return `rgb(${r}, ${g}, ${b})`;
}
