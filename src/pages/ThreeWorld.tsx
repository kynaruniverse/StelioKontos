import { useCallback, useRef, useState } from "react";
import { useWorldScene } from "@/hooks/useWorldScene";

export default function ThreeWorld() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const handleStart = useCallback(() => setStarted(true), []);
  const { activeLandmark, signalStrength, detectedObject } = useWorldScene({
    mountRef,
    onStart: handleStart,
  });

  return (
    <main className="three-world-shell">
      <div ref={mountRef} className="three-world-canvas" aria-label="Interactive After Hours Desktop workspace" />
      <div className="world-vignette" />
      <header className="world-topbar">
        <button className="world-brand" onClick={() => window.location.reload()} aria-label="Restart After Hours Desktop">
          <span className="world-brand-mark">AH</span><span>AFTER HOURS</span>
        </button>
        <div className="world-status"><span className="status-pip" /> WORKSPACE SESSION / 01</div>
        <div className="world-status world-status-right">POINTER {activeLandmark.toUpperCase()}</div>
      </header>
      <div className="world-hud">
        <span>ARROW KEYS / WASD</span><span>DRAG TO GLIDE</span>
      </div>
      <section className={`world-intro ${started ? "is-dismissed" : ""}`} aria-hidden={started}>
        <p className="world-kicker">A PLAYABLE PORTFOLIO / DESK VIEW</p>
        <h1>Welcome to the<br /><i>workspace.</i></h1>
        <p className="world-lede">Move the pointer through a lived-in creative desk. Open what catches your eye and explore the work between the objects.</p>
        <button className="world-start" onClick={() => setStarted(true)}>Enter workspace <span>↗</span></button>
        <p className="world-note">Late night / monitor awake / ideas in progress</p>
      </section>
      <aside className="world-instrument" aria-live="polite">
        <div className="instrument-label">POINTER STATUS</div>
        <div className="instrument-value"><span className="instrument-dot" /> ONLINE</div>
        <div className="instrument-meter"><span style={{ width: `${signalStrength}%` }} /></div>
        <div className="instrument-meta"><span>{detectedObject ? "OBJECT DETECTED" : "SCANNING DESK"}</span><strong>{detectedObject ?? "NO SIGNAL"}</strong></div>
      </aside>
      <aside className="world-legend" aria-label="Workspace objects"><span>NOTEBOOK / CASE STUDIES</span><span>MONITOR / SELECTED WORK</span><span>MUG / ABOUT</span></aside>
      <footer className="world-footer"><span>THREE.JS / WEBGL / AFTER HOURS DESKTOP</span><span>MOVE THE POINTER / FIND THE WORK</span></footer>
    </main>
  );
}
