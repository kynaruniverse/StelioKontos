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

    // --- Scene setup: clean dark background ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0e0f1a");

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.3, 4.5);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambient = new THREE.HemisphereLight(0xffffff, 0x333344, 2.2);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x88aaff, 1.5);
    rimLight.position.set(-1, 0.5, -2);
    scene.add(rimLight);

    // --- Hand material (warm, non-holographic) ---
    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6b17e,
      roughness: 0.55,
      metalness: 0.05,
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
            1.0
          ),
          // Middle finger
          chain(
            ["Finger_Middle1_08", "Finger_Middle2_09", "Finger_Middle3_010"],
            1.05
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
          makeProceduralBone(findBone("Finger_Thumb1_020"), -0.55),
          makeProceduralBone(findBone("Finger_Thumb2_021"), -0.75),
          makeProceduralBone(findBone("Finger_Thumb3_022"), -0.45),
        ],
      };
    };

    const applyHandPose = (
      rig: HandRig,
      fingerCurls: number[], // [index, middle, ring, pinky] 0=extended, 1=fully curled
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

      // Force skeleton update after changing bone rotations
      if (loadedHand) {
        loadedHand.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            child.skeleton.update();
          }
        });
        loadedHand.updateMatrixWorld(true);
      }
    };

    // Animation timeline (in ms)
    const APPEAR_DURATION = 1200;
    const TRANSITION_DURATION = 2500;
    const HOLD_DURATION = 2500;
    const FADE_DURATION = 800;
    const TOTAL_DURATION =
      APPEAR_DURATION + TRANSITION_DURATION + HOLD_DURATION + FADE_DURATION;

    const getPhase = (elapsed: number) => {
      if (elapsed < APPEAR_DURATION) return 0; // appear
      if (elapsed < APPEAR_DURATION + TRANSITION_DURATION) return 1; // transition
      if (elapsed < APPEAR_DURATION + TRANSITION_DURATION + HOLD_DURATION)
        return 2; // hold
      return 3; // fade
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

        // Initial rotation: palm facing camera
        loadedHand.rotation.set(-0.1, Math.PI / 2, 0);
        loadedHand.scale.setScalar(0.9);
        loadedHand.updateMatrixWorld(true);

        try {
          handRig = createHandRig(loadedHand);
          // Start fully open
          applyHandPose(handRig, [0, 0, 0, 0], 0);
          console.log("Hand rig ready for peace sign animation");
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

      if (loadedHand && handRig && handBasePosition) {
        // Subtle floating motion
        const floatY = Math.sin(elapsed * 0.002) * 0.06;
        loadedHand.position.set(
          handBasePosition.x,
          handBasePosition.y + floatY,
          handBasePosition.z
        );

        switch (phase) {
          case 0: {
            // Appear: scale up from 0.6 to 0.9, hand open
            const progress = THREE.MathUtils.clamp(elapsed / APPEAR_DURATION, 0, 1);
            loadedHand.scale.setScalar(0.6 + progress * 0.3);
            applyHandPose(handRig, [0, 0, 0, 0], 0);
            break;
          }
          case 1: {
            // Transition to peace sign: index and middle stay extended,
            // ring and pinky curl fully, thumb curls a bit.
            const progress = THREE.MathUtils.clamp(
              (elapsed - APPEAR_DURATION) / TRANSITION_DURATION,
              0,
              1
            );
            const eased = easeInOutCubic(progress);
            applyHandPose(handRig, [0, 0, eased, eased], eased * 0.7);
            // Slight wrist rotation to show off the sign
            loadedHand.rotation.y =
              Math.PI / 2 + Math.sin(elapsed * 0.001) * 0.15;
            break;
          }
          case 2: {
            // Hold peace sign with a gentle twist
            applyHandPose(handRig, [0, 0, 1, 1], 0.7);
            loadedHand.rotation.y =
              Math.PI / 2 + Math.sin(elapsed * 0.0008) * 0.2;
            break;
          }
          case 3: {
            // Fade: keep pose, move hand slightly back
            applyHandPose(handRig, [0, 0, 1, 1], 0.7);
            const fadeProgress = THREE.MathUtils.clamp(
              (elapsed - (APPEAR_DURATION + TRANSITION_DURATION + HOLD_DURATION)) /
                FADE_DURATION,
              0,
              1
            );
            loadedHand.position.z = handBasePosition.z - fadeProgress * 1.2;
            break;
          }
        }
        // Extra skeleton update after all transforms
        loadedHand.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            child.skeleton.update();
          }
        });
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