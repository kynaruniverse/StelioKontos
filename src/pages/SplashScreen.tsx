import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
  
    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111327");
  
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 20);
  
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);
  
    // --- Lights ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 5, 10);
    scene.add(directional);
    const pointLight = new THREE.PointLight(0xf25d4d, 1, 30);
    pointLight.position.set(-5, 0, 5);
    scene.add(pointLight);
  
    // --- Stars background ---
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 800;
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starsPositions[i] = (Math.random() - 0.5) * 50;
      starsPositions[i + 1] = (Math.random() - 0.5) * 50;
      starsPositions[i + 2] = (Math.random() - 0.5) * 50;
    }
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starsPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xf5edd9, size: 0.05, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
  
    // --- Grid floor ---
    const gridHelper = new THREE.GridHelper(20, 20, 0xf5d34f, 0x3152c9);
    gridHelper.position.y = -5;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
  
    // --- Prepare wordmark canvas but wait for fonts before sampling ---
    const text = "SIDEQUEST";
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
  
    let animationFrame: number | null = null;
    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  
    const startAnimation = () => {
      // Draw text after fonts are ready
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "Bold 160px 'Space Grotesk', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const targetPositions: THREE.Vector3[] = [];
      const samplingStep = 6;
      const scale = 0.02;
  
      for (let y = 0; y < canvas.height; y += samplingStep) {
        for (let x = 0; x < canvas.width; x += samplingStep) {
          const alpha = imageData[(y * canvas.width + x) * 4 + 3];
          if (alpha > 128) {
            const wx = (x - canvas.width / 2) * scale;
            const wy = -(y - canvas.height / 2) * scale;
            targetPositions.push(new THREE.Vector3(wx, wy, 0));
          }
        }
      }
  
      const geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0xf5edd9, roughness: 0.3, metalness: 0.2, emissive: 0x222222 }),
        new THREE.MeshStandardMaterial({ color: 0xf25d4d, roughness: 0.3, metalness: 0.2, emissive: 0x330000 }),
        new THREE.MeshStandardMaterial({ color: 0xf5d34f, roughness: 0.3, metalness: 0.2, emissive: 0x332200 }),
        new THREE.MeshStandardMaterial({ color: 0x3152c9, roughness: 0.3, metalness: 0.2, emissive: 0x001133 }),
      ];
  
      const particles: THREE.Mesh[] = [];
      const initialPositions: THREE.Vector3[] = [];
      const initialRotations: THREE.Euler[] = [];
  
      for (let i = 0; i < targetPositions.length; i++) {
        const mesh = new THREE.Mesh(geometry, materials[Math.floor(Math.random() * materials.length)]);
        const radius = 8;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = radius * Math.cbrt(Math.random());
        const ix = r * Math.sin(phi) * Math.cos(theta);
        const iy = r * Math.sin(phi) * Math.sin(theta);
        const iz = r * Math.cos(phi);
        mesh.position.set(ix, iy, iz);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.scale.setScalar(0.5 + Math.random() * 0.5);
        particles.push(mesh);
        initialPositions.push(mesh.position.clone());
        initialRotations.push(mesh.rotation.clone());
        scene.add(mesh);
      }
  
      const startTime = performance.now();
      const assembleDuration = 8000;
      const holdDuration = 5000;
      const totalDuration = assembleDuration + holdDuration;
      const totalSplashTime = 15000;
  
      const animate = (now: number) => {
        const elapsed = now - startTime;
  
        if (elapsed >= totalSplashTime) {
          if (!completed) {
            completed = true;
            fadeOut();
          }
          return;
        }
  
        const progress = Math.min(elapsed / assembleDuration, 1);
        const eased = easeOutBack(progress);
  
        particles.forEach((particle, i) => {
          const target = targetPositions[i];
          if (!target) return;
          const init = initialPositions[i];
          particle.position.x = init.x + (target.x - init.x) * eased;
          particle.position.y = init.y + (target.y - init.y) * eased;
          particle.position.z = init.z + (target.z - init.z) * eased;
  
          const initRot = initialRotations[i];
          particle.rotation.x = initRot.x * (1 - eased);
          particle.rotation.y = initRot.y * (1 - eased);
          particle.rotation.z = initRot.z * (1 - eased);
  
          particle.scale.setScalar(0.5 + eased * 0.5);
        });
  
        if (progress >= 1 && elapsed < totalDuration) {
          const holdProgress = (elapsed - assembleDuration) / holdDuration;
          const pulse = 1 + Math.sin(holdProgress * Math.PI * 2) * 0.03;
          particles.forEach((p) => p.scale.setScalar(1 * pulse));
        }
  
        const camAngle = (elapsed / totalSplashTime) * 0.2;
        camera.position.x = Math.sin(camAngle) * 5;
        camera.position.z = 20 + Math.cos(camAngle) * 2;
        camera.lookAt(0, 0, 0);
  
        stars.rotation.y += 0.0002;
  
        renderer.render(scene, camera);
      };
  
      renderer.setAnimationLoop(animate);
    };
  
    const fadeOut = () => {
      if (fadeRef.current) {
        fadeRef.current.classList.add("splash-fade-out");
      }
      fadeOutTimer = setTimeout(() => {
        onComplete();
      }, 1000);
    };
  
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
  
    skipRef.current?.focus();
  
    // Wait for fonts, then start the animation
    document.fonts.ready.then(startAnimation);
  
    // Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", handleResize);
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
    };
  }, [onComplete]);

  return (
    <div
      ref={fadeRef}
      className="splash-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Loading Sidequest world"
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "#111327" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div className="splash-overlay" style={{
        position: "absolute",
        bottom: "10%",
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
        color: "#f5edd9",
        fontFamily: "'Space Mono', monospace",
        letterSpacing: "0.1em",
      }}>
        <div className="splash-progress-bar" style={{ width: "200px", height: "4px", background: "rgba(255,255,255,0.2)", margin: "0 auto 10px" }}>
          <div className="splash-progress-fill" style={{ width: "0%", height: "100%", background: "#f5d34f", animation: "splash-progress 15s linear forwards" }} />
        </div>
        <p style={{ fontSize: "12px", textTransform: "uppercase" }}>Loading World…</p>
      </div>
      <button
        ref={skipRef}
        className="splash-skip-button"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#f5edd9",
          padding: "8px 16px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform:  "uppercase",
          cursor: "pointer",
          transition: "background 0.3s",
        }}
        onClick={() => {
          if (!completed) {
            completed = true;
            fadeOut();
          }
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
      >
        Skip
      </button>
      <style>{`
        @keyframes splash-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .splash-screen {
          transition: opacity 1s ease, visibility 1s ease;
          opacity: 1;
          visibility: visible;
        }
        .splash-screen.splash-fade-out {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;