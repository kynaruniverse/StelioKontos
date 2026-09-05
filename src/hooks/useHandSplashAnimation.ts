import type React from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface UseHandSplashAnimationOptions {
  onComplete: () => void;
  mountRef: React.RefObject<HTMLDivElement | null>;
  fadeRef: React.RefObject<HTMLDivElement | null>;
  flashRef: React.RefObject<HTMLDivElement | null>;
}

type BonePose = {
  bone: THREE.Object3D;
  rest: THREE.Quaternion;
  curled: THREE.Quaternion;
};

type HandRig = {
  fingers: BonePose[][];
  thumb: BonePose[];
};

type HandPose = {
  fingers: [number, number, number, number]; // index, middle, ring, little
  thumb: number;
};

const MODEL_URL = "/Hand.glb";
const OPEN: HandPose = { fingers: [0, 0, 0, 0], thumb: 0 };
const COUNTDOWN_TOTAL = 5;

const lerpPose = (from: HandPose, to: HandPose, amount: number): HandPose => ({
  fingers: from.fingers.map((value, index) =>
    THREE.MathUtils.lerp(value, to.fingers[index], amount),
  ) as HandPose["fingers"],
  thumb: THREE.MathUtils.lerp(from.thumb, to.thumb, amount),
});

const easeInOut = (value: number) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

