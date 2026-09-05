import { lazy, Suspense, useState } from "react";
import SplashScreen from "./SplashScreen";

const ThreeWorld = lazy(() => import("./ThreeWorld"));

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      {/* 3D World lazy-loaded and rendered underneath (initializes early) */}
      {!showSplash && <Suspense
        fallback={
          <div
            style={{
              minHeight: "100svh",
              background: "#111327",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#f5edd9",
              fontFamily: "'Space Mono', monospace",
              fontSize: "10px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "2px solid rgba(245,237,217,0.2)",
                borderTopColor: "#f25d4d",
                borderRadius: "50%",
                animation: "world-loading-spin 0.8s linear infinite",
              }}
            />
            <p style={{ margin: 0 }}>Loading world…</p>
            <style>{`@keyframes world-loading-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        }
      >
        <ThreeWorld />
      </Suspense>}
      {/* Splash screen overlay */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}
