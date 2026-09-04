import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

const WORLD_SIZE = 54;
const MAX_SPEED = 10;
const ACCELERATION = 18;
const FRICTION = 9;

type ControlState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

type Landmark = {
  position: THREE.Vector3;
  title: string;
  label: string;
  colour: number;
};

const palette = {
  night: 0x111327,
  midnight: 0x1c2145,
  paper: 0xf5edd9,
  coral: 0xf25d4d,
  yellow: 0xf5d44f,
  blue: 0x5ca8d8,
  green: 0x6eaa79,
  ink: 0x10111d,
};

function createTextSprite(text: string, colour = "#f5edd9", background = "#111327") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = colour;
  context.lineWidth = 6;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = colour;
  context.font = "700 34px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.4, 1.1, 1);
  return sprite;
}

function addBlock(group: THREE.Group, position: [number, number, number], size: [number, number, number], colour: number, rotation = 0) {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.92, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addTree(group: THREE.Group, x: number, z: number, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24 * scale, 0.34 * scale, 1.6 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x8d6847, flatShading: true }),
  );
  trunk.position.set(x, 0.8 * scale, z);
  trunk.castShadow = true;
  group.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.4 * scale, 0),
    new THREE.MeshStandardMaterial({ color: palette.green, roughness: 1, flatShading: true }),
  );
  crown.position.set(x, 2.1 * scale, z);
  crown.castShadow = true;
  group.add(crown);
}

function addLandmark(group: THREE.Group, landmark: Landmark) {
  const island = new THREE.Group();
  island.position.copy(landmark.position);
  addBlock(island, [0, -0.55, 0], [6.8, 0.8, 5.2], 0x2e396b, 0.08);
  addBlock(island, [0, 0.1, 0], [5.6, 0.5, 4.2], landmark.colour, 0.08);
  addBlock(island, [0, 1.4, 0], [4.2, 2.4, 2.4], palette.midnight, -0.08);
  const sign = createTextSprite(landmark.label, "#f5edd9", "#111327");
  sign.position.set(0, 3.4, 0);
  island.add(sign);
  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: landmark.colour, emissive: landmark.colour, emissiveIntensity: 0.35, flatShading: true }),
  );
  beacon.position.set(0, 3.1, -1.5);
  beacon.castShadow = true;
  island.add(beacon);
  group.add(island);
  return beacon;
}

interface UseWorldSceneOptions {
  mountRef: React.RefObject<HTMLDivElement | null>;
  onStart: () => void;
}

