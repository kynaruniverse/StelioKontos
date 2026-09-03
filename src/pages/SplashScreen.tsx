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

    // --- Hologram Material (standard for skinning support) ---
    const hologramMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
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

    // --- Particle Assembly System ---
    const particles: THREE.Mesh[] = [];
    const particleTargets: THREE.Vector3[] = [];
    const particleInitialPositions: THREE.Vector3[] = [];
    const particleInitialRotations: THREE.Euler[] = [];
    const particleCount = 800;

    const particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const particleMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.8,
      roughness: 0.2,
      metalness: 0.3,
    });

    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(particleGeometry, particleMaterial);
      const radius = 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.cbrt(Math.random());

      mesh.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      mesh.scale.setScalar(0.5 + Math.random() * 0.5);

      particles.push(mesh);
      particleInitialPositions.push(mesh.position.clone());
      particleInitialRotations.push(mesh.rotation.clone());
      scene.add(mesh);
    }

    // --- Animation State ---
    const clock = new THREE.Clock();
    const startTime = performance.now();
    const totalSplashTime = 12000;

    const PHASE_PARTICLES = 0;
    const PHASE_ROTATE = 1;
    const PHASE_CLOSE_FIST = 2;
    const PHASE_FIST_BUMP = 3;
    const PHASE_FADE_OUT = 4;

    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
    let handRevealed = false;
    let closeFistStarted = false;
    let loadedHand: THREE.Group | null = null;
    let handMixer: THREE.AnimationMixer | null = null;
    let grabHoldAction: THREE.AnimationAction | null = null;
    let activeHandAction: THREE.AnimationAction | null = null;
    const animationBlendDuration = 0.35;

    const switchHandAction = (
      nextAction: THREE.AnimationAction | null,
      options: {
        loop?: THREE.AnimationActionLoopStyles;
        repetitions?: number;
        clampWhenFinished?: boolean;
        restart?: boolean;
      } = {}
    ) => {
      if (!nextAction) return;

      const {
        loop = THREE.LoopOnce,
        repetitions = 1,
        clampWhenFinished = true,
        restart = false,
      } = options;

      if (activeHandAction === nextAction && !restart) return;

      if (activeHandAction && activeHandAction !== nextAction) {
        activeHandAction.fadeOut(animationBlendDuration);
      }

      nextAction.setLoop(loop, repetitions);
      nextAction.clampWhenFinished = clampWhenFinished;
      nextAction.reset();
      nextAction.setEffectiveWeight(1);
      nextAction.fadeIn(animationBlendDuration);
      nextAction.play();
      activeHandAction = nextAction;
    };

    const stopHandAction = () => {
      if (activeHandAction) {
        activeHandAction.fadeOut(animationBlendDuration);
        activeHandAction = null;
      }
    };

    const getPhase = (splashElapsed: number): number => {
      if (splashElapsed < 4000) return PHASE_PARTICLES;
      if (splashElapsed < 6000) return PHASE_ROTATE;
      if (splashElapsed < 8000) return PHASE_CLOSE_FIST;
      if (splashElapsed < 10000) return PHASE_FIST_BUMP;
      return PHASE_FADE_OUT;
    };

    const revealHand = () => {
      if (handRevealed || !loadedHand) return;

      handRevealed = true;
      particles.forEach((particle) => {
        particle.visible = false;
      });

      loadedHand.visible = true;
      loadedHand.scale.setScalar(3);
      loadedHand.position.set(0, 0, 0);
      loadedHand.rotation.set(-0.2, 0, 0);
    };

    // --- Load Hand Model (GLB) ---
    const loader = new GLTFLoader();

    loader.load(
      "/Hand.glb",
      (gltf) => {
        loadedHand = gltf.scene;

        loadedHand.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = hologramMaterial;
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        loadedHand.scale.setScalar(3);
        loadedHand.position.set(0, 0, 0);
        loadedHand.rotation.set(0.3, Math.PI, 0);
        loadedHand.updateMatrixWorld(true);

        // Center after all initial transforms have been applied.
        const box = new THREE.Box3().setFromObject(loadedHand);
        const center = box.getCenter(new THREE.Vector3());
        loadedHand.position.sub(center);
        loadedHand.updateMatrixWorld(true);
        loadedHand.visible = false;

        // Find the intended clip by partial name, then safely fall back to
        // the first clip rather than silently leaving the hand unanimated.
        if (gltf.animations.length > 0) {
          handMixer = new THREE.AnimationMixer(loadedHand);

          const clip =
            gltf.animations.find((animation) => {
              const name = animation.name.toLowerCase();
              return (
                name.includes("grab") ||
                name.includes("hold") ||
                name.includes("fist") ||
                name.includes("close")
              );
            }) ?? gltf.animations[0];

          console.log(
            `Using hand animation: "${clip.name}" (${clip.duration.toFixed(2)}s)`
          );

          grabHoldAction = handMixer.clipAction(clip);
          grabHoldAction.setLoop(THREE.LoopOnce, 1);
          grabHoldAction.clampWhenFinished = true;
        } else {
          console.warn("Hand.glb contains no animation clips");
        }

        // Sample mesh vertices in world space after the final transform.
        loadedHand.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;

          const positionAttribute = child.geometry.getAttribute("position");
          if (!positionAttribute) return;

          const step = Math.max(1, Math.floor(positionAttribute.count / 500));
          for (let i = 0; i < positionAttribute.count; i += step) {
            const vertex = new THREE.Vector3().fromBufferAttribute(
              positionAttribute,
              i
            );
            child.localToWorld(vertex);
            particleTargets.push(vertex.clone());
          }
        });

        scene.add(loadedHand);
        console.log(
          `Hand model loaded; sampled ${particleTargets.length} target points`
        );

        // If loading completed after the four-second particle phase, reveal
        // immediately instead of leaving the hand hidden forever.
        const splashElapsed = performance.now() - startTime;
        if (splashElapsed >= 4000) {
          revealHand();
        }
      },
      undefined,
      (error) => {
        console.error("Error loading hand model:", error);
      }
    );

    const fadeOut = () => {
      if (fadeRef.current) {
        fadeRef.current.classList.add("splash-fade-out");
      }
      fadeOutTimer = setTimeout(() => {
        onComplete();
      }, 1000);
    };

    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const splashElapsed = performance.now() - startTime;

      if (splashElapsed >= totalSplashTime) {
        if (!completed) {
          completed = true;
          fadeOut();
        }
        return;
      }

      beamMaterial.uniforms.time.value = elapsed;

      const phase = getPhase(splashElapsed);
      const particleProgress = Math.min(splashElapsed / 4000, 1);
      const particleEased = easeOutCubic(particleProgress);

      // Assemble only the particles that have corresponding hand targets.
      particles.forEach((particle, i) => {
        if (i >= particleTargets.length || particleProgress >= 1) return;

        const target = particleTargets[i];
        const initial = particleInitialPositions[i];
        const initialRotation = particleInitialRotations[i];

        particle.position.lerpVectors(initial, target, particleEased);
        particle.rotation.set(
          initialRotation.x * (1 - particleEased),
          initialRotation.y * (1 - particleEased),
          initialRotation.z * (1 - particleEased)
        );
        particle.scale.setScalar(0.5 + particleEased * 0.5);
      });

      // Reveal based on elapsed time, independently of when the GLB finishes.
      // This handles both fast and slow network/model loads.
      if (splashElapsed >= 4000) {
        revealHand();
      }

      // Always advance the mixer when it exists. Visibility should not control
      // whether the animation timeline is updated.
      if (handMixer) {
        handMixer.update(delta);
      }

      if (loadedHand && loadedHand.visible) {
        switch (phase) {
          case PHASE_ROTATE: {
            const rotateProgress = (splashElapsed - 4000) / 2000;
            loadedHand.rotation.y = Math.PI + rotateProgress * Math.PI * 2;
            loadedHand.rotation.x =
              0.3 + Math.sin(rotateProgress * Math.PI * 2) * 0.4;
            loadedHand.position.y = Math.sin(elapsed * 1.8) * 0.15;
            loadedHand.scale.setScalar(3);
            break;
          }

          case PHASE_CLOSE_FIST: {
            loadedHand.rotation.y = Math.PI;
            loadedHand.rotation.x = 0.3;
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.08;
            loadedHand.position.z = 0;
            loadedHand.scale.setScalar(3);

            // Start the one-shot animation once on phase entry. The old code
            // restarted it every frame after LoopOnce had finished.
            if (!closeFistStarted) {
              closeFistStarted = true;
              if (grabHoldAction) {
                console.log("Playing hand close animation");
                switchHandAction(grabHoldAction, {
                  loop: THREE.LoopOnce,
                  repetitions: 1,
                  clampWhenFinished: true,
                  restart: true,
                });
              }
            }
            break;
          }

          case PHASE_FIST_BUMP: {
            // Fade the skeletal action out while the separate fist-bump motion
            // takes over, preventing a visible pose snap at the phase boundary.
            if (activeHandAction) {
              stopHandAction();
            }

            const bumpProgress = Math.min((splashElapsed - 8000) / 2000, 1);
            const bumpEased = easeOutCubic(bumpProgress);

            loadedHand.position.z = bumpEased * 5;
            loadedHand.scale.setScalar(3 + bumpEased * 1.5);
            loadedHand.rotation.x = 0.3 + bumpEased * 0.5;
            loadedHand.rotation.y = Math.PI;

            if (bumpProgress > 0.6) {
              const impactIntensity = (bumpProgress - 0.6) / 0.4;
              hologramMaterial.emissiveIntensity =
                0.8 + impactIntensity * 0.8;
              camera.position.x = Math.sin(elapsed * 50) * impactIntensity * 0.1;
              camera.position.y =
                1.5 + Math.cos(elapsed * 50) * impactIntensity * 0.1;
            }
            break;
          }

          case PHASE_FADE_OUT: {
            if (activeHandAction) {
              stopHandAction();
            }

            loadedHand.position.z = 5;
            loadedHand.scale.setScalar(4.5);
            loadedHand.rotation.x = 0.8;
            loadedHand.rotation.y = Math.PI;
            hologramMaterial.emissiveIntensity = 0.3;
            break;
          }
        }
      }

      // Pod animation
      innerRing.rotation.z = elapsed * 0.5;
      middleRing.rotation.z = -elapsed * 0.3;
      outerRing.rotation.z = elapsed * 0.1;

      // Beam pulse
      const beamPulse = 1 + Math.sin(elapsed * 10) * 0.02;
      lightBeam.scale.x = beamPulse;
      lightBeam.scale.z = beamPulse;

      // Stars
      stars.rotation.y += 0.0005;

      // Camera
      const camAngle = elapsed * 0.15;
      camera.position.x = Math.sin(camAngle) * 1.5;
      camera.position.z = 8 + Math.cos(camAngle) * 0.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

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

    return () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", handleResize);

      if (fadeOutTimer) {
        clearTimeout(fadeOutTimer);
      }

      handMixer?.stopAllAction();
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
            obj.material.forEach((material) => material.dispose());
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
              animation: "splash-progress 12s linear forwards",
            }}
          />
        </div>
        <p style={{ fontSize: "12px", textTransform: "uppercase" }}>
          Assembling Hologram…
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