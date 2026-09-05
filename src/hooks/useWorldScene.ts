import { useEffect, useState } from "react";
import type React from "react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";

const FIELD_SIZE = 58;
const MAX_SPEED = 8.5;
const ACCELERATION = 12;
const FRICTION = 7;

const palette = {
  space: 0x070b1d,
  field: 0x10183a,
  slate: 0x1b2751,
  ink: 0x050712,
  cloud: 0xeaf1ff,
  cyan: 0x62e5e6,
  lime: 0xd6f36a,
  violet: 0xa78bfa,
  pink: 0xf28cb8,
};

type Landmark = {
  position: THREE.Vector3;
  title: string;
  label: string;
  colour: number;
};

type ControlState = { forward: boolean; backward: boolean; left: boolean; right: boolean };

function textSprite(text: string, colour = "#eaf1ff", background = "#10183a") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = colour;
  context.lineWidth = 5;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = colour;
  context.font = "700 32px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(4.1, 1.02, 1);
  return sprite;
}

function material(colour: number, emissive = 0) {
  return new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: emissive, roughness: 0.82, flatShading: true });
}

function addBlock(group: THREE.Group, position: [number, number, number], size: [number, number, number], colour: number, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(colour));
  mesh.position.set(...position);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addStation(group: THREE.Group, landmark: Landmark) {
  const station = new THREE.Group();
  station.position.copy(landmark.position);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.55, 8), material(palette.slate));
  plinth.position.y = -0.25;
  plinth.rotation.y = Math.PI / 8;
  plinth.receiveShadow = true;
  station.add(plinth);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.7, 2.8, 6), material(palette.field));
  core.position.y = 1.2;
  core.castShadow = true;
  station.add(core);
  for (let i = 0; i < 3; i += 1) {
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.1, 0.12), material(landmark.colour, 0.5));
    rod.position.set(Math.cos(i * Math.PI * 2 / 3) * 1.65, 2.2, Math.sin(i * Math.PI * 2 / 3) * 1.65);
    rod.rotation.z = Math.cos(i * Math.PI * 2 / 3) * 0.3;
    rod.rotation.x = Math.sin(i * Math.PI * 2 / 3) * 0.3;
    station.add(rod);
  }
  const beacon = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 1), material(landmark.colour, 1.1));
  beacon.position.y = 4.35;
  beacon.castShadow = true;
  station.add(beacon);
  const sign = textSprite(landmark.label, "#eaf1ff", "#10183a");
  sign.position.set(0, 5.5, 0);
  station.add(sign);
  group.add(station);
  return { beacon, station };
}

function addSignalLine(group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, colour: number) {
  const points = [from.clone().setY(0.12), new THREE.Vector3((from.x + to.x) / 2, 1.6, (from.z + to.z) / 2), to.clone().setY(0.12)];
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.68 }));
  group.add(line);
}

interface UseWorldSceneOptions {
  mountRef: React.RefObject<HTMLDivElement | null>;
  onStart: () => void;
}

