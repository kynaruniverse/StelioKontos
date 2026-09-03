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
    scene.background = new THREE.Color("#050b14");

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // --- Stars background ---
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 500;
    const starsPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starsPositions[i] = (Math.random() - 0.5) * 40;
      starsPositions[i + 1] = (Math.random() - 0.5) * 40;
      starsPositions[i + 2] = (Math.random() - 0.5) * 40;
    }
    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starsPositions, 3)
    );
    const starsMaterial = new THREE.PointsMaterial({
      color: 0x00ffcc,
      size: 0.03,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // --- Hologram Shader Material ---
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vModelPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vModelPosition = position;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform vec3 glowColor;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vModelPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

        float scanline = sin(vModelPosition.y * 30.0 - time * 5.0) * 0.25 + 0.75;
        float flicker = sin(time * 40.0) * cos(time * 20.0) * 0.08 + 0.92;

        float alpha = (fresnel + 0.15) * scanline * flicker;
        vec3 finalColor = glowColor * (fresnel + 0.3);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    const hologramMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        time: { value: 0.0 },
        glowColor: { value: new THREE.Color(0x00ffcc) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // --- Procedural Hand ---
    const handGroup = new THREE.Group();

    // Palm
    const palmGeo = new THREE.CylinderGeometry(1.0, 0.7, 2.0, 32, 16);
    const palm = new THREE.Mesh(palmGeo, hologramMaterial);
    palm.scale.set(1.1, 1.0, 0.4);
    handGroup.add(palm);

    // Helper function for fingers
    const addFinger = (
      x: number,
      y: number,
      z: number,
      len: number,
      rad: number,
      rotZ: number
    ) => {
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(rad * 0.7, rad, len, 16, 8),
        hologramMaterial
      );
      finger.position.set(x, y + len / 2, z);
      finger.rotation.z = rotZ;
      handGroup.add(finger);
      return finger;
    };

    // Create fingers
    const fingers = [
      addFinger(-0.9, 0.4, 0.0, 1.2, 0.16, -0.2), // Index
      addFinger(-0.3, 0.8, 0.0, 1.4, 0.16, -0.05), // Middle
      addFinger(0.3, 0.7, 0.0, 1.3, 0.15, 0.05), // Ring
      addFinger(0.8, 0.3, 0.0, 1.0, 0.13, 0.2), // Pinky
      addFinger(0.9, -0.5, 0.1, 0.9, 0.18, 0.7), // Thumb
    ];

    scene.add(handGroup);
    handGroup.position.y = -0.5;

    // --- Animation ---
    const clock = new THREE.Clock();
    const startTime = performance.now();
    const totalSplashTime = 11000;

    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

    const fadeOut = () => {
      if (fadeRef.current) {
        fadeRef.current.classList.add("splash-fade-out");
      }
      fadeOutTimer = setTimeout(() => {
        onComplete();
      }, 1000);
    };

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const splashElapsed = performance.now() - startTime;

      if (splashElapsed >= totalSplashTime) {
        if (!completed) {
          completed = true;
          fadeOut();
        }
        return;
      }

      // Update shader time
      hologramMaterial.uniforms.time.value = elapsed;

      // Holographic rotation and floating
      handGroup.rotation.y = elapsed * 0.5;
      handGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.1;
      handGroup.position.y = -0.5 + Math.sin(elapsed * 2.0) * 0.15;

      // Subtle wave motion for fingers
      fingers.forEach((finger, index) => {
        const phase = index * 0.4;
        finger.rotation.z += Math.sin(elapsed * 2.0 + phase) * 0.02;
      });

      // Rotate stars
      stars.rotation.y += 0.0005;

      // Slow camera orbit
      const camAngle = elapsed * 0.15;
      camera.position.x = Math.sin(camAngle) * 2;
      camera.position.z = 6 + Math.cos(camAngle) * 1;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    skipRef.current?.focus();

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
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Points ||
          obj instanceof THREE.Line
        ) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
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
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#050b14",
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div
        className="splash-overlay"
        style={{
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          color: "#f5edd9",
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.1em",
        }}
      >
        <div
          className="splash-progress-bar"
          style={{
            width: "200px",
            height: "4px",
            background: "rgba(255,255,255,0.2)",
            margin: "0 auto 10px",
          }}
        >
          <div
            className="splash-progress-fill"
            style={{
              width: "0%",
              height: "100%",
              background: "#00ffcc",
              animation: "splash-progress 11s linear forwards",
            }}
          />
        </div>
        <p style={{ fontSize: "12px", textTransform: "uppercase" }}>
          Loading World…
        </p>
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
          textTransform: "uppercase",
          cursor: "pointer",
          transition: "background 0.3s",
        }}
        onClick={() => {
          if (!completed) {
            completed = true;
            fadeOut();
          }
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
        }
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