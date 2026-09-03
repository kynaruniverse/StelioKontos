import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
    camera.position.set(0, 1.5, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // --- Hologram Shader Material (with skinning support) ---
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;

      #include <skinning_pars_vertex>

      void main() {
        #include <skinbase_vertex>
        #include <skinning_vertex>

        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vViewPosition = -mvPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      uniform vec3 glowColor;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        float scanline = sin(vWorldPosition.y * 15.0 - time * 5.0) * 0.25 + 0.75;
        float flicker = sin(time * 40.0) * cos(time * 20.0) * 0.05 + 0.95;
        float alpha = (fresnel + 0.15) * scanline * flicker;
        vec3 finalColor = glowColor * (fresnel + 0.3);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    const hologramMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
        glowColor: { value: new THREE.Color(0x00ffcc) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      skinning: true, // Enable skinning for the rigged hand
    });

    // --- Stars background ---
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 600;
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

    // --- Projection Pod ---
    const podGroup = new THREE.Group();
    podGroup.position.y = -3;

    const podBaseGeo = new THREE.CylinderGeometry(1.5, 1.7, 0.2, 32);
    const podBase = new THREE.Mesh(podBaseGeo, hologramMaterial);
    podGroup.add(podBase);

    const createGridRing = (radius: number, segments: number) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.02, radius, segments);
      const ring = new THREE.Mesh(ringGeo, hologramMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.11;
      return ring;
    };

    const innerRing = createGridRing(0.6, 32);
    const middleRing = createGridRing(1.0, 48);
    const outerRing = createGridRing(1.4, 64);
    podGroup.add(innerRing, middleRing, outerRing);

    scene.add(podGroup);

    // --- Volumetric Light Beam ---
    const beamMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying float vHeight;
        void main() {
          vUv = uv;
          vHeight = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float time;
        varying vec2 vUv;
        varying float vHeight;
        void main() {
          float horizontalGlow = sin(vUv.x * 3.14159);
          float verticalFade = 1.0 - (vHeight + 1.5) / 3.5;
          float upwardPulse = sin(vHeight * 4.0 - time * 8.0) * 0.15 + 0.85;
          float alpha = horizontalGlow * verticalFade * upwardPulse * 0.3;
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      uniforms: {
        time: { value: 0.0 },
        glowColor: { value: new THREE.Color(0x00ffcc) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const beamGeo = new THREE.CylinderGeometry(1.2, 0.4, 3.5, 32, 1, true);
    const lightBeam = new THREE.Mesh(beamGeo, beamMaterial);
    lightBeam.position.y = -1.25;
    scene.add(lightBeam);

    // --- Load Hand Model (GLB) ---
    const loader = new GLTFLoader();
    let loadedHand: THREE.Group | null = null;
    let handMixer: THREE.AnimationMixer | null = null;
    let grabHoldAction: THREE.AnimationAction | null = null;

    loader.load(
      "/Hand.glb",
      (gltf) => {
        loadedHand = gltf.scene;

        // Apply hologram material to all meshes
        loadedHand.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = hologramMaterial;
          }
        });

        // Scale and position adjustments
        loadedHand.scale.setScalar(3);
        loadedHand.position.set(0, 0, 0);
        loadedHand.rotation.y = 0;
        loadedHand.rotation.x = -0.2;

        // Center the hand
        const box = new THREE.Box3().setFromObject(loadedHand);
        const center = box.getCenter(new THREE.Vector3());
        loadedHand.position.sub(center);
        loadedHand.position.y += 0;

        // Set up animation mixer
        if (gltf.animations && gltf.animations.length > 0) {
          handMixer = new THREE.AnimationMixer(loadedHand);
          
          gltf.animations.forEach((clip) => {
            if (clip.name === "GrabHold") {
              grabHoldAction = handMixer!.clipAction(clip);
              grabHoldAction.setLoop(THREE.LoopOnce, 1);
              grabHoldAction.clampWhenFinished = true;
            }
          });
        }

        scene.add(loadedHand);
        console.log("Hand model loaded successfully");
      },
      undefined,
      (error) => {
        console.error("Error loading hand model:", error);
      }
    );

    // --- Animation State Machine ---
    const timer = new THREE.Timer();
    const startTime = performance.now();
    const totalSplashTime = 11000;

    // Animation phases
    const PHASE_RENDER = 0; // 0-1.5s: Hand materializes
    const PHASE_ROTATE = 1; // 1.5-5s: Hand rotates showing all angles
    const PHASE_CLOSE_FIST = 2; // 5-7s: Hand closes into fist
    const PHASE_FIST_HOLD = 3; // 7-7.5s: Fist held
    const PHASE_FIST_BUMP = 4; // 7.5-9.5s: Fist bumps toward screen
    const PHASE_FADE_OUT = 5; // 9.5-11s: Fade out

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
      const delta = timer.getDelta();
      const elapsed = timer.getElapsedTime();
      const splashElapsed = performance.now() - startTime;

      if (splashElapsed >= totalSplashTime) {
        if (!completed) {
          completed = true;
          fadeOut();
        }
        return;
      }

      hologramMaterial.uniforms.time.value = elapsed;
      beamMaterial.uniforms.time.value = elapsed;

      // Determine current phase
      let phase: number;
      if (splashElapsed < 1500) phase = PHASE_RENDER;
      else if (splashElapsed < 5000) phase = PHASE_ROTATE;
      else if (splashElapsed < 7000) phase = PHASE_CLOSE_FIST;
      else if (splashElapsed < 7500) phase = PHASE_FIST_HOLD;
      else if (splashElapsed < 9500) phase = PHASE_FIST_BUMP;
      else phase = PHASE_FADE_OUT;

      // Update mixer
      if (handMixer) {
        handMixer.update(delta);
      }

      // Animate loaded hand based on phase
      if (loadedHand) {
        switch (phase) {
          case PHASE_RENDER: {
            const renderProgress = splashElapsed / 1500;
            const renderEased = easeOutBack(renderProgress);
            loadedHand.scale.setScalar(3 * renderEased);
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.1;
            loadedHand.rotation.y = 0;
            loadedHand.position.z = 0;
            loadedHand.rotation.x = -0.2;
            break;
          }

          case PHASE_ROTATE: {
            loadedHand.scale.setScalar(3);
            const rotateProgress = (splashElapsed - 1500) / 3500;
            loadedHand.rotation.y = rotateProgress * Math.PI * 2;
            loadedHand.rotation.x = -0.2 + Math.sin(rotateProgress * Math.PI * 2) * 0.4;
            loadedHand.position.y = Math.sin(elapsed * 1.8) * 0.15;
            loadedHand.position.z = 0;
            break;
          }

          case PHASE_CLOSE_FIST: {
            if (grabHoldAction && !grabHoldAction.isRunning()) {
              grabHoldAction.reset();
              grabHoldAction.play();
            }
            loadedHand.rotation.y = 0;
            loadedHand.rotation.x = -0.2;
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.08;
            loadedHand.position.z = 0;
            loadedHand.scale.setScalar(3);
            break;
          }

          case PHASE_FIST_HOLD: {
            loadedHand.rotation.y = 0;
            loadedHand.rotation.x = -0.2;
            loadedHand.position.y = Math.sin(elapsed * 1.2) * 0.05;
            loadedHand.position.z = 0;
            loadedHand.scale.setScalar(3);
            break;
          }

          case PHASE_FIST_BUMP: {
            const bumpProgress = (splashElapsed - 7500) / 2000;
            const bumpEased = easeOutCubic(Math.min(bumpProgress, 1));
            loadedHand.position.z = bumpEased * 5;
            loadedHand.scale.setScalar(3 + bumpEased * 1.5);
            loadedHand.rotation.x = -0.2 + bumpEased * 0.5;
            loadedHand.rotation.y = 0;
  
            if (bumpProgress > 0.6) {
              const impactIntensity = (bumpProgress - 0.6) / 0.4;
              hologramMaterial.uniforms.glowColor.value.setHSL(
                0.5 - impactIntensity * 0.1,
                1,
                0.5 + impactIntensity * 0.4
              );
              camera.position.x = Math.sin(elapsed * 50) * impactIntensity * 0.1;
              camera.position.y = 1.5 + Math.cos(elapsed * 50) * impactIntensity * 0.1;
            }
            break;
          }

          case PHASE_FADE_OUT: {
            loadedHand.position.z = 5;
            loadedHand.scale.setScalar(4.5);
            loadedHand.rotation.x = 0.3;
            loadedHand.rotation.y = 0;
            hologramMaterial.uniforms.glowColor.value.setHSL(0.5, 1, 0.3);
            break;
          }
        }
      }

      // Pod animation
      innerRing.rotation.z = elapsed * 0.5;
      middleRing.rotation.z = -elapsed * 0.3;
      outerRing.rotation.z = elapsed * 0.1;

      // Beam pulse
      lightBeam.scale.x = 1.0 + Math.sin(elapsed * 10.0) * 0.02;
      lightBeam.scale.z = 1.0 + Math.sin(elapsed * 10.0) * 0.02;

      // Stars
      stars.rotation.y += 0.0005;

      // Camera
      const camAngle = elapsed * 0.15;
      camera.position.x = Math.sin(camAngle) * 1.5;
      camera.position.z = 8 + Math.cos(camAngle) * 0.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    // Easing functions
    function easeOutBack(t: number): number {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

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
          Initializing Hologram…
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