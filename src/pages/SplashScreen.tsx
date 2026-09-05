import type React from "react";
import { useRef } from "react";
import { useHandSplashAnimation } from "@/hooks/useHandSplashAnimation";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  const { loadError, skip } = useHandSplashAnimation({
    onComplete,
    mountRef,
    fadeRef,
    flashRef,
  });

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      skipRef.current?.focus();
    }
  };

  return (
    <div
      ref={fadeRef}
      className="splash-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Calibrating Signal Garden"
      aria-describedby="splash-loading-text"
      onKeyDown={handleDialogKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#050b14",
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div
        ref={flashRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          opacity: 0,
          mixBlendMode: "screen",
        }}
      />
      <div
        id="splash-loading-text"
        className="splash-overlay"
        style={{
          position: "absolute",
          bottom: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          color: "#f5edd9",
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.1em",
          zIndex: 3,
        }}
      >
        {loadError ? (
          <p style={{ fontSize: "12px", textTransform: "uppercase", color: "#f25d4d" }}>
            Hand failed to load. Press Skip to continue.
          </p>
        ) : (
          <p style={{ fontSize: "12px", textTransform: "uppercase" }}>
            Counting down…
          </p>
        )}
      </div>
      <button
        ref={skipRef}
        className="splash-skip-button"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 4,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#f5edd9",
          padding: "8px 16px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: "pointer",
          transition: "background 0.3s",
        }}
        onClick={skip}
        onMouseEnter={(event) =>
          (event.currentTarget.style.background = "rgba(255,255,255,0.2)")
        }
        onMouseLeave={(event) =>
          (event.currentTarget.style.background = "rgba(255,255,255,0.1)")
        }
      >
        Skip
      </button>
      <style>{`
        .splash-screen {
          transition: opacity 0.35s ease, visibility 0.35s ease;
          opacity: 1;
          visibility: visible;
        }
        .splash-screen.splash-fade-out {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .splash-flash-active {
          animation: splash-flash 110ms steps(2, end) both;
        }
        .splash-transition-active {
          animation: splash-transition 700ms cubic-bezier(.2,.8,.2,1) both;
        }
        @keyframes splash-flash {
          0% { opacity: 0; }
          35% { opacity: 0.78; }
          100% { opacity: 0; }
        }
        @keyframes splash-transition {
          0% {
            opacity: 0;
            clip-path: circle(0% at 50% 48%);
            transform: scale(0.8);
          }
          42% {
            opacity: 0.96;
            clip-path: circle(72% at 50% 48%);
            transform: scale(1);
          }
          100% {
            opacity: 0;
            clip-path: circle(150% at 50% 48%);
            transform: scale(1.08);
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
