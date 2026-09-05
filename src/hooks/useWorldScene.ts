import { useEffect, useState } from "react";
import type React from "react";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const DESK_WIDTH = 50;
const DESK_DEPTH = 34;
const MAX_SPEED = 7.4;
const ACCELERATION = 13;
const FRICTION = 8;

const palette = {
  room: 0x080a13,
  wall: 0x121827,
  desk: 0x4a2f26,
  deskEdge: 0x281a1a,
  paper: 0xe7dfce,
  shadow: 0x090a12,
  monitor: 0x172b46,
  blue: 0x67c9e8,
  amber: 0xf0a45d,
  mint: 0x96e5c4,
  pink: 0xe986a8,
  mouse: 0xd8dde7,
  ink: 0x202536,
};

type ControlState = { forward: boolean; backward: boolean; left: boolean; right: boolean };
type DeskObject = { position: THREE.Vector3; title: string; label: string; colour: number; radius: number };

function mat(colour: number, emissive = 0, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: emissive, roughness, flatShading: true });
}

function block(group: THREE.Group, position: [number, number, number], size: [number, number, number], colour: number, rotation = 0, emissive = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(colour, emissive));
  mesh.position.set(...position);
  mesh.rotation.y = rotation;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function labelSprite(text: string, colour = "#e7dfce", background = "#121827") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = colour;
  context.lineWidth = 5;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = colour;
  context.font = "700 30px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(3.8, 0.84, 1);
  return sprite;
}

function drawCrtScreen(context: CanvasRenderingContext2D, width: number, height: number, status: string, energyActive: boolean, time: number) {
  context.imageSmoothingEnabled = true;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#091321");
  gradient.addColorStop(0.55, "#101827");
  gradient.addColorStop(1, "#1d1b27");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(239, 174, 103, 0.08)";
  context.fillRect(0, 0, width, height * 0.42);
  context.strokeStyle = "rgba(103, 201, 232, 0.16)";
  context.lineWidth = 2;
  for (let y = 0; y < height; y += 8) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  context.fillStyle = "#ffc078";
  context.font = "700 52px monospace";
  context.fillText("AFTER HOURS DESKTOP", 84, 86);
  context.fillStyle = "#fff4df";
  context.font = "700 34px monospace";
  context.fillText("STELIO KONTOS  /  DESIGN • CODE • 3D", 84, 143);
  context.fillStyle = "#8be0c6";
  context.font = "600 32px monospace";
  context.fillText(`SYSTEM STATUS: ${status}`, 84, 213);
  context.fillStyle = "#ff9fbe";
  context.fillText("CURRENT PROJECT: INTERACTIVE DESK WORLD", 84, 270);
  context.fillStyle = energyActive ? "#ffc078" : "#8edfff";
  context.fillText(energyActive ? "ENERGY SOURCE: DEADLINE JUICE / ACTIVE" : "ENERGY SOURCE: STANDBY", 84, 327);
  context.fillStyle = "#fff4df";
  context.font = "700 38px monospace";
  context.fillText("[ SELECTED WORK ]   [ PROCESS ]   [ ABOUT ]", 84, 407);
  context.fillStyle = "rgba(255, 244, 223, 0.86)";
  context.font = "28px monospace";
  context.fillText("BUILD STATUS: ALIVE, SOMEHOW", 84, 472);
  context.fillStyle = "#67c9e8";
  context.fillRect(84, 522, Math.max(180, ((Math.sin(time * 0.7) + 1) * 0.5) * 660), 8);
  if (Math.floor(time * 2) % 2 === 0) { context.fillStyle = "#ffc078"; context.fillRect(84, 578, 20, 32); }
}

