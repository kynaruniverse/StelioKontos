import { useState } from "react";
import ThreeWorld from "./ThreeWorld";
import SplashScreen from "./SplashScreen";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <>
      {/* 3D World always rendered underneath (so it can initialize early) */}
      <ThreeWorld />
      {/* Splash screen overlay */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}