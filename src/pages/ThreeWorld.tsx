import { useCallback, useRef, useState } from "react";
import { useWorldScene } from "@/hooks/useWorldScene";

export default function ThreeWorld() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const handleStart = useCallback(() => setStarted(true), []);
  const { activeLandmark } = useWorldScene({
    mountRef,
    onStart: handleStart,
  });

  return (
    <main className="three-world-shell">
      <div ref={mountRef} className="three-world-canvas" aria-label="Interactive Signal Garden observatory" />
      <div className="world-vignette" />
      <header className="world-topbar">
        <button className="world-brand" onClick={() => window.location.reload()} aria-label="Restart Signal Garden"><span className="world-brand-mark">SG</span><span>SIGNAL GARDEN</span></button>
        <div className="world-status"><span className="status-pip" /> FIELD NODE 07 / LIVE</div>
        <div className="world-status world-status-right">{activeLandmark.toUpperCase()}</div>
      </header>
      <div className="world-hud">
        <span>ARROW KEYS / WASD</span><span>STEER THE HOVER-SKIFF</span>
      </div>
      <section className={`world-intro ${started ? "is-dismissed" : ""}`} aria-hidden={started}>
        <p className="world-kicker">AN INTERACTIVE OBSERVATORY / 07</p>
        <h1>Enter the<br /><i>signal garden.</i></h1>
        <p className="world-lede">A quiet 3D field for collecting ideas. Pilot a small hover-skiff between listening posts and tune into the parts of the portfolio that are usually hidden.</p>
        <button className="world-start" onClick={() => setStarted(true)}>Launch the skiff <span>↗</span></button>
        <p className="world-note">No route is marked. Follow the lights and make your own orbit.</p>
      </section>
      <aside className="world-legend" aria-label="Signal Garden stations"><span>ARCHIVE</span><span>STUDIO</span><span>LAB</span></aside>
      <footer className="world-footer"><span>THREE.JS / WEBGL / SIGNAL GARDEN</span><span>COLLECT A SIGNAL / FIND A THREAD</span></footer>
    </main>
  );
}