export function useWorldScene({ mountRef, onStart }: UseWorldSceneOptions) {
  const [activeLandmark, setActiveLandmark] = useState("THE START LINE");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.night);
    scene.fog = new THREE.Fog(palette.night, 25, 95);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 150);
    camera.position.set(0, 9, 15);

    let renderer: WebGPURenderer | THREE.WebGLRenderer;
    const initRenderer = (r: WebGPURenderer | THREE.WebGLRenderer) => {
      r.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFShadowMap;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.1;
      mount.appendChild(r.domElement);
      r.setAnimationLoop(animate);
    };

    try {
      renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });
      (renderer as WebGPURenderer).init()
        .then(() => initRenderer(renderer))
        .catch(() => {
          renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
          initRenderer(renderer);
        });
    } catch (error) {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
      initRenderer(renderer);
    }

    const ambient = new THREE.HemisphereLight(0xd9e5ff, 0x10111d, 2.4);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffe6b4, 4.2);
    keyLight.position.set(-12, 20, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -35;
    keyLight.shadow.camera.right = 35;
    keyLight.shadow.camera.top = 35;
    keyLight.shadow.camera.bottom = -35;
    scene.add(keyLight);

    const world = new THREE.Group();
    scene.add(world);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1),
      new THREE.MeshStandardMaterial({ color: palette.midnight, roughness: 1, flatShading: true }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    world.add(ground);

    for (let x = -24; x <= 24; x += 6) {
      addBlock(world, [x, -0.45, -24], [5.4, 0.9, 1.2], x % 12 === 0 ? palette.coral : palette.blue, x * 0.01);
    }
    for (let z = -18; z <= 18; z += 6) {
      addBlock(world, [-24, -0.45, z], [1.2, 0.9, 5.4], z % 12 === 0 ? palette.yellow : palette.green, z * 0.01);
    }

    addBlock(world, [2, 0.5, -4], [5, 1, 2], palette.coral, -0.12);
    addBlock(world, [5.3, 1.5, -4], [2, 3, 2], palette.coral, -0.12);
    addBlock(world, [8.2, 2.7, -4], [3.5, 0.7, 2], palette.yellow, -0.12);
    addBlock(world, [-3, 0.4, 6], [6, 0.8, 2], palette.blue, 0.1);
    addBlock(world, [-6, 1.2, 6], [2, 2.4, 2], palette.blue, 0.1);
    addBlock(world, [-8.8, 2.4, 6], [3.5, 0.6, 2], palette.yellow, 0.1);

    for (const tree of [[-15, -11, 1.1], [-11, -16, 0.8], [16, -12, 1.1], [18, 8, 0.9], [-15, 15, 1.1], [11, 15, 0.7]] as const) {
      addTree(world, tree[0], tree[1], tree[2]);
    }

    const landmarks: Landmark[] = [
      { position: new THREE.Vector3(-9, 0, -7), title: "Make something", label: "MAKE", colour: palette.coral },
      { position: new THREE.Vector3(10, 0, -8), title: "Wander somewhere", label: "WANDER", colour: palette.yellow },
      { position: new THREE.Vector3(9, 0, 10), title: "Play a little", label: "PLAY", colour: palette.blue },
    ];
    const beacons: THREE.Mesh[] = [];
    landmarks.forEach((landmark) => {
      const beacon = addLandmark(world, landmark);
      if (beacon) beacons.push(beacon);
    });

    const obstacles = [
      { x: 2, z: -4, halfX: 3.2, halfZ: 1.4 },
      { x: 5.3, z: -4, halfX: 1.3, halfZ: 1.4 },
      { x: 8.2, z: -4, halfX: 2.3, halfZ: 1.4 },
      { x: -3, z: 6, halfX: 3.3, halfZ: 1.4 },
      { x: -6, z: 6, halfX: 1.3, halfZ: 1.4 },
      { x: -8.8, z: 6, halfX: 2.3, halfZ: 1.4 },
      ...landmarks.map((landmark) => ({ x: landmark.position.x, z: landmark.position.z, halfX: 3.15, halfZ: 2.55 })),
    ];
    const collidesWithWorld = (position: THREE.Vector3) => obstacles.some((obstacle) =>
      Math.abs(position.x - obstacle.x) < obstacle.halfX + 0.88 && Math.abs(position.z - obstacle.z) < obstacle.halfZ + 1.05,
    );

    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.7), new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.75, flatShading: true }));
    body.position.y = 0.65;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.65, 1.4), new THREE.MeshStandardMaterial({ color: palette.paper, roughness: 0.55, flatShading: true }));
    cabin.position.set(0, 1.1, -0.1);
    cabin.castShadow = true;
    car.add(cabin);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: palette.yellow, flatShading: true }));
    bumper.position.set(0, 0.52, 1.36);
    car.add(bumper);
    [-0.78, 0.78].forEach((x) => [-0.82, 0.82].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8), new THREE.MeshStandardMaterial({ color: palette.ink, flatShading: true }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.38, z);
      wheel.castShadow = true;
      car.add(wheel);
    }));
    car.position.set(0, 0, 10);
    world.add(car);

    const controls: ControlState = { forward: false, backward: false, left: false, right: false };
    const velocity = new THREE.Vector3();
    const timer = new THREE.Timer();
    const targetCamera = new THREE.Vector3();
    const lookAhead = new THREE.Vector3();
    let lastLandmarkCheck = 0;
    const elapsedTimeRef = { current: 0 }; // we'll manage internally

    const keys: Record<string, keyof ControlState> = { ArrowUp: "forward", w: "forward", ArrowDown: "backward", s: "backward", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
    const keyDown = (event: KeyboardEvent) => {
      onStart();
      const key = keys[event.key];
      if (key) {
        controls[key] = true;
        event.preventDefault();
      }
    };
    const keyUp = (event: KeyboardEvent) => { const key = keys[event.key]; if (key) { controls[key] = false; event.preventDefault(); } };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const touchStartRef = { current: null as { x: number; y: number } | null };
    const touchControlsRef = { current: { forward: false, backward: false, left: false, right: false } };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch || !touchStartRef.current) return;
    
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const threshold = 20;
    
      touchControlsRef.current.left = dx < -threshold;
      touchControlsRef.current.right = dx > threshold;
      touchControlsRef.current.forward = dy < -threshold;
      touchControlsRef.current.backward = dy > threshold;
    };

    const handleTouchEnd = () => {
      touchStartRef.current = null;
      touchControlsRef.current = { forward: false, backward: false, left: false, right: false };
    };

    const shell = mount.closest(".three-world-shell") as HTMLElement | null;
    if (shell) {
      shell.addEventListener("touchstart", handleTouchStart, { passive: true });
      shell.addEventListener("touchmove", handleTouchMove, { passive: false });
      shell.addEventListener("touchend", handleTouchEnd);
      shell.addEventListener("touchcancel", handleTouchEnd);
    }

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    window.addEventListener("resize", resize);

    const checkLandmarks = () => {
      let next = "THE START LINE";
      landmarks.forEach((landmark) => {
        if (car.position.distanceTo(landmark.position) < 5.5) next = landmark.title;
      });
      setActiveLandmark((current) => current === next ? current : next);
    };

    function animate(timestamp?: number) {
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.04);
      elapsedTimeRef.current += delta;
      const mergedControls = {
        forward: controls.forward || touchControlsRef.current.forward,
        backward: controls.backward || touchControlsRef.current.backward,
        left: controls.left || touchControlsRef.current.left,
        right: controls.right || touchControlsRef.current.right,
      };
      const input = new THREE.Vector3(
        (mergedControls.right ? 1 : 0) - (mergedControls.left ? 1 : 0),
        0,
        (mergedControls.backward ? 1 : 0) - (mergedControls.forward ? 1 : 0)
      );
      if (input.lengthSq() > 0) {
        car.position.y = 0;
        input.normalize();
        velocity.x = THREE.MathUtils.damp(velocity.x, input.x * MAX_SPEED, ACCELERATION, delta);
        velocity.z = THREE.MathUtils.damp(velocity.z, input.z * MAX_SPEED, ACCELERATION, delta);
        car.rotation.y = THREE.MathUtils.damp(car.rotation.y, Math.atan2(velocity.x, velocity.z), 10, delta);
      } else {
        velocity.x = THREE.MathUtils.damp(velocity.x, 0, FRICTION, delta);
        velocity.z = THREE.MathUtils.damp(velocity.z, 0, FRICTION, delta);
        car.position.y = Math.sin(elapsedTimeRef.current * 2) * 0.05;
      }
      const previousPosition = car.position.clone();
      car.position.addScaledVector(velocity, delta);
      car.position.x = THREE.MathUtils.clamp(car.position.x, -WORLD_SIZE / 2 + 2, WORLD_SIZE / 2 - 2);
      car.position.z = THREE.MathUtils.clamp(car.position.z, -WORLD_SIZE / 2 + 2, WORLD_SIZE / 2 - 2);
      if (collidesWithWorld(car.position)) {
        car.position.copy(previousPosition);
        velocity.multiplyScalar(-0.18);
      }
      body.rotation.z = THREE.MathUtils.damp(body.rotation.z, -velocity.x * 0.035, 8, delta);
      for (const beacon of beacons) {
        beacon.rotation.y += delta * 2;
        const scale = 1 + Math.sin(elapsedTimeRef.current * 4) * 0.1;
        beacon.scale.setScalar(scale);
      }
      lookAhead.set(velocity.x * 0.15, 0, velocity.z * 0.15);
      targetCamera.set(car.position.x + lookAhead.x, 7.5, car.position.z + 12 + lookAhead.z);
      camera.position.lerp(targetCamera, 1 - Math.pow(0.001, delta));
      camera.lookAt(car.position.x + lookAhead.x, 0.8, car.position.z - 2 + lookAhead.z);
      if (elapsedTimeRef.current - lastLandmarkCheck > 0.5) {
        checkLandmarks();
        lastLandmarkCheck = elapsedTimeRef.current;
      }
      renderer.render(scene, camera);
    }

    return () => {
      if (renderer) renderer.setAnimationLoop(null);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", resize);
      if (shell) {
        shell.removeEventListener("touchstart", handleTouchStart);
        shell.removeEventListener("touchmove", handleTouchMove);
        shell.removeEventListener("touchend", handleTouchEnd);
        shell.removeEventListener("touchcancel", handleTouchEnd);
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [mountRef, onStart]);

  return { activeLandmark };
}