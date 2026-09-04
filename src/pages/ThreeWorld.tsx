import { useRef, useState } from "react";
import { useWorldScene } from "@/hooks/useWorldScene";

type ControlState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

export default function ThreeWorld() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const { activeLandmark } = useWorldScene({
    mountRef,
    onStart: () => setStarted(true),
  });

  const press = (control: keyof ControlState, value: boolean) => {
    window.dispatchEvent(new KeyboardEvent(value ? "keydown" : "keyup", { key: control === "forward" ? "w" : control === "backward" ? "s" : control === "left" ? "a" : "d" }));
  };

  return (
    <main className="three-world-shell">
      <div ref={mountRef} className="three-world-canvas" aria-label="Interactive low-poly Sidequest world" />
      <div className="world-vignette" />
      <header className="world-topbar">
        <button className="world-brand" onClick={() => window.location.reload()} aria-label="Restart Sidequest world"><span className="world-brand-mark">SQ</span><span>SIDEQUEST</span></button>
        <div className="world-status"><span className="status-pip" /> QUEST 001 / ONLINE</div>
        <div className="world-status world-status-right">{activeLandmark.toUpperCase()}</div>
      </header>
      <div className="world-hud">
        <span>ARROW KEYS / WASD</span><span>EXPLORE THE ISLAND</span>
      </div>
      <section className={`world-intro ${started ? "is-dismissed" : ""}`} aria-hidden={started}>
        <p className="world-kicker">A SIDEQUEST ORIGINAL / 001</p>
        <h1>You found a<br /><i>side quest.</i></h1>
        <p className="world-lede">A small interactive world for tiny ideas, curious detours, and play without a point. Drive around and find your next direction.</p>
        <button className="world-start" onClick={() => setStarted(true)}>Start exploring <span>↗</span></button>
        <p className="world-note">No download. No account. Just a browser and a direction.</p>
      </section>
      <aside className="world-legend" aria-label="World landmarks"><span>MAKE</span><span>WANDER</span><span>PLAY</span></aside>
      <footer className="world-footer"><span>THREE.JS / WEBGL / SIDEQUEST FIELD NOTES</span><span>DRIVE TO A COLOUR / FIND A DIRECTION</span></footer>
    </main>
  );
}