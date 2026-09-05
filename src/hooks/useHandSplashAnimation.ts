import type React from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface UseHandSplashAnimationOptions {
  onComplete: () => void;
  mountRef: React.RefObject<HTMLDivElement | null>;
  fadeRef: React.RefObject<HTMLDivElement | null>;
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
  fingers: [number, number, number, number];
  thumb: number;
};

const MODEL_URL = "/Hand.glb";

const OPEN: HandPose = { fingers: [0, 0, 0, 0], thumb: 0 };
const PEACE: HandPose = { fingers: [0, 0, 1, 1], thumb: 0.12 };
const FIST: HandPose = { fingers: [1, 1, 1, 1], thumb: 1 };
const THUMB_MIDDLE: HandPose = { fingers: [1, 0, 1, 1], thumb: 0 };

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
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.3, 4.5);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    let handBasePosition = new THREE.Vector3();
    let completed = false;
    let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const findBone = (hand: THREE.Group, name: string): THREE.Object3D => {
      const bone = hand.getObjectByName(name);
      if (!bone || bone.type !== "Bone") {
        throw new Error(`Required hand bone not found: ${name}`);
      }
      return bone;
    };

    // This GLB's finger curl is primarily on the local Y axis. We keep each
    // rest pose, then add a stylized curl around that axis without using GLB
    // animation clips.
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

    const fadeOut = () => {
      fadeRef.current?.classList.add("splash-fade-out");
      fadeOutTimer = setTimeout(() => onCompleteRef.current(), 800);
    };

    const finish = () => {
      if (completed) return;
      completed = true;
      fadeOut();
    };

    const skipAnimation = () => finish();
    setSkip(() => skipAnimation);

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (!isMounted) return;

        loadedHand = gltf.scene;

        // Keep the materials authored in the GLB. The online viewer's black
        // outline is a viewer effect; there is no outline material in this file.
        loadedHand.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });

        const box = new THREE.Box3().setFromObject(loadedHand);
        const center = box.getCenter(new THREE.Vector3());
        loadedHand.position.sub(center);
        handBasePosition.copy(loadedHand.position);
        loadedHand.rotation.set(-0.1, Math.PI / 2, 0);
        loadedHand.scale.setScalar(0.9);

        try {
          handRig = createHandRig(loadedHand);
          applyPose(handRig, OPEN);
          console.info("Custom hand gesture rig ready");
        } catch (error) {
          console.error("Could not initialize custom hand rig:", error);
          setLoadError(true);
        }

        scene.add(loadedHand);
      },
      undefined,
      (error) => {
        if (!isMounted) return;
        console.error("Error loading hand model:", error);
        setLoadError(true);
      },
    );

    // Custom sequence: open, peace, fist, thumb + middle extension, repeat.
    const OPEN_DURATION = 1.0;
    const PEACE_DURATION = 2.0;
    const FIST_DURATION = 2.75;
    const EXTENSION_DURATION = 2.0;
    const TRANSITION_DURATION = 0.9;
    const CYCLE_DURATION =
      OPEN_DURATION +
      PEACE_DURATION +
      FIST_DURATION +
      EXTENSION_DURATION;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const cycleTime = elapsed % CYCLE_DURATION;

      if (loadedHand && handRig) {
        let pose: HandPose;
        let flourish = 0;

        if (cycleTime < OPEN_DURATION) {
          pose = OPEN;
        } else if (cycleTime < OPEN_DURATION + PEACE_DURATION) {
          const progress = THREE.MathUtils.clamp(
            (cycleTime - OPEN_DURATION) / TRANSITION_DURATION,
            0,
            1,
          );
          pose = lerpPose(OPEN, PEACE, easeInOut(progress));
          flourish = Math.sin(elapsed * 5) * 0.06;
        } else if (cycleTime < OPEN_DURATION + PEACE_DURATION + FIST_DURATION) {
          const fistStart = OPEN_DURATION + PEACE_DURATION;
          const progress = THREE.MathUtils.clamp(
            (cycleTime - fistStart) / TRANSITION_DURATION,
            0,
            1,
          );
          pose = lerpPose(PEACE, FIST, easeInOut(progress));
        } else {
          const extensionStart = OPEN_DURATION + PEACE_DURATION + FIST_DURATION;
          const progress = THREE.MathUtils.clamp(
            (cycleTime - extensionStart) / TRANSITION_DURATION,
            0,
            1,
          );
          pose = lerpPose(FIST, THUMB_MIDDLE, easeInOut(progress));
          flourish = Math.sin(elapsed * 7) * 0.09;
        }

        applyPose(handRig, pose);
        loadedHand.rotation.y = Math.PI / 2 + flourish;
        loadedHand.position.y = handBasePosition.y + Math.sin(elapsed * 2) * 0.06;
        loadedHand.updateMatrixWorld(true);
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
      if (fadeOutTimer) clearTimeout(fadeOutTimer);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [fadeRef, mountRef]);

  return { loadError, skip };
}
