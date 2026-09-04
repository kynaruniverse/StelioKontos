import type React from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface UseHandSplashAnimationOptions {
  onComplete: () => void;
  mountRef: React.RefObject<HTMLDivElement | null>;
  fadeRef: React.RefObject<HTMLDivElement | null>;
}

export function useHandSplashAnimation({
  onComplete,
  mountRef,
  fadeRef,
}: UseHandSplashAnimationOptions) {
  const [loadError, setLoadError] = useState(false);
  const [skip, setSkip] = useState<() => void>(() => () => {});
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- Simple scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111327"); // dark navy background

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.2, 5);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.HemisphereLight(0xffffff, 0x222233, 2.2);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);

    // Simple material (warm skin tone, no hologram effects)
    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0xe0ac69,
      roughness: 0.6,
      metalness: 0.05,
      flatShading: false,
    });

    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
    let loadedHand: THREE.Group | null = null;
    let handBasePosition: THREE.Vector3 | null = null;
    let isMounted = true;

    // Procedural rig types
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
          // Index finger
          chain(
            ["Finger_Index1_04", "Finger_Index2_05", "Finger_Index3_06"],
            0.9
          ),
          // Middle finger
          chain(
            ["Finger_Middle1_08", "Finger_Middle2_09", "Finger_Middle3_010"],
            0.95
          ),
          // Ring finger
          chain(
            ["Finger_Ring1_012", "Finger_Ring2_013", "Finger_Ring3_014"],
            1.2
          ),
          // Pinky finger
          chain(
            ["Finger_Pinky1_016", "Finger_Pinky2_017", "Finger_Pinky3_018"],
            1.3
          ),
        ],
        thumb: [
          makeProceduralBone(findBone("Finger_Thumb1_020"), -0.6),
          makeProceduralBone(findBone("Finger_Thumb2_021"), -0.8),
          makeProceduralBone(findBone("Finger_Thumb3_022"), -0.5),
        ],
      };
    };

    const applyHandPose = (
      rig: HandRig,
      fingerCurls: number[], // index, middle, ring, pinky
      thumbCurl: number
    ) => {
      rig.fingers.forEach((finger, fingerIndex) => {
        const curl = THREE.MathUtils.clamp(fingerCurls[fingerIndex] ?? 0, 0, 1);
        finger.forEach((joint, jointIndex) => {
          const jointProgress = THREE.MathUtils.clamp(
            curl * (1.04 - jointIndex * 0.04),
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

      const clampedThumb = THREE.MathUtils.clamp(thumbCurl, 0, 1);
      rig.thumb.forEach((joint, jointIndex) => {
        const jointProgress = THREE.MathUtils.clamp(
          clampedThumb * (1.05 - jointIndex * 0.08),
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

    // Animation timeline constants (in milliseconds)
    const PHASE_APPEAR = 0;
    const PHASE_TRANSITION = 1; // from open to peace sign
    const PHASE_HOLD = 2;
    const PHASE_FADE = 3;
    const TOTAL_DURATION = 7000; // 7 seconds total
    const APPEAR_DURATION = 1000;
    const TRANSITION_DURATION = 2000;
    const HOLD_DURATION = 3000;
    const FADE_DURATION = 1000;

    const getPhase = (elapsed: number) => {
      if (elapsed < APPEAR_DURATION) return PHASE_APPEAR;
      if (elapsed < APPEAR_DURATION + TRANSITION_DURATION) return PHASE_TRANSITION;
      if (elapsed < APPEAR_DURATION + TRANSITION_DURATION + HOLD_DURATION)
        return PHASE_HOLD;
      return PHASE_FADE;
    };

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const fadeOut = () => {
      if (fadeRef.current) {
        fadeRef.current.classList.add("splash-fade-out");
      }
      fadeOutTimer = setTimeout(() => {
        onCompleteRef.current();
      }, FADE_DURATION);
    };

    const skip = () => {
      if (!completed) {
        completed = true;
        fadeOut();
      }
    };
    setSkip(() => skip);

    // Load hand model
    const loader = new GLTFLoader();
    loader.load(
      "/Hand.glb",
      (gltf) => {
        if (!isMounted) return;

        loadedHand = gltf.scene;
        loadedHand.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = handMaterial;
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });

        // Center the hand
        const box = new THREE.Box3().setFromObject(loadedHand);
        const center = box.getCenter(new THREE.Vector3());
        loadedHand.position.sub(center);
        handBasePosition = loadedHand.position.clone();
        loadedHand.updateMatrixWorld(true);

        // Start hidden, will appear in animation
        loadedHand.visible = true;
        loadedHand.scale.setScalar(1);
        loadedHand.rotation.set(-0.2, Math.PI / 2, 0);

        try {
          handRig = createHandRig(loadedHand);
          // Set initial pose: open hand (all fingers extended, thumb relaxed)
          applyHandPose(handRig, [0, 0, 0, 0], 0);
        } catch (error) {
          console.error("Could not initialize hand rig:", error);
        }

        scene.add(loadedHand);
      },
      undefined,
      (error) => {
        if (!isMounted) return;
        console.error("Error loading hand model:", error);
        setLoadError(true);
      }
    );

    const clock = new THREE.Clock();
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= TOTAL_DURATION) {
        if (!completed) {
          completed = true;
          fadeOut();
        }
        return;
      }

      const phase = getPhase(elapsed);
      const delta = clock.getDelta();

      if (loadedHand && handRig && handBasePosition) {
        // Gentle floating motion
        const floatY = Math.sin(elapsed * 0.002) * 0.08;
        loadedHand.position.set(
          handBasePosition.x,
          handBasePosition.y + floatY,
          handBasePosition.z
        );

        switch (phase) {
          case PHASE_APPEAR: {
            // Fade in: scale up slightly
            const progress = THREE.MathUtils.clamp(elapsed / APPEAR_DURATION, 0, 1);
            loadedHand.scale.setScalar(0.8 + progress * 0.2);
            // Open hand
            applyHandPose(handRig, [0, 0, 0, 0], 0);
            break;
          }
          case PHASE_TRANSITION: {
            const progress = THREE.MathUtils.clamp(
              (elapsed - APPEAR_DURATION) / TRANSITION_DURATION,
              0,
              1
            );
            const eased = easeInOutCubic(progress);
            // Curl ring and pinky fully, index and middle stay extended,
            // thumb curls inward a bit
            applyHandPose(handRig, [0, 0, eased, eased], eased * 0.8);
            loadedHand.rotation.y = Math.PI / 2 + Math.sin(elapsed * 0.001) * 0.1;
            break;
          }
          case PHASE_HOLD: {
            // Peace sign held
            applyHandPose(handRig, [0, 0, 1, 1], 0.8);
            // Slight rotation to show off the sign
            loadedHand.rotation.y =
              Math.PI / 2 + Math.sin(elapsed * 0.0005) * 0.2;
            break;
          }
          case PHASE_FADE: {
            const progress = THREE.MathUtils.clamp(
              (elapsed - APPEAR_DURATION - TRANSITION_DURATION - HOLD_DURATION) /
                FADE_DURATION,
              0,
              1
            );
            // Hold pose, fade out by moving camera or scaling? We'll just let CSS fade handle it.
            applyHandPose(handRig, [0, 0, 1, 1], 0.8);
            break;
          }
        }
        loadedHand.updateMatrixWorld(true);
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", handleResize);
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      // Dispose geometries/materials
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, []);

  return { loadError, skip };
}