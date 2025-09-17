cat > src/geometry.ts <<'EOF'
import type { Vec2 } from "./state";
export const snapTo = (v: number, grid: number) => Math.round(v / grid) * grid;
export const snapPt = (p: Vec2, grid: number): Vec2 => ({ x: snapTo(p.x, grid), y: snapTo(p.y, grid) });
EOF
