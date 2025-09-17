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