function addKeyboard(group: THREE.Group, x: number, z: number) {
  const keyboard = new THREE.Group();
  keyboard.position.set(x, 0.65, z);
  keyboard.rotation.y = 0.05;
  block(keyboard, [0, 0, 0], [8.2, 0.32, 3.2], palette.ink, 0, 0.05);
  for (let row = 0; row < 4; row += 1) {
    const count = row === 3 ? 7 : 10;
    for (let column = 0; column < count; column += 1) {
      const keyWidth = row === 3 ? 0.86 : 0.62;
      const key = new THREE.Mesh(new THREE.BoxGeometry(keyWidth, 0.12, 0.4), mat(row === 0 ? palette.blue : palette.paper, row === 0 ? 0.22 : 0));
      key.position.set((column - (count - 1) / 2) * (row === 3 ? 0.98 : 0.7), 0.22, (row - 1.5) * 0.58);
      key.castShadow = true;
      keyboard.add(key);
    }
  }
  group.add(keyboard);
  return keyboard;
}

function addNotebook(group: THREE.Group, x: number, z: number) {
  const notebook = new THREE.Group();
  notebook.position.set(x, 0.55, z);
  notebook.rotation.y = -0.2;
  block(notebook, [0, 0.28, 0], [7.2, 0.4, 5.2], palette.ink, 0, 0.03);
  block(notebook, [0, 0.52, -0.04], [6.8, 0.08, 4.8], palette.paper);
  for (let i = 0; i < 4; i += 1) block(notebook, [-2.2 + i * 1.45, 0.59, -1.1], [0.8, 0.03, 0.08], i % 2 ? palette.pink : palette.blue, 0, 0.2);
  const label = labelSprite("FIELD LOG", "#e7dfce", "#202536");
  label.position.set(0, 0.66, 0.9);
  label.scale.set(2.25, 0.5, 1);
  notebook.add(label);
  group.add(notebook);
  return notebook;
}

function addFidget(group: THREE.Group, x: number, z: number) {
  const toy = new THREE.Group();
  toy.position.set(x, 0.6, z);
  for (let i = 0; i < 5; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.19, 8, 16), mat(i % 2 ? palette.mint : palette.pink, 0.2));
    ring.position.x = (i - 2) * 0.82;
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = i % 2 ? 0.15 : -0.15;
    ring.castShadow = true;
    toy.add(ring);
  }
  group.add(toy);
  return toy;
}

function addStickyNotes(group: THREE.Group, x: number, z: number) {
  const stack = new THREE.Group();
  stack.position.set(x, 0.5, z);
  for (let i = 0; i < 5; i += 1) {
    const note = block(stack, [i * 0.08, 0.18 + i * 0.1, -i * 0.04], [3.2, 0.13, 2.5], i % 2 ? palette.amber : palette.mint, -0.08 + i * 0.03);
    note.castShadow = true;
  }
  group.add(stack);
  return stack;
}

function addLamp(group: THREE.Group, x: number, z: number) {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0.5, z);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 6, 8), mat(palette.ink));
  stem.position.y = 3;
  lamp.add(stem);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 12, 1, true), mat(palette.amber, 0.5));
  shade.position.y = 6;
  shade.rotation.x = Math.PI;
  lamp.add(shade);
  const light = new THREE.PointLight(palette.amber, 10, 14, 2);
  light.position.y = 5.4;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.04;
  lamp.add(light);
  group.add(lamp);
  return lamp;
}

interface UseWorldSceneOptions {
  mountRef: React.RefObject<HTMLDivElement | null>;
  onStart: () => void;
}

