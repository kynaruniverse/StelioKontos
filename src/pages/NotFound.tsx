import { Home, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="not-found-shell">
      <div className="not-found-card">
        <div className="not-found-icon">
          <AlertTriangle size={40} strokeWidth={2.5} />
        </div>
        <p className="hero-kicker" style={{ justifyContent: "center", marginBottom: "12px" }}>
          <span className="status-dot status-dot-red" />
          ERROR / 404
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="not-found-title"
          style={{ outline: "none" }}
        >
          You wandered<br />
          <i>off the map.</i>
        </h1>
        <p className="not-found-copy">
          The page you’re looking for doesn’t exist, or it took a side
          quest of its own. Let’s get you back to familiar ground.
        </p>
        <button className="sq-button sq-button-red" onClick={handleGoHome}>
          <Home size={16} />
          Return home
        </button>
      </div>

      <style>{`
        .not-found-shell {
          min-height: 100svh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: var(--night);
          color: var(--paper);
          font-family: "Space Grotesk", Arial, sans-serif;
          overflow: hidden;
          position: relative;
        }

        .not-found-shell::before {
          content: "";
          position: absolute;
          width: 600px;
          height: 600px;
          border: 2px dashed rgba(var(--paper-light-rgb), 0.15);
          border-radius: 50%;
          transform: rotate(25deg);
          pointer-events: none;
        }

        .not-found-card {
          position: relative;
          z-index: 1;
          max-width: 480px;
          width: 100%;
          padding: 44px 32px;
          text-align: center;
          border: 1px solid var(--paper);
          background: rgba(var(--ink-rgb), 0.8);
          box-shadow: 10px 10px 0 var(--coral);
          backdrop-filter: blur(10px);
          transform: rotate(-1.5deg);
        }

        .not-found-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
          background: var(--yellow);
          color: var(--ink);
          border: 1px solid var(--ink);
          box-shadow: 5px 5px 0 var(--coral);
          transform: rotate(-6deg);
        }

        .not-found-title {
          margin: 0 0 18px;
          font-family: "DM Serif Display", Georgia, serif;
          font-size: clamp(48px, 9vw, 76px);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.06em;
          color: var(--paper);
        }

        .not-found-title i {
          color: var(--coral);
          font-style: italic;
        }

        .not-found-copy {
          max-width: 340px;
          margin: 0 auto 32px;
          color: rgba(var(--paper-light-rgb), 0.7);
          font-size: 13px;
          line-height: 1.7;
        }

        .sq-button-red {
          background: var(--coral);
          color: var(--ink);
          box-shadow: 5px 5px 0 var(--yellow);
        }

        .sq-button-red:hover {
          background: var(--blue);
          color: var(--paper);
          box-shadow: 2px 2px 0 var(--yellow);
          transform: translate(2px, 2px);
        }

        .sq-button-red:active {
          transform: translate(5px, 5px);
          box-shadow: 0 0 0 var(--yellow);
        }
      `}</style>
    </div>
  );
}