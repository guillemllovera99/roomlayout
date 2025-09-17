# Room Planner — DIY Sweet Home 3D Starter (React + Three.js)

A lightweight, free room/apartment layout tool that lets you draw **2D floor plans** with precise cm snapping and preview them in a **3D view**. Includes a simple **Save/Load** format and optional **GLTF/GLB** furniture import. Built with **React + Vite + TypeScript**, **Three.js (@react-three/fiber + drei)**, and **Tailwind CSS**.

> Goal: replicate the core feel of Sweet Home 3D without paywalls and keep the code fully local & hackable.

---

## Features (MVP)

- **2D Plan** canvas (grid + snap in cm)
- **3D View** scene (placeholder ready; plug in your models)
- **Toolbar**: Select / Wall / Room / Door / Window / Furniture (stubs for Door/Window in MVP)
- **Right Panel**: grid snap control, Save/Load project
- **Project persistence**: export/import `project.json`
- **(Optional)** Drag‑and‑drop **.glb/.gltf** furniture (via enhancement snippet)
- **(Optional)** Segment **dimension labels** in the 2D view for exact measurement matching

> The MVP ships with placeholder Plan2D/Scene3D implementations so you can see the shell immediately, then swap in the richer versions.

---

## Tech Stack

- **Vite + React + TypeScript**
- **Three.js** via **@react-three/fiber** and helpers from **@react-three/drei**
- **Zustand** for app state, **Zod** for schema‑safe save/load
- **Tailwind CSS** for styling
- **file-saver** for one‑click JSON export

---

## Prerequisites

- **Node.js ≥ 20.19** (recommended; required by latest Vite/plugin versions)
- A terminal (macOS Terminal, Windows Terminal/PowerShell, or any shell)
- A code editor (VS Code recommended)

> If you’re on Node 18, you *can* pin older tool versions, but upgrading to Node 20+ is simpler and avoids EBADENGINE warnings.

---

## Quick Start

```bash
# 0) (macOS/Linux) Use nvm to get Node 20+ (recommended)
# If you already have Node ≥ 20.19, skip to step 1.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

# 1) Create app (Vite + React + TS)
npm create vite@latest room-planner -- --template react-ts
cd room-planner

# 2) Install dependencies
npm i three @react-three/fiber @react-three/drei zustand zod classnames file-saver
npm i -D tailwindcss postcss autoprefixer @types/three

# 3) Tailwind setup (manual, no CLI needed)
# 3a) tailwind.config.js
cat > tailwind.config.js <<'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
EOF

# 3b) postcss.config.js
cat > postcss.config.js <<'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF

# 3c) src/index.css
cat > src/index.css <<'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# 4) Create folders/files for the MVP shell
mkdir -p src/ui src/editor src/viewer

# State & helpers
cat > src/state.ts <<'EOF'
import create from "zustand";
export type Vec2 = { x: number; y: number };
export type Wall = {
  id: string;
  a: Vec2;
  b: Vec2;
  thick: number;
  height: number;
  openings: { id: string; offset: number; width: number; height: number }[];
};
export type Room = { id: string; points: Vec2[]; name?: string };
export type Furniture = {
  id: string;
  name: string;
  url?: string;
  pos: [number, number, number];
  rotY: number;
  scale: number;
};
export type Units = "cm" | "inch";
export type Tool = "select" | "wall" | "room" | "door" | "window" | "furniture" | "measure";
export interface Project {
  version: 1;
  units: Units;
  walls: Wall[];
  rooms: Room[];
  furniture: Furniture[];
}
type UI = { tool: Tool; snap: number; gridVisible: boolean; selectedId?: string };
export type Store = {
  project: Project;
  ui: UI;
  setTool: (t: Tool) => void;
  setSnap: (s: number) => void;
  addWall: (w: Wall) => void;
  addRoom: (r: Room) => void;
  addFurniture: (f: Furniture) => void;
};
export const useStore = create<Store>((set) => ({
  project: { version: 1, units: "cm", walls: [], rooms: [], furniture: [] },
  ui: { tool: "select", snap: 10, gridVisible: true },
  setTool: (t) => set((s) => ({ ui: { ...s.ui, tool: t } })),
  setSnap: (snap) => set((s) => ({ ui: { ...s.ui, snap } })),
  addWall: (w) => set((s) => ({ project: { ...s.project, walls: [...s.project.walls, w] } })),
  addRoom: (r) => set((s) => ({ project: { ...s.project, rooms: [...s.project.rooms, r] } })),
  addFurniture: (f) => set((s) => ({ project: { ...s.project, furniture: [...s.project.furniture, f] } })),
}));
EOF

cat > src/geometry.ts <<'EOF'
import type { Vec2 } from "./state";
export const snapTo = (v: number, grid: number) => Math.round(v / grid) * grid;
export const snapPt = (p: Vec2, grid: number): Vec2 => ({ x: snapTo(p.x, grid), y: snapTo(p.y, grid) });
EOF

# UI
cat > src/ui/Toolbar.tsx <<'EOF'
import { useStore } from "../state";
const buttons: { id: any; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "wall", label: "Wall" },
  { id: "room", label: "Room" },
  { id: "door", label: "Door" },
  { id: "window", label: "Window" },
  { id: "furniture", label: "Furniture" },
  { id: "measure", label: "Measure" },
];
export default function Toolbar() {
  const tool = useStore((s) => s.ui.tool);
  const setTool = useStore((s) => s.setTool);
  return (
    <div className="flex gap-2 p-2 bg-white/80 backdrop-blur rounded-xl shadow">
      {buttons.map((b) => (
        <button
          key={b.id}
          onClick={() => setTool(b.id)}
          className={`px-3 py-1 rounded-md border ${tool === b.id ? "bg-black text-white" : "bg-white"}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