export function useWorldScene({ mountRef, onStart }: UseWorldSceneOptions) {
  const [activeLandmark, setActiveLandmark] = useState("AT ARRIVAL");
  const [signalStrength, setSignalStrength] = useState(0);
  const [detectedObject, setDetectedObject] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.room);
    scene.fog = new THREE.Fog(palette.room, 34, 100);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
    camera.position.set(0, 24, 25);

    let renderer: WebGPURenderer | THREE.WebGLRenderer;
    const resize = () => { if (!renderer) return; const width = mount.clientWidth; const height = Math.max(mount.clientHeight, 1); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); };
    const initRenderer = (next: WebGPURenderer | THREE.WebGLRenderer) => { renderer = next; renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace; mount.appendChild(renderer.domElement); renderer.setAnimationLoop(animate); resize(); };
    try { const webgpu = new WebGPURenderer({ antialias: true, forceWebGL: false }); webgpu.init().then(() => initRenderer(webgpu)).catch(() => initRenderer(new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" }))); } catch { initRenderer(new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" })); }

    const ambient = new THREE.HemisphereLight(0x9bb9df, 0x120e16, 1.35);
    scene.add(ambient);
    const moonKey = new THREE.DirectionalLight(0x86a9d8, 2.2);
    moonKey.position.set(-18, 28, 16);
    moonKey.target.position.set(0, 0, -6);
    moonKey.castShadow = true;
    moonKey.shadow.mapSize.set(1024, 1024);
    moonKey.shadow.camera.left = -34;
    moonKey.shadow.camera.right = 34;
    moonKey.shadow.camera.top = 34;
    moonKey.shadow.camera.bottom = -28;
    moonKey.shadow.camera.near = 1;
    moonKey.shadow.camera.far = 90;
    moonKey.shadow.bias = -0.00035;
    moonKey.shadow.normalBias = 0.025;
    scene.add(moonKey, moonKey.target);
    const windowFill = new THREE.PointLight(0x5875b8, 2.1, 32, 2);
    windowFill.position.set(-15, 11, -18);
    scene.add(windowFill);
    const monitorGlow = new THREE.PointLight(palette.blue, 5.8, 22, 2);
    monitorGlow.position.set(2, 8, -12);
    scene.add(monitorGlow);
    const monitorRim = new THREE.PointLight(0x6e8cff, 1.8, 12, 2);
    monitorRim.position.set(5, 6, -6);
    scene.add(monitorRim);

    const room = new THREE.Group();
    scene.add(room);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(DESK_WIDTH, 1, DESK_DEPTH), mat(palette.desk, 0, 0.78));
    desk.position.y = -0.5;
    desk.receiveShadow = true;
    room.add(desk);
    block(room, [0, -1.25, -DESK_DEPTH / 2 + 0.25], [DESK_WIDTH, 0.5, 0.5], palette.deskEdge);
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(100, 60), new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 1 }));
    backWall.position.set(0, 8, -25);
    room.add(backWall);
    const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(19, 10), new THREE.MeshBasicMaterial({ color: 0x18253b, transparent: true, opacity: 0.85 }));
    windowGlow.position.set(-15, 11, -24.7);
    room.add(windowGlow);
    for (let i = 0; i < 18; i += 1) {
      const grain = block(room, [-22 + i * 2.5, 0.02, -16 + (i % 3) * 11], [1.1, 0.025, 0.035], i % 2 ? 0x674236 : 0x33211f, (i % 3) * 0.08);
      grain.castShadow = false;
    }

    const objects = new THREE.Group();
    room.add(objects);
    const monitor = new THREE.Group();
    monitor.position.set(2, 0, -11);
    objects.add(monitor);
    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 1920;
    screenCanvas.height = 772;
    const screenContext = screenCanvas.getContext("2d");
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.minFilter = THREE.LinearMipmapLinearFilter;
    screenTexture.magFilter = THREE.LinearFilter;
    screenTexture.anisotropy = 4;
    screenTexture.generateMipmaps = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(10.95, 4.4), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
    screen.position.set(0, 5.17, 1.13);
    monitor.add(screen);
    const screenGlow = new THREE.PointLight(palette.amber, 2.5, 9, 2);
    screenGlow.position.set(0, 5.1, 0.2);
    monitor.add(screenGlow);
    let isDisposed = false;
    const assetLoader = new GLTFLoader();
    assetLoader.load(
      "/Monitor.glb",
      (gltf) => {
        if (isDisposed) return;
        const asset = gltf.scene;
        asset.scale.set(12, 8, 5);
        asset.position.set(0, 0, 0);
        asset.rotation.y = 0;
        asset.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = false;
            object.receiveShadow = true;
          }
        });
        monitor.add(asset);
      },
      undefined,
      (error) => console.error("Unable to load Monitor.glb:", error),
    );
    addKeyboard(objects, 2, -2.3);
    const can = new THREE.Group();
    can.position.set(15, 0, -7);
    objects.add(can);
    const canGlow = new THREE.PointLight(palette.amber, 1.2, 5, 2);
    canGlow.position.set(0, 2.2, 0);
    can.add(canGlow);
    assetLoader.load("/Can.glb", (gltf) => {
      if (isDisposed) return;
      const asset = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(asset);
      const size = bounds.getSize(new THREE.Vector3());
      asset.scale.setScalar(2.8 / Math.max(size.y, 0.001));
      asset.rotation.y = -0.12;
      const scaledBounds = new THREE.Box3().setFromObject(asset);
      asset.position.y = -scaledBounds.min.y + 0.04;
      asset.position.x = -((scaledBounds.min.x + scaledBounds.max.x) / 2);
      asset.position.z = -((scaledBounds.min.z + scaledBounds.max.z) / 2);
      asset.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
      can.add(asset);
    }, undefined, (error) => console.warn("Can.glb is not available yet:", error));
    addNotebook(objects, -12, 1.5);
    addFidget(objects, 13, 7);
    addStickyNotes(objects, -18, -7);
    addLamp(objects, -19, -11);

    const deskObjects: DeskObject[] = [
      { position: new THREE.Vector3(2, 0, -11), title: "Selected work", label: "MONITOR", colour: palette.blue, radius: 6 },
      { position: new THREE.Vector3(2, 0, -2.3), title: "Process and skills", label: "KEYBOARD", colour: palette.mint, radius: 4 },
      { position: new THREE.Vector3(15, 0, -7), title: "About the maker", label: "DEADLINE JUICE", colour: palette.amber, radius: 3 },
      { position: new THREE.Vector3(-12, 0, 1.5), title: "Case studies", label: "NOTEBOOK", colour: palette.pink, radius: 4 },
      { position: new THREE.Vector3(13, 0, 7), title: "Experiments", label: "FIDGET TOY", colour: palette.mint, radius: 3 },
      { position: new THREE.Vector3(-18, 0, -7), title: "Ideas in progress", label: "STICKY NOTES", colour: palette.amber, radius: 3 },
    ];
    const mouse = new THREE.Group();
    const mouseBody = new THREE.Group();
    mouse.add(mouseBody);
    const sensor = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), new THREE.MeshBasicMaterial({ color: palette.pink }));
    sensor.rotation.x = -Math.PI / 2;
    sensor.position.y = 0.56;
    mouse.add(sensor);
    const mouseGlow = new THREE.PointLight(palette.pink, 1.5, 3, 2);
    mouseGlow.position.y = 0.3;
    mouse.add(mouseGlow);
    mouse.position.set(0, 0, 11);
    room.add(mouse);
    const mouseLoader = new GLTFLoader();
    mouseLoader.load(
      "/Mouse.glb",
      (gltf) => {
        if (isDisposed) return;
        const asset = gltf.scene;
        asset.scale.setScalar(2.6);
        asset.position.set(0, 0.06, 0);
        asset.rotation.y = 0;
        asset.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        mouseBody.add(asset);
      },
      undefined,
      (error) => console.error("Unable to load Mouse.glb:", error),
    );

    const controls: ControlState = { forward: false, backward: false, left: false, right: false };
    const velocity = new THREE.Vector3();
    const timer = new THREE.Timer();
    const targetCamera = new THREE.Vector3();
    const lookAhead = new THREE.Vector3();
    const elapsed = { current: 0 };
    let lastCheck = 0;
    let lastScreenDraw = -1;
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
    window.addEventListener("resize", resize);

    const checkObjects = () => {
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      deskObjects.forEach((object, index) => { const distance = mouse.position.distanceTo(object.position); if (distance < nearestDistance) { nearestIndex = index; nearestDistance = distance; } });
      const nearest = nearestIndex >= 0 ? deskObjects[nearestIndex] : null;
      const strength = nearest ? THREE.MathUtils.clamp(100 - nearestDistance * 17, 0, 100) : 0;
      setSignalStrength(Math.round(strength));
      setDetectedObject(nearest && nearestDistance < nearest.radius ? nearest.label : null);
      setActiveLandmark(nearest && nearestDistance < nearest.radius ? nearest.title : "SCANNING DESK");
    };

    function animate(timestamp?: number) {
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.04);
      elapsed.current += delta;
      const active = { forward: controls.forward || touchControls.forward, backward: controls.backward || touchControls.backward, left: controls.left || touchControls.left, right: controls.right || touchControls.right };
      const input = new THREE.Vector3((active.right ? 1 : 0) - (active.left ? 1 : 0), 0, (active.backward ? 1 : 0) - (active.forward ? 1 : 0));
      if (input.lengthSq() > 0) { input.normalize(); velocity.x = THREE.MathUtils.damp(velocity.x, input.x * MAX_SPEED, ACCELERATION, delta); velocity.z = THREE.MathUtils.damp(velocity.z, input.z * MAX_SPEED, ACCELERATION, delta); mouse.rotation.y = THREE.MathUtils.damp(mouse.rotation.y, Math.atan2(velocity.x, velocity.z), 9, delta); } else { velocity.x = THREE.MathUtils.damp(velocity.x, 0, FRICTION, delta); velocity.z = THREE.MathUtils.damp(velocity.z, 0, FRICTION, delta); }
      const previous = mouse.position.clone();
      mouse.position.addScaledVector(velocity, delta);
      mouse.position.x = THREE.MathUtils.clamp(mouse.position.x, -DESK_WIDTH / 2 + 2, DESK_WIDTH / 2 - 2);
      mouse.position.z = THREE.MathUtils.clamp(mouse.position.z, -DESK_DEPTH / 2 + 2, DESK_DEPTH / 2 - 2);
      if (mouse.position.z < -DESK_DEPTH / 2 + 2) mouse.position.copy(previous);
      mouse.position.y = Math.sin(elapsed.current * 3) * 0.035;
      mouseBody.rotation.z = THREE.MathUtils.damp(mouseBody.rotation.z, -velocity.x * 0.04, 8, delta);
      sensor.material.color.setHex(elapsed.current % 1.8 > 0.9 ? palette.pink : palette.blue);
      mouseGlow.color.setHex(elapsed.current % 1.8 > 0.9 ? palette.pink : palette.blue);
      const monitorDistance = mouse.position.distanceTo(monitor.position);
      const monitorProximity = THREE.MathUtils.clamp(1 - monitorDistance / 10, 0, 1);
      const canDistance = mouse.position.distanceTo(can.position);
      const canProximity = THREE.MathUtils.clamp(1 - canDistance / 5, 0, 1);
      if (screenContext && elapsed.current - lastScreenDraw >= 1 / 12) {
        drawCrtScreen(screenContext, screenCanvas.width, screenCanvas.height, monitorProximity > 0.35 ? "USER DETECTED" : "IDLE / WAITING", canProximity > 0.2, elapsed.current);
        screenTexture.needsUpdate = true;
        lastScreenDraw = elapsed.current;
      }
      screenGlow.intensity = 2.2 + monitorProximity * 2.4;
      canGlow.intensity = 1.2 + canProximity * 3.5;
      monitorGlow.intensity = 5.8 + monitorProximity * 2.4 + Math.sin(elapsed.current * 1.5) * 0.35;
      lookAhead.set(velocity.x * 0.35, 0, velocity.z * 0.35);
      targetCamera.set(mouse.position.x + lookAhead.x, 23, mouse.position.z + 23 + lookAhead.z);
      camera.position.lerp(targetCamera, 1 - Math.pow(0.001, delta));
      camera.lookAt(mouse.position.x + lookAhead.x, 0, mouse.position.z - 1 + lookAhead.z);
      if (elapsed.current - lastCheck > 0.35) { checkObjects(); lastCheck = elapsed.current; }
      renderer?.render(scene, camera);
    }

    return () => {
      isDisposed = true;
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

  return { activeLandmark, signalStrength, detectedObject };
}
