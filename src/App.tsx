import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";

// Lazy-load the 3D world for better initial load performance
const ThreeWorld = lazy(() => import("@/pages/ThreeWorld"));

// Simple fallback while ThreeWorld is loading
const WorldLoading = () => (
  <div style={{
    minHeight: "100svh",
    display: "grid",
    placeItems: "center",
    background: "#111327",
    color: "#f5edd9",
    fontFamily: "'Space Mono', monospace",
    fontSize: "12px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  }}>
    Loading world…
  </div>
);

function Router() {
  return (
    <Suspense fallback={<WorldLoading />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/world" component={ThreeWorld} />
        <Route path="/404" component={NotFound} />
        {/* Catch-all route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="sidequest-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;