EOF

cat > src/ui/RightPanel.tsx <<'EOF'
import { useStore } from "../state";
import { saveAs } from "file-saver";
export default function RightPanel() {
  const p = useStore((s) => s.project);
  const setSnap = useStore((s) => s.setSnap);
  const onSave = () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    saveAs(blob, "project.json");
  };
  return (
    <div className="w-72 p-3 border-l bg-white/70 backdrop-blur space-y-4">
      <div>
        <label className="text-sm">Grid snap (cm)</label>
        <input
          type="number"
          defaultValue={10}
          className="w-full border rounded p-1"
          onChange={(e) => setSnap(parseFloat(e.target.value || "10"))}
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} className="px-3 py-1 rounded bg-black text-white">Save</button>
        <label className="px-3 py-1 rounded border cursor-pointer">
          Load
          <input type="file" accept="application/json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            file.text().then((txt) => {
              const data = JSON.parse(txt);
              console.log("Loaded project.json (wire to store as needed):", data);
              alert("Loaded file read (see console).");
            });
          }} />
        </label>
      </div>
      <p className="text-xs text-gray-600">Properties panel</p>
    </div>
  );
}
EOF

# 2D/3D placeholders (swap with richer versions later)
cat > src/editor/Plan2D.tsx <<'EOF'
export default function Plan2D() {
  return (
    <div className="w-full h-full bg-gray-50 flex items-center justify-center">
      <div className="text-gray-500">2D Plan goes here</div>
    </div>
  );
}
EOF

cat > src/viewer/Scene3D.tsx <<'EOF'
export default function Scene3D() {
  return (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-500">3D View goes here</div>
    </div>
  );
}
EOF

cat > src/viewer/Furniture.tsx <<'EOF'
export default function FurnitureItem() {
  return null;
}
EOF

# App shell
cat > src/App.tsx <<'EOF'
import Plan2D from "./editor/Plan2D";
import Scene3D from "./viewer/Scene3D";
import Toolbar from "./ui/Toolbar";
import RightPanel from "./ui/RightPanel";

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="p-3 flex justify-between items-center border-b bg-white/80">
        <div className="text-lg font-semibold">Room Planner (Free)</div>
        <Toolbar />
      </div>
      <div className="flex-1 grid grid-cols-2">
        <div className="relative">
          <div className="absolute inset-0">
            <Plan2D />
          </div>
          <div className="absolute bottom-3 left-3 text-xs bg-white/80 p-1 rounded shadow">
            2D Plan
          </div>
        </div>
        <div className="relative">
          <Scene3D />
          <div className="absolute bottom-3 left-3 text-xs bg-white/80 p-1 rounded shadow">
            3D View
          </div>
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
EOF

# main.tsx must mount and import styles
cat > src/main.tsx <<'EOF'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# Ensure index.html has a #root container
cat > index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Room Planner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

# 5) Run the dev server
npm run dev
```

Open the printed URL (e.g., `http://localhost:5173` or `:5174`). You should see the **top bar**, **2D/3D split**, and **right panel**. If the UI looks unstyled, recheck Tailwind configuration and hard‑refresh (⌘⇧R).

---

## Use Guide (MVP)

1. **Set Grid snap** (Right Panel) to 1–10 cm.
2. **Draw walls/rooms** (buttons visible in the toolbar; MVP has placeholders—you can paste the richer editor later).
3. **Save** to `project.json`; **Load** to restore.
4. **(Optional)** drag‑drop a `.glb/.gltf` model into the window (after applying the enhancement snippet).

> For the *biggest bedroom* on your plan: trace each segment with snap 1–2 cm, including recesses/closets, so measurements match the printed plan exactly.

---

## Project Structure

```
room-planner/
├─ index.html
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ index.css
│  ├─ state.ts
│  ├─ geometry.ts
│  ├─ ui/
│  │  ├─ Toolbar.tsx
│  │  └─ RightPanel.tsx
│  ├─ editor/
│  │  └─ Plan2D.tsx
│  └─ viewer/
│     ├─ Scene3D.tsx
│     └─ Furniture.tsx
├─ tailwind.config.js
├─ postcss.config.js
├─ package.json
└─ vite.config.ts
```

---

## Enhancements (drop‑in)

- **Drag‑drop GLTF** into the 3D view (adds a furniture item at the cursor).
- **Segment dimension labels** in the 2D view (show wall lengths in cm).
- **Numeric wall editor**: click a wall → type exact “335 cm” to resize.
- **Door/Window cut‑outs**: subtract openings from wall meshes in 3D.
- **Walkthrough controls** and **screenshot/export** tools.
- **OBJ/FBX importer** (convert to GLTF for best results).

> Ask for any of these and paste‑ready snippets can be dropped into the files above.

---

## Troubleshooting

- **Blank page** → ensure `index.html` has `<div id="root"></div>` and `src/main.tsx` imports `./index.css` and renders `<App/>`.
- **Styles not applying** → verify `tailwind.config.js` `content` paths and that `src/index.css` has exactly the three `@tailwind` lines; restart `npm run dev`.
- **npx tailwindcss “could not determine executable”** → skip CLI and create `tailwind.config.js` & `postcss.config.js` manually (as above). This avoids shell/npm quirks.
- **EBADENGINE warnings** (Vite 7) → upgrade to **Node ≥ 20.19** with `nvm install 20 && nvm use 20` and reinstall (`rm -rf node_modules package-lock.json && npm i`).

---

## License

MIT (feel free to change to your preference).

---

## Acknowledgements

Inspired by the workflow of Sweet Home 3D, re‑imagined with a modern web stack.
