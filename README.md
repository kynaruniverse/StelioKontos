# SIDEQUEST

A tiny open-web arcade for curious people, small ideas, and playful detours. Explore a low‑poly 3D world, drive around, and find your next direction — no account, no download, just a browser and a direction.

---

## Features

- **Interactive 3D World** – Drive a little car around a stylized island with obstacles, landmarks, and hidden pockets of color.
- **Animated Splash Screen** – A holographic hand assembles from particles, makes a fist, and extends a certain finger before fading out.
- **Responsive Controls** – Use arrow keys / WASD on desktop, or drag on touch devices.
- **Accessibility** – Focus management, error boundaries, and reduced-motion support.
- **Dark Mode** – Toggle between light and dark themes (currently dark by default).

---

## Tech Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Three.js](https://threejs.org/) (WebGPU with WebGL fallback)
- [Vite](https://vitejs.dev/) for bundling and development
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [Express](https://expressjs.com/) for production serving
- [Wouter](https://github.com/molefrog/wouter) for lightweight routing

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd <repo-folder>

# Install dependencies
pnpm install
```

Development

```bash
pnpm dev
```

Open http://localhost:3000 to view the app.

Build for Production

```bash
pnpm build
```

This creates a dist/ folder with the static site and a production server (dist/index.js).

Run Production Server

```bash
pnpm start
```

The server listens on port 3000 by default (configurable via PORT environment variable).

---

Available Scripts

Script Description
dev Start the Vite development server with HMR
build Build the frontend and bundle the server
start Run the production server (after building)
preview Preview the Vite build locally
check Type-check the entire project (no emit)
test Run unit tests with Vitest
format Format all files with Prettier

---

Deployment

Vercel

1. Push your code to a Git repository.
2. Import the project into Vercel.
3. The vercel.json file already configures SPA fallback and static asset handling.

Self‑hosted / Node

```bash
pnpm build
pnpm start
```

Make sure to set the PORT environment variable if you need a different port.

---

Project Structure

```
├── public/               # Static assets (favicon, 3D model)
├── server/               # Express server for production
├── src/
│   ├── components/       # Reusable UI components (ErrorBoundary, ui)
│   ├── contexts/         # ThemeContext
│   ├── lib/              # Utility functions
│   ├── pages/            # Home, SplashScreen, ThreeWorld, NotFound
│   ├── styles/           # CSS files (base, components, loader, threeworld)
│   ├── App.tsx           # Main app with routing
│   ├── index.css         # Global styles
│   └── main.tsx          # Entry point
├── index.html            # HTML template
└── vite.config.ts        # Vite configuration
```

---

License

MIT © Charles Blackwood