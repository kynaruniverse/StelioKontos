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
      <Suspense fallback={<div style={{ minHeight: "100svh", background: "#111327" }} />}>
        <ThreeWorld />
      </Suspense>
      {/* Splash screen overlay */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}