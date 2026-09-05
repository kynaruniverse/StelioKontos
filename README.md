# AFTER HOURS DESKTOP

An interactive portfolio hidden inside a lived-in bedroom workspace. Navigate a computer mouse across a stylized desk, discover the objects around it, and open the creative work hidden between the keyboard, monitor, notebook, mug, sticky notes, and fidget toy.

## Features

- **Interactive Desk World** – Explore a procedural bedroom desk from a high three-quarter view.
- **Computer Mouse Avatar** – Glide freely across the desk using keyboard or touch controls.
- **Object-Based Navigation** – Approach the monitor, keyboard, mug, notebook, sticky notes, and fidget toy to discover different areas of the portfolio.
- **Reactive Workspace UI** – The pointer status panel shows nearby object detection and signal strength.
- **Atmospheric Lighting** – Cool monitor light, warm desk-lamp light, soft room shadows, and tactile desk materials create a late-night workspace mood.
- **Animated Splash Screen** – The existing holographic hand animation transitions into a restored desktop session.
- **Accessibility** – Error boundaries, responsive layout, keyboard controls, touch support, and reduced-motion support.

## Controls

- **Desktop:** Arrow keys or WASD
- **Touch:** Drag in the direction you want the mouse to glide
- **Start:** Select `Enter workspace` or press any movement key

## Desk World Mapping

| Desk object | Portfolio area |
|---|---|
| Monitor | Selected work and featured projects |
| Keyboard | Skills, process, and craft |
| Notebook | Case studies and field notes |
| Coffee mug | About and personal context |
| Sticky notes | Ideas in progress |
| Fidget toy | Experiments and playful work |
| Desk lamp | Focus and atmosphere |

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
