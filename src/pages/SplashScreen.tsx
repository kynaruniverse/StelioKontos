import type React from "react";
import { useRef } from "react";
import { useHandSplashAnimation } from "@/hooks/useHandSplashAnimation";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);

  const { loadError, skip } = useHandSplashAnimation({
    onComplete,
    mountRef,
    fadeRef,
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
      aria-label="Loading Sidequest world"
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
        }}
      >
        {loadError ? (
          <p style={{ fontSize: "12px", textTransform: "uppercase", color: "#f25d4d" }}>
            Hologram failed to load. Press Skip to continue.
          </p>
        ) : (
          <>
            <div
              className="splash-progress-bar"
              style={{
                width: "200px",
                height: "4px",
                background: "rgba(255,255,255,0.2)",
                margin: "0 auto 10px",
              }}
            >
              <div
                className="splash-progress-fill"
                style={{
                  width: "0%",
                  height: "100%",
                  background: "#f5d44f",
                  animation: "splash-progress 7s linear forwards",
                }}
              />
            </div>
            <p style={{ fontSize: "12px", textTransform: "uppercase" }}>
              Preparing gesture…
            </p>
          </>
        )}
      </div>
      <button
        ref={skipRef}
        className="splash-skip-button"
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
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
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
        }
      >
        Skip
      </button>
      <style>{`
        @keyframes splash-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .splash-screen {
          transition: opacity 1s ease, visibility 1s ease;
          opacity: 1;
          visibility: visible;
        }
        .splash-screen.splash-fade-out {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;