export function useWorldScene({ mountRef, onStart }: UseWorldSceneOptions) {
  const [activeLandmark, setActiveLandmark] = useState("THE ARRIVAL DECK");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.space);
    scene.fog = new THREE.Fog(palette.space, 28, 105);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 160);
    camera.position.set(0, 9.5, 15);

    let renderer: WebGPURenderer | THREE.WebGLRenderer;
    const initRenderer = (nextRenderer: WebGPURenderer | THREE.WebGLRenderer) => {
      renderer = nextRenderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      mount.appendChild(renderer.domElement);
      renderer.setAnimationLoop(animate);
      resize();
    };
    try {
      const webgpu = new WebGPURenderer({ antialias: true, forceWebGL: false });
      webgpu.init().then(() => initRenderer(webgpu)).catch(() => initRenderer(new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" })));
    } catch {
      initRenderer(new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" }));
    }

    scene.add(new THREE.HemisphereLight(0xb7d8ff, palette.ink, 2.4));
    const keyLight = new THREE.DirectionalLight(0xc5f7ff, 3.5);
    keyLight.position.set(-14, 22, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -35;
    keyLight.shadow.camera.right = 35;
    keyLight.shadow.camera.top = 35;
    keyLight.shadow.camera.bottom = -35;
    scene.add(keyLight);

    const field = new THREE.Group();
    scene.add(field);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(FIELD_SIZE / 2, 48), material(palette.field));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    field.add(ground);
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(25.6, 26, 64), new THREE.MeshBasicMaterial({ color: palette.cyan, transparent: true, opacity: 0.48, side: THREE.DoubleSide }));
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.04;
    field.add(outerRing);
    for (let i = 0; i < 12; i += 1) {
      const angle = i * Math.PI / 6;
      const x = Math.cos(angle) * 23;
      const z = Math.sin(angle) * 23;
      addBlock(field, [x, 0.18, z], [0.22, 0.36, 2.4], i % 2 ? palette.violet : palette.cyan, -angle);
    }
    for (let i = 0; i < 70; i += 1) {
      const angle = i * 2.399;
      const radius = 6 + ((i * 17) % 190) / 10;
      const star = new THREE.Mesh(new THREE.SphereGeometry(i % 5 === 0 ? 0.11 : 0.055, 6, 4), material(i % 3 === 0 ? palette.lime : palette.cloud, 0.8));
      star.position.set(Math.cos(angle) * radius, 0.08 + (i % 4) * 0.04, Math.sin(angle) * radius);
      field.add(star);
    }

    const landmarks: Landmark[] = [
      { position: new THREE.Vector3(-10, 0, -8), title: "Archive frequency", label: "ARCHIVE", colour: palette.cyan },
      { position: new THREE.Vector3(11, 0, -7), title: "Studio frequency", label: "STUDIO", colour: palette.pink },
      { position: new THREE.Vector3(8, 0, 10), title: "Lab frequency", label: "LAB", colour: palette.lime },
    ];
    const stations = landmarks.map((landmark) => addStation(field, landmark));
    landmarks.forEach((landmark) => addSignalLine(field, new THREE.Vector3(0, 0, 11), landmark.position, landmark.colour));
    addSignalLine(field, landmarks[0].position, landmarks[1].position, palette.violet);
    addSignalLine(field, landmarks[1].position, landmarks[2].position, palette.cyan);

    const antenna = new THREE.Group();
    antenna.position.set(-1, 0, -1);
    const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 5.5, 8), material(palette.slate));
    antennaStem.position.y = 2.75;
    antenna.add(antennaStem);
    const antennaDish = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(palette.violet, 0.3));
    antennaDish.position.y = 5.5;
    antennaDish.rotation.x = -0.45;
    antenna.add(antennaDish);
    field.add(antenna);

    const skiff = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 1.7, 4, 10), material(palette.cloud));
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.72;
    hull.castShadow = true;
    skiff.add(hull);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.56, 12, 6), material(palette.violet, 0.25));
    canopy.scale.set(1, 0.5, 1.35);
    canopy.position.set(0, 1.18, -0.18);
    canopy.castShadow = true;
    skiff.add(canopy);
    [-0.72, 0.72].forEach((x) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.65), material(palette.cyan, 0.55));
      fin.position.set(x, 0.42, 0.12);
      fin.rotation.z = x < 0 ? -0.12 : 0.12;
      skiff.add(fin);
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: palette.cyan, transparent: true, opacity: 0.85 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.22;
    skiff.add(halo);
    skiff.position.set(0, 0, 11);
    field.add(skiff);

    const controls: ControlState = { forward: false, backward: false, left: false, right: false };
    const velocity = new THREE.Vector3();
    const timer = new THREE.Timer();
    const targetCamera = new THREE.Vector3();
    const lookAhead = new THREE.Vector3();
    const elapsed = { current: 0 };
    let lastCheck = 0;
    const keys: Record<string, keyof ControlState> = { ArrowUp: "forward", w: "forward", ArrowDown: "backward", s: "backward", ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right" };
    const keyDown = (event: KeyboardEvent) => { const key = keys[event.key]; if (key) { controls[key] = true; onStart(); event.preventDefault(); } };
    const keyUp = (event: KeyboardEvent) => { const key = keys[event.key]; if (key) { controls[key] = false; event.preventDefault(); } };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const touchStart = { current: null as { x: number; y: number } | null };
    const touchControls: ControlState = { forward: false, backward: false, left: false, right: false };
    const handleTouchStart = (event: TouchEvent) => { const touch = event.touches[0]; if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }; };
    const handleTouchMove = (event: TouchEvent) => { event.preventDefault(); const touch = event.touches[0]; if (!touch || !touchStart.current) return; const dx = touch.clientX - touchStart.current.x; const dy = touch.clientY - touchStart.current.y; touchControls.left = dx < -20; touchControls.right = dx > 20; touchControls.forward = dy < -20; touchControls.backward = dy > 20; };
    const handleTouchEnd = () => { touchStart.current = null; Object.keys(touchControls).forEach((key) => { touchControls[key as keyof ControlState] = false; }); };
    const shell = mount.closest(".three-world-shell");
    shell?.addEventListener("touchstart", handleTouchStart as EventListener, { passive: true });
    shell?.addEventListener("touchmove", handleTouchMove as EventListener, { passive: false });
    shell?.addEventListener("touchend", handleTouchEnd);
    shell?.addEventListener("touchcancel", handleTouchEnd);

    const resize = () => { if (!renderer) return; const width = mount.clientWidth; const height = Math.max(mount.clientHeight, 1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); };
    window.addEventListener("resize", resize);
    const checkLandmarks = () => { let next = "THE ARRIVAL DECK"; landmarks.forEach((landmark) => { if (skiff.position.distanceTo(landmark.position) < 5.6) next = landmark.title; }); setActiveLandmark((current) => current === next ? current : next); };

    function animate(timestamp?: number) {
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.04);
      elapsed.current += delta;
      const active = { forward: controls.forward || touchControls.forward, backward: controls.backward || touchControls.backward, left: controls.left || touchControls.left, right: controls.right || touchControls.right };
      const input = new THREE.Vector3((active.right ? 1 : 0) - (active.left ? 1 : 0), 0, (active.backward ? 1 : 0) - (active.forward ? 1 : 0));
      if (input.lengthSq() > 0) { input.normalize(); velocity.x = THREE.MathUtils.damp(velocity.x, input.x * MAX_SPEED, ACCELERATION, delta); velocity.z = THREE.MathUtils.damp(velocity.z, input.z * MAX_SPEED, ACCELERATION, delta); skiff.rotation.y = THREE.MathUtils.damp(skiff.rotation.y, Math.atan2(velocity.x, velocity.z), 8, delta); } else { velocity.x = THREE.MathUtils.damp(velocity.x, 0, FRICTION, delta); velocity.z = THREE.MathUtils.damp(velocity.z, 0, FRICTION, delta); }
      const previous = skiff.position.clone();
      skiff.position.addScaledVector(velocity, delta);
      skiff.position.x = THREE.MathUtils.clamp(skiff.position.x, -FIELD_SIZE / 2 + 2, FIELD_SIZE / 2 - 2);
      skiff.position.z = THREE.MathUtils.clamp(skiff.position.z, -FIELD_SIZE / 2 + 2, FIELD_SIZE / 2 - 2);
      if (skiff.position.length() > FIELD_SIZE / 2 - 1) skiff.position.copy(previous);
      skiff.position.y = Math.sin(elapsed.current * 2.4) * 0.12;
      hull.rotation.z = THREE.MathUtils.damp(hull.rotation.z, -velocity.x * 0.04, 7, delta);
      halo.rotation.z += delta * 1.5;
      stations.forEach(({ beacon, station }) => { beacon.rotation.y += delta * 2; beacon.position.y = 4.35 + Math.sin(elapsed.current * 3 + station.position.x) * 0.16; });
      antenna.rotation.y += delta * 0.18;
      lookAhead.set(velocity.x * 0.3, 0, velocity.z * 0.3);
      targetCamera.set(skiff.position.x + lookAhead.x, 8.8, skiff.position.z + 12 + lookAhead.z);
      camera.position.lerp(targetCamera, 1 - Math.pow(0.001, delta));
      camera.lookAt(skiff.position.x + lookAhead.x, 0.8, skiff.position.z - 2 + lookAhead.z);
      if (elapsed.current - lastCheck > 0.45) { checkLandmarks(); lastCheck = elapsed.current; }
      renderer?.render(scene, camera);
    }

    return () => {
      renderer?.setAnimationLoop(null);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", resize);
      shell?.removeEventListener("touchstart", handleTouchStart as EventListener);
      shell?.removeEventListener("touchmove", handleTouchMove as EventListener);
      shell?.removeEventListener("touchend", handleTouchEnd);
      shell?.removeEventListener("touchcancel", handleTouchEnd);
      scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((item) => { item.map?.dispose(); item.dispose(); }); } if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); } });
      renderer?.dispose();
      if (renderer && mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [mountRef, onStart]);

  return { activeLandmark };
}
