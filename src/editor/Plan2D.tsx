import { useEffect, useRef, useState } from "react";
import type { Pt, Opening, Furniture } from "../App";

type Seg = { a: Pt; b: Pt };
const D_HANDLE = 8;

function dist(a: Pt, b: Pt) { return Math.hypot(b.x - a.x, b.y - a.y); }
function snapVal(v: number, g: number) { return Math.round(v / g) * g; }
function snapPt(p: Pt, g: number): Pt { return { x: snapVal(p.x, g), y: snapVal(p.y, g) }; }
function lerp(a: Pt, b: Pt, t: number): Pt { return { x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t }; }
function ptAt(a: Pt, b: Pt, d: number) { const L = dist(a,b)||1; return lerp(a,b,d/L); }
function clamp(v:number, a:number, b:number){ return Math.max(a, Math.min(b, v)); }
function projectT(a:Pt, b:Pt, p:Pt){
  const abx=b.x-a.x, aby=b.y-a.y; const apx=p.x-a.x, apy=p.y-a.y;
  const L2 = abx*abx + aby*aby || 1;
  return (abx*apx + aby*apy)/L2;
}

export default function Plan2D({
  points, setPoints, snap, wallThick, enableVertexDrag=false,
  openings=[], selectedSeg=null, setSelectedSeg, setSelectedOpeningId, onOpeningChange, onAddOpening,
  furniture=[], setSelectedFurnitureId, onFurnitureChange,
}: {
  points: Pt[]; setPoints: (pts: Pt[]) => void; snap: number; wallThick: number; enableVertexDrag?: boolean;
  openings?: Opening[]; selectedSeg: number|null; setSelectedSeg: (i:number|null)=>void; setSelectedOpeningId?: (id:string|null)=>void;
  onOpeningChange?: (id:string, patch:Partial<Opening>)=>void;
  onAddOpening?: (seg:number, kind:"door"|"window", offset:number, width:number)=>void;
  furniture?: Furniture[]; setSelectedFurnitureId?: (id:string|null)=>void; onFurnitureChange?: (id:string, patch:Partial<Furniture>)=>void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tempPts, setTempPts] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOpening, setDragOpening] = useState<{ id:string; mode:"move"|"left"|"right" } | null>(null);
  const [dragFurniture, setDragFurniture] = useState<{ id:string; mode:"move"|"resize"; corner?: "se"|"nw" } | null>(null);

  useEffect(() => {
    const onResize = () => {
      const el = svgRef.current?.parentElement; if (!el) return;
      const r = el.getBoundingClientRect(); setSize({ w: Math.max(200, r.width), h: Math.max(200, r.height) });
    };
    onResize(); const ro = new ResizeObserver(onResize);
    if (svgRef.current?.parentElement) ro.observe(svgRef.current.parentElement);
    return () => ro.disconnect();
  }, []);

  const getMouse = (e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    return snapPt({ x: e.clientX - r.left, y: e.clientY - r.top }, snap);
  };

  const drawing = points.length === 0;

  const handleClick = (e: React.MouseEvent) => {
    if (!drawing) return;
    const p = getMouse(e); setTempPts((a) => [...a, p]);
  };
  const handleMove = (e: React.MouseEvent) => {
    if (drawing) setHover(getMouse(e));
    if (dragIdx != null) {
      const p = getMouse(e); const copy = points.slice(); copy[dragIdx] = p; setPoints(copy);
    }
    if (dragOpening) {
      const p = getMouse(e);
      const i = selectedSeg!;
      const a = points[i], b = points[(i+1)%points.length]; const L = dist(a,b);
      const t = Math.max(0, Math.min(1, projectT(a,b,p)));
      const x = t * L;
      const o = openings.find(o=>o.id===dragOpening.id)!;
      if (dragOpening.mode === "move") {
        const w = o.width;
        const newOff = clamp(x - w/2, 0, L - w);
        onOpeningChange?.(o.id, { offset: snapVal(newOff, snap) });
      } else if (dragOpening.mode === "left") {
        const right = o.offset + o.width;
        const newLeft = clamp(x, 0, right - 10);
        onOpeningChange?.(o.id, { width: Math.max(10, right - newLeft), offset: newLeft });
      } else {
        const left = o.offset;
        const newRight = clamp(x, left + 10, L);
        onOpeningChange?.(o.id, { width: newRight - left });
      }
    }
    if (dragFurniture) {
      const p = getMouse(e);
      const f = furniture.find(f=>f.id===dragFurniture.id)!;
      if (dragFurniture.mode === "move") {
        onFurnitureChange?.(f.id, { pos: { x: p.x, y: p.y } });
      } else {
        const w = Math.max(20, p.x - f.pos.x);
        const l = Math.max(20, p.y - f.pos.y);
        onFurnitureChange?.(f.id, { size: { ...f.size, w: snapVal(w, snap), l: snapVal(l, snap) } });
      }
    }
  };
  const handleDblClick = () => {
    if (!drawing) return;
    if (tempPts.length >= 3) { setPoints(tempPts); setTempPts([]); setHover(null); setSelectedSeg?.(0); }
  };

  const onMouseUp = () => { setDragIdx(null); setDragOpening(null); setDragFurniture(null); };

  const pts = drawing ? tempPts : points;
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const b = pts[(i + 1) % pts.length];
    if (!drawing || i < pts.length - 1) segs.push({ a, b });
  }

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        onClick={handleClick}
        onMouseMove={handleMove}
        onDoubleClick={handleDblClick}
        onMouseUp={onMouseUp}
        className="block"
        style={{
          backgroundImage:"linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
          backgroundSize:"40px 40px", backgroundColor:"white",
        }}
      >
        {drawing && tempPts.length>0 && hover && (
          <line x1={tempPts[tempPts.length-1].x} y1={tempPts[tempPts.length-1].y} x2={hover.x} y2={hover.y}
                stroke="#10b981" strokeWidth={6} strokeDasharray="10 8" />
        )}

        {!drawing && points.length >= 3 && (
          <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")} fill="#eff6ff" stroke="#60a5fa" strokeWidth={1} />
        )}

        {segs.map((s, i) => {
          const isSel = i === selectedSeg;
          const L = dist(s.a, s.b);
          const ops = openings.filter(o => o.seg === i).sort((a,b)=>a.offset-b.offset);

          return (
            <g key={i} onClick={(ev)=>{ if(!drawing){ ev.stopPropagation(); setSelectedSeg(i); } }}>
              <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y}
                    stroke={isSel ? "#111827" : "black"} strokeWidth={wallThick} strokeLinecap="round" />

              {ops.map((o) => {
                const p1 = ptAt(s.a, s.b, clamp(o.offset,0,L));
                const p2 = ptAt(s.a, s.b, clamp(o.offset + o.width,0,L));
                const mid = ptAt(s.a, s.b, clamp(o.offset + o.width/2,0,L));
                return (
                  <g key={o.id}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                          stroke="white" strokeWidth={Math.max(2, wallThick - 4)} strokeLinecap="butt"
                          onMouseDown={(e)=>{ e.stopPropagation(); setSelectedOpeningId?.(o.id); }} />
                    <circle cx={mid.x} cy={mid.y} r={D_HANDLE} fill="#f59e0b"
                            onMouseDown={(e)=>{e.stopPropagation(); setSelectedOpeningId?.(o.id); setDragOpening({id:o.id, mode:"move"});}} />
                    <rect x={p1.x- D_HANDLE} y={p1.y- D_HANDLE} width={D_HANDLE*2} height={D_HANDLE*2} fill="#3b82f6"
                          onMouseDown={(e)=>{e.stopPropagation(); setSelectedOpeningId?.(o.id); setDragOpening({id:o.id, mode:"left"});}} />
                    <rect x={p2.x- D_HANDLE} y={p2.y- D_HANDLE} width={D_HANDLE*2} height={D_HANDLE*2} fill="#3b82f6"
                          onMouseDown={(e)=>{e.stopPropagation(); setSelectedOpeningId?.(o.id); setDragOpening({id:o.id, mode:"right"});}} />
                  </g>
                );
              })}

              {/* Alt/Option-click to drop a default door quickly */}
              <rect x={Math.min(s.a.x,s.b.x)} y={Math.min(s.a.y,s.b.y)}
                    width={Math.abs(s.b.x-s.a.x)} height={Math.abs(s.b.y-s.a.y)} fill="transparent"
                    onClick={(e)=>{ if(e.altKey && onAddOpening){ const off=10, w=90; onAddOpening(i,"door",off,w);} }} />

              <Label a={s.a} b={s.b} onClick={!drawing ? () => {
                const cur = Math.round(dist(s.a, s.b));
                const raw = prompt("Set wall length (cm):", String(cur)); if (!raw) return;
                const target = Number(raw); if (!isFinite(target)||target<=0) return;
                const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
                const L2 = Math.hypot(dx, dy) || 1; const ux = dx / L2, uy = dy / L2;
                const newB = { x: s.a.x + ux * target, y: s.a.y + uy * target };
                const newPts = points.map((p, idx) => (idx === (i + 1) % points.length ? newB : p));
                setPoints(newPts);
              } : undefined} />
            </g>
          );
        })}

        {!drawing && enableVertexDrag && points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={7} fill="#10b981"
                  onMouseDown={(e)=>{e.stopPropagation(); setDragIdx(i);}} style={{ cursor: "grab" }} />
        ))}

        {!drawing && furniture.map((f)=>(
          <g key={f.id} onMouseDown={()=>{ setSelectedFurnitureId?.(f.id); }}>
            <rect x={Math.min(f.pos.x, f.pos.x+f.size.w)}
                  y={Math.min(f.pos.y, f.pos.y+f.size.l)}
                  width={Math.abs(f.size.w)} height={Math.abs(f.size.l)}
                  fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={2}
                  onMouseDown={(e)=>{ e.stopPropagation(); setSelectedFurnitureId?.(f.id); setDragFurniture({id:f.id, mode:"move"}); }}
            />
            <rect x={f.pos.x+f.size.w-6} y={f.pos.y+f.size.l-6} width="12" height="12" fill="#6366f1"
                  onMouseDown={(e)=>{ e.stopPropagation(); setSelectedFurnitureId?.(f.id); setDragFurniture({id:f.id, mode:"resize", corner:"se"}); }} />
            <text x={f.pos.x+4} y={f.pos.y+14} fontSize="11" fill="#111827">{f.name}</text>
          </g>
        ))}
      </svg>

      <div className="absolute top-2 left-2 flex gap-2">
        <button onClick={()=>{ setPoints([]); setTempPts([]); setSelectedSeg(null); }} className="px-3 py-1 border rounded bg-white">Clear</button>
        <div className="px-3 py-1 border rounded bg-white text-sm">Snap: {snap} cm</div>
        <div className="px-3 py-1 border rounded bg-white text-sm">
          {drawing ? "Click corners • Double-click to close (live preview on)" : "Click wall to select • Drag opening handles • Drag/resize furniture"}
        </div>
      </div>
    </div>
  );
}

function Label({ a, b, onClick }: { a: Pt; b: Pt; onClick?: () => void; }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <g transform={`translate(${mx},${my}) rotate(${ang})`} onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <rect x={-34} y={-12} width={68} height={18} rx={4} ry={4} fill="white" stroke="#d1d5db" />
      <text x={0} y={0} dominantBaseline="middle" textAnchor="middle" fontSize={11} fill="#111827">
        {Math.round(len)} cm
      </text>
    </g>
  );
}
