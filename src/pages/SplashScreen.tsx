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

    // --- Instanced Particle Assembly System ---
    const particleTargets: THREE.Vector3[] = [];
    const particleInitialPositions: THREE.Vector3[] = [];
    const particleInitialRotations: THREE.Euler[] = [];
    const particleCount = 800;

    // One InstancedMesh replaces hundreds of individual Mesh objects.
    // This reduces the particle phase to a single draw call.
    const particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particleMesh = new THREE.InstancedMesh(
      particleGeometry,
      particleMaterial,
      particleCount
    );
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleMesh.frustumCulled = false;

    const particleTransform = new THREE.Object3D();
    const particleInitialScales: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.cbrt(Math.random());
      const position = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      const rotation = new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      const scale = 0.5 + Math.random() * 0.5;

      particleInitialPositions.push(position);
      particleInitialRotations.push(rotation);
      particleInitialScales.push(scale);

      particleTransform.position.copy(position);
      particleTransform.rotation.copy(rotation);
      particleTransform.scale.setScalar(scale);
      particleTransform.updateMatrix();
      particleMesh.setMatrixAt(i, particleTransform.matrix);
    }

    particleMesh.instanceMatrix.needsUpdate = true;
    scene.add(particleMesh);

    // --- Animation State ---
    const clock = new THREE.Clock();
    const startTime = performance.now();
    const totalSplashTime = 12000;

    const PHASE_PARTICLES = 0;
    const PHASE_CLOSE_FIST = 1;
    const PHASE_TURN_FIST = 2;
    const PHASE_EXTEND_THUMB = 3;
    const PHASE_EXTEND_MIDDLE = 4;
    const PHASE_FADE_OUT = 5;

    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
    let handRevealed = false;
    let loadedHand: THREE.Group | null = null;

    type ProceduralBone = {
      bone: THREE.Bone;
      open: THREE.Quaternion;
      closed: THREE.Quaternion;
    };

    type HandRig = {
      fingers: ProceduralBone[][];
      thumb: ProceduralBone[];
    };

    let handRig: HandRig | null = null;
    let fistAnimationProgress = 0;
    let gestureProgress = 0;

    // The source GLB is sideways. Apply one consistent 90-degree yaw so the
    // open palm initially faces the camera.
    const handFacingOffset = Math.PI / 2;
    const handForwardYaw = handFacingOffset;

    const makeProceduralBone = (
      bone: THREE.Bone,
      curlRadians: number
    ): ProceduralBone => {
      const open = bone.quaternion.clone();
      const curlRotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(curlRadians, 0, 0)
      );
      const closed = open.clone().multiply(curlRotation);

      return { bone, open, closed };
    };

    const createHandRig = (hand: THREE.Group): HandRig => {
      const findBone = (name: string): THREE.Bone => {
        const object = hand.getObjectByName(name);
        if (!(object instanceof THREE.Bone)) {
          throw new Error(`Required hand bone not found: ${name}`);
        }
        return object;
      };

      const chain = (
        names: string[],
        curlRadians: number
      ): ProceduralBone[] =>
        names.map((name, index) =>
          makeProceduralBone(
            findBone(name),
            curlRadians * (1 - index * 0.08)
          )
        );

      return {
        fingers: [
          chain(
            [
              "Finger_Index1_04",
              "Finger_Index2_05",
              "Finger_Index3_06",
            ],
            1.05
          ),
          chain(
            [
              "Finger_Middle1_08",
              "Finger_Middle2_09",
              "Finger_Middle3_010",
            ],
            1.12
          ),
          chain(
            [
              "Finger_Ring1_012",
              "Finger_Ring2_013",
              "Finger_Ring3_014",
            ],
            1.18
          ),
          chain(
            [
              "Finger_Pinky1_016",
              "Finger_Pinky2_017",
              "Finger_Pinky3_018",
            ],
            1.24
          ),
        ],
        thumb: [
          makeProceduralBone(findBone("Finger_Thumb1_020"), -0.75),
          makeProceduralBone(findBone("Finger_Thumb2_021"), -0.85),
          makeProceduralBone(findBone("Finger_Thumb3_022"), -0.55),
        ],
      };
    };

    const applyHandPose = (
      rig: HandRig,
      fingerCurls: number[],
      thumbCurl: number,
      staggered = false
    ) => {
      rig.fingers.forEach((finger, fingerIndex) => {
        const rawCurl = THREE.MathUtils.clamp(
          fingerCurls[fingerIndex] ?? 0,
          0,
          1
        );
        const fingerCurl = staggered
          ? THREE.MathUtils.clamp(
              (rawCurl - fingerIndex * 0.045) /
                (1 - fingerIndex * 0.045),
              0,
              1
            )
          : rawCurl;

        finger.forEach((joint, jointIndex) => {
          const jointProgress = THREE.MathUtils.clamp(
            fingerCurl * (1.04 - jointIndex * 0.04),
            0,
            1
          );
          joint.bone.quaternion.slerpQuaternions(
            joint.open,
            joint.closed,
            jointProgress
          );
        });
      });

      const clampedThumbCurl = THREE.MathUtils.clamp(thumbCurl, 0, 1);
      rig.thumb.forEach((joint, jointIndex) => {
        const jointProgress = THREE.MathUtils.clamp(
          clampedThumbCurl * (1.05 - jointIndex * 0.08),
          0,
          1
        );
        joint.bone.quaternion.slerpQuaternions(
          joint.open,
          joint.closed,
          jointProgress
        );
      });
    };

    const applyProceduralFistPose = (
      rig: HandRig,
      progress: number
    ) => {
      const eased = easeInOutCubic(THREE.MathUtils.clamp(progress, 0, 1));
      applyHandPose(rig, [eased, eased, eased, eased], eased, true);
    };

    const easeInOutCubic = (value: number): number =>
      value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2;

    const getPhase = (splashElapsed: number): number => {
      if (splashElapsed < 4000) return PHASE_PARTICLES;
      if (splashElapsed < 6000) return PHASE_CLOSE_FIST;
      if (splashElapsed < 8000) return PHASE_TURN_FIST;
      if (splashElapsed < 9000) return PHASE_EXTEND_THUMB;
      if (splashElapsed < 10000) return PHASE_EXTEND_MIDDLE;
      return PHASE_FADE_OUT;
    };

    const revealHand = () => {
      if (handRevealed || !loadedHand) return;

      handRevealed = true;
      particleMesh.visible = false;

      loadedHand.visible = true;
      loadedHand.scale.setScalar(3);
      loadedHand.position.set(0, 0, 0);
      loadedHand.rotation.set(-0.2, handForwardYaw, 0);
      fistAnimationProgress = 0;
      gestureProgress = 0;
      if (handRig) {
        applyHandPose(handRig, [0, 0, 0, 0], 0);
      }
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

        setHandScale(3);
        loadedHand.position.set(0, 0, 0);
        loadedHand.rotation.set(0.3, handForwardYaw, 0);
        loadedHand.updateMatrixWorld(true);

        // Center after all initial transforms have been applied.
        const box = new THREE.Box3().setFromObject(loadedHand);
        const center = box.getCenter(new THREE.Vector3());
        loadedHand.position.sub(center);
        loadedHand.updateMatrixWorld(true);
        loadedHand.visible = false;

        // Ignore embedded GLB clips. Build the animation from the rig's
        // rest pose so the fist motion is fully controlled in this component.
        try {
          handRig = createHandRig(loadedHand);
          console.log("Procedural hand rig initialized");
        } catch (error) {
          console.error("Could not initialize procedural hand rig:", error);
        }

        // Sample mesh vertices in world space after the final transform.
        loadedHand.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;

          const positionAttribute = child.geometry.getAttribute("position");
          if (!positionAttribute) return;

          if (particleTargets.length >= particleCount) return;

          const remaining = particleCount - particleTargets.length;
          const sampleCount = Math.min(500, remaining);
          const step = Math.max(
            1,
            Math.floor(positionAttribute.count / sampleCount)
          );

          for (
            let i = 0;
            i < positionAttribute.count &&
            particleTargets.length < particleCount;
            i += step
          ) {
            const vertex = new THREE.Vector3().fromBufferAttribute(
              positionAttribute,
              i
            );
            child.localToWorld(vertex);
            particleTargets.push(vertex);
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

      // Update instance transforms only during the assembly phase.
      // After this phase, the InstancedMesh is hidden and no particle matrices
      // are modified, avoiding unnecessary GPU uploads.
      if (phase === PHASE_PARTICLES && particleProgress < 1) {
        const targetCount = Math.min(particleTargets.length, particleCount);

        for (let i = 0; i < targetCount; i++) {
          const initial = particleInitialPositions[i];
          const target = particleTargets[i];
          const initialRotation = particleInitialRotations[i];

          particleTransform.position.lerpVectors(
            initial,
            target,
            particleEased
          );
          particleTransform.rotation.set(
            initialRotation.x * (1 - particleEased),
            initialRotation.y * (1 - particleEased),
            initialRotation.z * (1 - particleEased)
          );
          particleTransform.scale.setScalar(
            particleInitialScales[i] + particleEased * 0.5
          );
          particleTransform.updateMatrix();
          particleMesh.setMatrixAt(i, particleTransform.matrix);
        }

        particleMesh.instanceMatrix.needsUpdate = true;
      }

      // Reveal based on elapsed time, independently of when the GLB finishes.
      // This handles both fast and slow network/model loads.
      if (splashElapsed >= 4000) {
        revealHand();
      }

      if (loadedHand && loadedHand.visible) {
        switch (phase) {
          case PHASE_CLOSE_FIST: {
            // 4–6s: close the open palm into a tight fist.
            loadedHand.rotation.y = handForwardYaw;
            loadedHand.rotation.x = 0.3;
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.08;
            loadedHand.position.z = 0;
            setHandScale(3);

            fistAnimationProgress = THREE.MathUtils.clamp(
              (splashElapsed - 4000) / 2000,
              0,
              1
            );
            if (handRig) {
              applyProceduralFistPose(handRig, fistAnimationProgress);
            }
            break;
          }

          case PHASE_TURN_FIST: {
            // 6–8s: keep the fist tight while turning it exactly 180 degrees.
            if (handRig) {
              applyProceduralFistPose(handRig, 1);
            }

            const turnProgress = THREE.MathUtils.clamp(
              (splashElapsed - 6000) / 2000,
              0,
              1
            );
            const turnEased = easeInOutCubic(turnProgress);
            loadedHand.rotation.y = handForwardYaw + turnEased * Math.PI;
            loadedHand.rotation.x = 0.3;
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.08;
            loadedHand.position.z = 0;
            setHandScale(3);
            break;
          }

          case PHASE_EXTEND_THUMB: {
            // 8–9s: hold the fist and extend the thumb fully.
            if (handRig) {
              const thumbProgress = THREE.MathUtils.clamp(
                (splashElapsed - 8000) / 1000,
                0,
                1
              );
              const thumbEased = easeInOutCubic(thumbProgress);
              applyHandPose(handRig, [1, 1, 1, 1], 1 - thumbEased);
            }

            loadedHand.rotation.y = handForwardYaw + Math.PI;
            loadedHand.rotation.x = 0.3;
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.08;
            loadedHand.position.z = 0;
            setHandScale(3);
            break;
          }

          case PHASE_EXTEND_MIDDLE: {
            // 9–10s: keep the thumb extended, then extend the middle finger.
            if (handRig) {
              const middleProgress = THREE.MathUtils.clamp(
                (splashElapsed - 9000) / 1000,
                0,
                1
              );
              const middleEased = easeInOutCubic(middleProgress);
              applyHandPose(
                handRig,
                [1, 1 - middleEased, 1, 1],
                0,
                false
              );
            }

            loadedHand.rotation.y = handForwardYaw + Math.PI;
            loadedHand.rotation.x = 0.3;
            loadedHand.position.y = Math.sin(elapsed * 1.5) * 0.08;
            loadedHand.position.z = 0;
            setHandScale(3);
            break;
          }

          case PHASE_FADE_OUT: {
            // Preserve the final gesture while fading out.
            if (handRig) {
              applyHandPose(handRig, [1, 0, 1, 1], 0, false);
            }

            loadedHand.position.z = 5;
            setHandScale(4.5);
            loadedHand.rotation.x = 0.8;
            loadedHand.rotation.y = handForwardYaw + Math.PI;
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

      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();

      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Points ||
          obj instanceof THREE.Line
        ) {
          geometries.add(obj.geometry);

          if (Array.isArray(obj.material)) {
            obj.material.forEach((material) => materials.add(material));
          } else if (obj.material instanceof THREE.Material) {
            materials.add(obj.material);
          }
        }
      });

      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
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