export function useHandSplashAnimation({
  onComplete,
  mountRef,
  fadeRef,
  flashRef,
}: UseHandSplashAnimationOptions) {
  const [loadError, setLoadError] = useState(false);
  const [skip, setSkip] = useState<() => void>(() => () => {});
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0e0f1a");

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / Math.max(window.innerHeight, 1),
      0.1,
      100,
    );
    camera.position.set(0, 1.3, 4.5);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.5);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x88aaff, 1.5);
    rimLight.position.set(-1, 0.5, -2);
    scene.add(rimLight);

    let loadedHand: THREE.Group | null = null;
    let handRig: HandRig | null = null;
    const handBasePosition = new THREE.Vector3();
    const handBaseQuaternion = new THREE.Quaternion();
    const flourishAxis = new THREE.Vector3(0, 1, 0);
    let startedAt: number | null = null;
    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;
    let lastDroppedFinger = 0;
    let audioContext: AudioContext | null = null;

    const findBone = (hand: THREE.Group, name: string): THREE.Object3D => {
      const bone = hand.getObjectByName(name);
      if (!bone || bone.type !== "Bone") {
        throw new Error(`Required hand bone not found: ${name}`);
      }
      return bone;
    };

    // This GLB's finger curl is primarily on the local Y axis.
    const makeBonePose = (
      hand: THREE.Group,
      name: string,
      curl: number,
      direction = 1,
    ): BonePose => {
      const bone = findBone(hand, name);
      const rest = bone.quaternion.clone();
      const curlRotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, curl * direction, 0),
      );
      return { bone, rest, curled: rest.clone().multiply(curlRotation) };
    };

    const makeChain = (
      hand: THREE.Group,
      names: string[],
      curl: number,
      direction = 1,
    ) =>
      names.map((name, index) =>
        makeBonePose(hand, name, curl * (1 - index * 0.08), direction),
      );

    const createHandRig = (hand: THREE.Group): HandRig => ({
      fingers: [
        makeChain(hand, ["Finger_Index1_04", "Finger_Index2_05", "Finger_Index3_06"], 1.0),
        makeChain(hand, ["Finger_Middle1_08", "Finger_Middle2_09", "Finger_Middle3_010"], 1.05),
        makeChain(hand, ["Finger_Ring1_012", "Finger_Ring2_013", "Finger_Ring3_014"], 1.2),
        makeChain(hand, ["Finger_Pinky1_016", "Finger_Pinky2_017", "Finger_Pinky3_018"], 1.3),
      ],
      thumb: [
        makeBonePose(hand, "Finger_Thumb1_020", 0.95),
        makeBonePose(hand, "Finger_Thumb2_021", 0.95),
        makeBonePose(hand, "Finger_Thumb3_022", 0.75),
      ],
    });

    const applyPose = (rig: HandRig, pose: HandPose) => {
      rig.fingers.forEach((finger, fingerIndex) => {
        const curl = THREE.MathUtils.clamp(pose.fingers[fingerIndex], 0, 1);
        finger.forEach((joint, jointIndex) => {
          const amount = THREE.MathUtils.clamp(
            curl * (1.05 - jointIndex * 0.05),
            0,
            1,
          );
          joint.bone.quaternion.slerpQuaternions(joint.rest, joint.curled, amount);
        });
      });

      rig.thumb.forEach((joint, jointIndex) => {
        const amount = THREE.MathUtils.clamp(
          pose.thumb * (1.05 - jointIndex * 0.08),
          0,
          1,
        );
        joint.bone.quaternion.slerpQuaternions(joint.rest, joint.curled, amount);
      });

      loadedHand?.updateMatrixWorld(true);
    };

    const setHandOpacity = (opacity: number) => {
      loadedHand?.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => {
          material.transparent = opacity < 1;
          material.opacity = opacity;
          material.depthWrite = opacity > 0.95;
        });
      });
    };

    const flashColours = ["#ff3b81", "#42e8ff", "#ffe45e", "#9b5cff", "#55f28c"];
    const flash = (index: number) => {
      const element = flashRef.current;
      if (!element) return;
      element.style.backgroundColor = flashColours[index % flashColours.length];
      element.classList.remove("splash-flash-active");
      void element.offsetWidth;
      element.classList.add("splash-flash-active");
    };

    const unlockAudio = () => {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
      }
      if (audioContext?.state === "suspended") void audioContext.resume();
    };

    const playCountdownTone = (index: number) => {
      unlockAudio();
      if (!audioContext) return;

      const now = audioContext.currentTime;
      const frequencies = [220, 277.18, 329.63, 415.3, 110];
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = index === COUNTDOWN_TOTAL - 1 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequencies[index] ?? 220, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        (frequencies[index] ?? 220) * 0.72,
        now + 0.14,
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === COUNTDOWN_TOTAL - 1 ? 0.2 : 0.12, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    };

    const playFinishTone = () => {
      unlockAudio();
      if (!audioContext) return;
      const now = audioContext.currentTime;
      [220, 329.63, 440].forEach((frequency, index) => {
        const oscillator = audioContext!.createOscillator();
        const gain = audioContext!.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.1, now + index * 0.04 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        oscillator.connect(gain).connect(audioContext!.destination);
        oscillator.start(now + index * 0.04);
        oscillator.stop(now + 0.46);
      });
    };

    const handleAudioUnlock = () => unlockAudio();
    window.addEventListener("pointerdown", handleAudioUnlock, { passive: true });
    window.addEventListener("keydown", handleAudioUnlock, { passive: true });

    const fadeOut = () => {
      playFinishTone();
      const element = flashRef.current;
      if (element) {
        element.style.background = "radial-gradient(circle at 50% 48%, #ffffff 0%, #42e8ff 18%, #9b5cff 48%, #050b14 100%)";
        element.classList.remove("splash-flash-active");
        void element.offsetWidth;
        element.classList.add("splash-transition-active");
      }
      fadeRef.current?.classList.add("splash-fade-out");
      fadeOutTimer = setTimeout(() => onCompleteRef.current(), 700);
    };

    const finish = () => {
      if (completed) return;
      completed = true;
      fadeOut();
    };

    setSkip(() => finish);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (!isMounted) return;
        loadedHand = gltf.scene;

        // Keep the white GLB material. The online viewer's black outline is a viewer effect.
        loadedHand.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });

        const box = new THREE.Box3().setFromObject(loadedHand);
        loadedHand.position.sub(box.getCenter(new THREE.Vector3()));
        handBasePosition.copy(loadedHand.position);

        // local +X is wrist-to-fingertip; map it to world +Y.
        const uprightBasis = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(1, 0, 0),
        );
        handBaseQuaternion.setFromRotationMatrix(uprightBasis);
        loadedHand.quaternion.copy(handBaseQuaternion);
        loadedHand.scale.setScalar(0.32);
        loadedHand.position.set(
          handBasePosition.x,
          handBasePosition.y - 3.2,
          handBasePosition.z + 2.2,
        );
        setHandOpacity(0);

        try {
          handRig = createHandRig(loadedHand);
          applyPose(handRig, OPEN);
        } catch (error) {
          console.error("Could not initialize countdown hand rig:", error);
          setLoadError(true);
        }

        scene.add(loadedHand);
        startedAt = performance.now();
      },
      undefined,
      (error) => {
        if (!isMounted) return;
        console.error("Error loading hand model:", error);
        setLoadError(true);
      },
    );

    // 1.5s rise-in + 5 one-second countdown beats + 0.5s handoff = 7s total.
    const INTRO_DURATION = 1.5;
    const DROP_INTERVAL = 1.0;
    const FINAL_HOLD = 0.5;
    const TOTAL_DURATION = INTRO_DURATION + COUNTDOWN_TOTAL * DROP_INTERVAL + FINAL_HOLD;
    const transitionDuration = 0.28;

    const poseForDroppedCount = (count: number): HandPose => {
      // Order: little, ring, index/pointer, thumb, middle.
      const pose: HandPose = {
        fingers: [0, 0, 0, 0],
        thumb: 0,
      };
      if (count >= 1) pose.fingers[3] = 1;
      if (count >= 2) pose.fingers[2] = 1;
      if (count >= 3) pose.fingers[0] = 1;
      if (count >= 4) pose.thumb = 1;
      if (count >= 5) pose.fingers[1] = 1;
      return pose;
    };

    const animate = () => {
      const elapsed = startedAt === null
        ? 0
        : (performance.now() - startedAt) / 1000;

      if (loadedHand && handRig && startedAt !== null) {
        const introProgress = THREE.MathUtils.clamp(elapsed / INTRO_DURATION, 0, 1);
        const introEase = easeInOut(introProgress);
        const countdownElapsed = Math.max(0, elapsed - INTRO_DURATION);
        const droppedCount = Math.min(
          COUNTDOWN_TOTAL,
          Math.floor(countdownElapsed / DROP_INTERVAL),
        );
        const beatProgress = countdownElapsed % DROP_INTERVAL;
        const previousPose = poseForDroppedCount(Math.max(0, droppedCount - 1));
        const currentPose = poseForDroppedCount(droppedCount);
        const poseProgress = droppedCount === 0
          ? 0
          : THREE.MathUtils.clamp(beatProgress / transitionDuration, 0, 1);

        if (droppedCount > lastDroppedFinger && droppedCount <= COUNTDOWN_TOTAL) {
          flash(droppedCount - 1);
          playCountdownTone(droppedCount - 1);
          lastDroppedFinger = droppedCount;
        }

        applyPose(handRig, lerpPose(previousPose, currentPose, easeInOut(poseProgress)));
        loadedHand.quaternion.copy(handBaseQuaternion);
        loadedHand.rotateOnWorldAxis(flourishAxis, Math.sin(elapsed * 2.6) * 0.025);
        loadedHand.position.set(
          handBasePosition.x,
          THREE.MathUtils.lerp(handBasePosition.y - 3.2, handBasePosition.y, introEase) + Math.sin(elapsed * 2) * 0.025,
          THREE.MathUtils.lerp(handBasePosition.z + 2.2, handBasePosition.z, introEase),
        );
        loadedHand.scale.setScalar(THREE.MathUtils.lerp(0.32, 0.9, introEase));
        if (introProgress < 1) setHandOpacity(introEase);
        loadedHand.updateMatrixWorld(true);

        if (elapsed >= TOTAL_DURATION) finish();
      }

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointerdown", handleAudioUnlock);
      window.removeEventListener("keydown", handleAudioUnlock);
      audioContext?.close();
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [fadeRef, flashRef, mountRef]);

  return { loadError, skip };
}
