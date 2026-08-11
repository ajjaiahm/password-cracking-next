"use client";

import React, { useEffect, useRef } from 'react';

export function AntigravityBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = -1000;
      mouseRef.current.targetY = -1000;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    class Star {
      x: number;
      y: number;
      z: number;
      pz: number;
      size: number;
      
      constructor() {
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = Math.random() * width;
        this.pz = this.z;
        this.size = Math.random() * 1.5 + 0.5;
      }

      update(speed: number) {
        this.pz = this.z;
        this.z -= speed;
        if (this.z < 1) {
          this.z = width;
          this.x = (Math.random() - 0.5) * width * 2;
          this.y = (Math.random() - 0.5) * height * 2;
          this.pz = this.z;
        }
      }

      draw(c: CanvasRenderingContext2D, cx: number, cy: number) {
        const sx = (this.x / this.z) * width + cx;
        const sy = (this.y / this.z) * height + cy;
        
        const r = Math.max(0, (1 - this.z / width) * this.size * 2);
        
        c.beginPath();
        c.arc(sx, sy, r, 0, Math.PI * 2);
        c.fillStyle = `rgba(255, 255, 255, ${1 - this.z / width})`;
        c.fill();
      }
    }

    const stars: Star[] = Array.from({ length: 150 }, () => new Star());
    
    // Background glow elements
    const glows = [
      { x: 0.2, y: 0.2, color: 'rgba(59, 130, 246, 0.08)', radius: 0.6 },
      { x: 0.8, y: 0.8, color: 'rgba(139, 92, 246, 0.06)', radius: 0.5 },
      { x: 0.5, y: 0.5, color: 'rgba(14, 165, 233, 0.05)', radius: 0.7 }
    ];

    const animate = () => {
      // Smooth mouse interpolation (lerp)
      const dx = mouseRef.current.targetX - mouseRef.current.x;
      const dy = mouseRef.current.targetY - mouseRef.current.y;
      
      if (mouseRef.current.targetX === -1000) {
        mouseRef.current.x += (width/2 - mouseRef.current.x) * 0.05;
        mouseRef.current.y += (height/2 - mouseRef.current.y) * 0.05;
      } else {
        mouseRef.current.x += dx * 0.05;
        mouseRef.current.y += dy * 0.05;
      }

      // Base background color
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle radial glows
      glows.forEach(glow => {
        const gx = width * glow.x;
        const gy = height * glow.y;
        const r = Math.max(width, height) * glow.radius;
        const gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        gradient.addColorStop(0, glow.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });

      // Mouse interactive glow
      if (mouseRef.current.x !== -1000) {
        const mouseGlow = ctx.createRadialGradient(
          mouseRef.current.x, mouseRef.current.y, 0,
          mouseRef.current.x, mouseRef.current.y, 400
        );
        mouseGlow.addColorStop(0, 'rgba(59, 130, 246, 0.06)');
        mouseGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = mouseGlow;
        ctx.fillRect(0, 0, width, height);
      }

      // Parallax center based on mouse position
      const cx = width / 2 - (mouseRef.current.x - width / 2) * 0.05;
      const cy = height / 2 - (mouseRef.current.y - height / 2) * 0.05;

      // Draw stars (warp effect on hover)
      const isHovering = mouseRef.current.targetX !== -1000;
      const speed = isHovering ? 2.5 : 1.0;

      stars.forEach(star => {
        star.update(speed);
        star.draw(ctx, cx, cy);
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 bg-transparent" />;
}
