# SIGNAL GARDEN

An interactive portfolio observatory built around a quiet, nocturnal field of signals. Navigate a floating hover-skiff through orbital rings, antenna towers, signal trails, and three broadcast stations that reveal different parts of the work.

## Features

- **Interactive 3D Observatory** – Explore a procedural Signal Garden with three stations: Archive, Studio, and Lab.
- **Hover-Skiff Navigation** – Use arrow keys / WASD on desktop, or drag on touch devices to steer the floating skiff.
- **Animated Splash Screen** – A holographic hand assembles from particles before fading into the observatory.
- **Accessibility** – Focus management, error boundaries, responsive layout, and reduced-motion support.

## Tech Stack

- React 19 + TypeScript
- Three.js with WebGPU and WebGL fallback
- Vite for bundling
- Tailwind CSS v4 for styling
- Express for production serving
- Wouter for lightweight routing

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` to view the app.

For a production build:

```bash
pnpm build
pnpm start
```

## Project Structure

```text
├── public/               # Static assets (favicon, 3D model)
├── server/               # Express server for production
└── src/
    ├── components/       # Reusable components
    ├── contexts/         # Theme context
    ├── hooks/             # Splash and Three.js scene logic
    ├── pages/             # Home, SplashScreen, ThreeWorld, NotFound
    ├── styles/            # Global and page-level styles
    ├── App.tsx            # Main app with routing
    └── main.tsx           # Entry point
```

## License

MIT © Charles Blackwood
