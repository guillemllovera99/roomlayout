import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Pt, Furniture, Opening } from "../App";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function Scene3D({
  points, wallThick, wallHeight, furniture = [], openings = [],
  onOpeningChange, setSelectedOpeningId,
  origin, floorEnabled, floorStyle, groundEnabled, groundStyle, wallColor,
  zoomDistance, pan
}: {
  points: Pt[]; wallThick: number; wallHeight: number; furniture?: Furniture[]; openings?: Opening[];
  onOpeningChange?: (id: string, patch: Partial<Opening>) => void;
  setSelectedOpeningId?: (id: string | null) => void;
  origin: {x:number;y:number};
  floorEnabled: boolean; floorStyle: "wood"|"white"|"tan"|"darkwood";
  groundEnabled: boolean; groundStyle: "wood"|"white"|"tan"|"darkwood";
  wallColor: string;
  zoomDistance: number;                  // meters
  pan: { x: number; z: number };         // meters
}) {
  const controlsRef = useRef<any>(null);

  return (
    <Canvas camera={{ position: [0, 3, 6], fov: 55 }} shadows={false}>
      {/* keep camera in sync with UI */}
      <CameraRig zoomDistance={zoomDistance} pan={pan} />

      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} />

      {/* Grid (just lines, not pickable) */}
      <group raycast={() => null}><Grid args={[30, 30]} /></group>

      {/* Ground only under the room's outer rectangle */}
      {groundEnabled && <RoomGround points={points} style={groundStyle} />}

      <group>
        {floorEnabled && <InteriorFloor points={points} wallThick={wallThick} style={floorStyle} />}
        <Walls
          points={points}
          thick={wallThick}
          height={wallHeight}
          openings={openings}
          onOpeningChange={onOpeningChange}
          setSelectedOpeningId={setSelectedOpeningId}
          wallColor={wallColor}
          controlsRef={controlsRef}
        />
        {furniture.map(f => <FurnitureItem key={f.id} {...f} origin={origin} />)}
      </group>

      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}

function CameraRig({zoomDistance, pan}:{zoomDistance:number; pan:{x:number;z:number}}){
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(pan.x + zoomDistance * 0.0, zoomDistance * 0.9, pan.z + zoomDistance * 1.4);
    camera.lookAt(pan.x, 0, pan.z);
  }, [zoomDistance, pan, camera]);
  return null;
}

function cmToM(v: number) { return v / 100; }

/** Solid ground, sized exactly to the room’s *outer* rectangle. */
function RoomGround({points, style}:{points:Pt[]; style:"wood"|"white"|"tan"|"darkwood"}) {
  if (points.length < 3) return null;
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = (maxX - minX) / 100;
  const l = (maxY - minY) / 100;
  const cx = (minX + maxX) / 2 / 100;
  const cy = (minY + maxY) / 2 / 100;

  const color = ({
    wood:     "#d7b899",
    white:    "#f5f5f5",
    tan:      "#cbbba2",
    darkwood: "#8b5e34",
  } as const)[style];

  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[cx,-0.004,cy]}>
      <planeGeometry args={[w, l]} />
      <meshStandardMaterial color={color} roughness={1} metalness={0} />
    </mesh>
  );
}

/** Interior floor — the area inside the walls (independently colorable). */
function InteriorFloor({ points, wallThick, style }:{
  points: Pt[]; wallThick:number; style:"wood"|"white"|"tan"|"darkwood";
}) {
  const shape = useMemo(() => {
    if (points.length < 3) return null;
    const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = new THREE.Shape();
    s.moveTo(cmToM(minX + wallThick), cmToM(minY + wallThick));
    s.lineTo(cmToM(maxX - wallThick), cmToM(minY + wallThick));
    s.lineTo(cmToM(maxX - wallThick), cmToM(maxY - wallThick));
    s.lineTo(cmToM(minX + wallThick), cmToM(maxY - wallThick));
    s.lineTo(cmToM(minX + wallThick), cmToM(minY + wallThick));
    return s;
  }, [points, wallThick]);

  if (!shape) return null;

  const color = ({
    wood:     "#d7b899",
    white:    "#f5f5f5",
    tan:      "#cbbba2",
    darkwood: "#8b5e34",
  } as const)[style];

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
    </mesh>
  );
}

// ---------- Walls + Openings ----------
function Walls({
  points, thick, height, openings, onOpeningChange, setSelectedOpeningId, wallColor, controlsRef
}: {
  points: Pt[]; thick: number; height: number; openings: Opening[];
  onOpeningChange?: (id:string, patch:Partial<Opening>)=>void;
  setSelectedOpeningId?: (id:string|null)=>void;
  wallColor: string;
  controlsRef: React.RefObject<any>;
}) {
  const segs = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]; const b = points[(i + 1) % points.length];
    segs.push({ a, b });
  }
  return (
    <group>
      {segs.map((s, i) => {
        const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
        const L = Math.hypot(dx, dy);
        const rot = Math.atan2(dy, dx);
        const cx = (s.a.x + s.b.x) / 2, cy = (s.a.y + s.b.y) / 2;
        const ops = openings.filter(o => o.seg === i).sort((a,b)=>a.offset-b.offset);

        return (
          <group key={i} position={[cmToM(cx), 0, cmToM(cy)]} rotation={[0, -rot, 0]}>
            {buildWallPieces(L, thick, height, ops).map((p, k, arr) => {
              // Slight end trim to reduce visible double-thickness at corners
              const endTrim = cmToM(k===0 || k===arr.length-1 ? thick/2 : 0);
              const len = cmToM(p.len) - (k===0?endTrim:0) - (k===arr.length-1?endTrim:0);
              const x = cmToM(p.x) + (k===0?endTrim/2:0) - (k===arr.length-1?endTrim/2:0);
              return (
                <mesh key={k} position={[x, cmToM((p.h0+p.h1)/2), 0]}>
                  <boxGeometry args={[Math.max(0.001,len), cmToM(p.h1 - p.h0), cmToM(thick)]} />
                  <meshStandardMaterial color={wallColor} />
                </mesh>
              );
            })}

            {/* Windows: draggable X; Shift+drag = vertical */}
            {ops.filter(o=>o.kind==="window").map(o=>{
              const centerLocalX = -L/2 + o.offset + o.width/2;
              const y = o.sill + o.height/2;
              return (
                <WindowPanel
                  key={o.id}
                  opening={o}
                  position={[cmToM(centerLocalX), cmToM(y), 0]}
                  wallLen={L}
                  onDrag={(nx)=>onOpeningChange?.(o.id, { offset: clamp(nx + L/2 - o.width/2, 0, L - o.width) })}
                  onVerticalDrag={(ny)=>onOpeningChange?.(o.id, { sill: clamp(ny - o.height/2, 0, height - o.height) })}
                  onPick={()=>setSelectedOpeningId?.(o.id)}
                  controlsRef={controlsRef}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function buildWallPieces(L: number, thick: number, H: number, ops: Opening[]) {
  type Piece = { x: number; len: number; h0: number; h1: number };
  const pieces: Piece[] = [];
  let cursor = 0;
  const span = (a:number,b:number,h0:number,h1:number)=>{ if(b<=a||h1<=h0) return; const mid=(a+b)/2; pieces.push({ x: mid - L/2, len: b-a, h0, h1 }); };
  const norm = (o:Opening)=>({ a: Math.max(0,Math.min(L,o.offset)), b: Math.max(0,Math.min(L,o.offset+o.width)) });

  for(const o of ops){
    const {a,b}=norm(o);
    if(a>cursor) span(cursor,a,0,H);
    if(o.kind==="door"){
      span(a,b,o.height,H);
    }else{
      if(o.sill>0) span(a,b,0,o.sill);
      if(o.sill+o.height<H) span(a,b,o.sill+o.height,H);
    }
    cursor=Math.max(cursor,b);
  }
  if(cursor<L) span(cursor,L,0,H);
  return pieces;
}

// ---------- Furniture ----------
function FurnitureItem({ name, size, pos, rot, url }:
  Furniture & { origin: {x:number;y:number} }) {

  const worldX = pos.x + size.w/2;
  const worldY = pos.y + size.l/2;

  if (url) {
    const gltf = useLoader(GLTFLoader, url);
    return (
      <group position={[cmToM(worldX), 0, cmToM(worldY)]} rotation={[0, rot, 0]} scale={0.01}>
        <primitive object={gltf.scene} />
      </group>
    );
  }

  return (
    <mesh position={[cmToM(worldX), cmToM(size.h/2), cmToM(worldY)]} rotation={[0, rot, 0]}>
      <boxGeometry args={[cmToM(size.w), cmToM(size.h), cmToM(size.l)]}/>
      <meshStandardMaterial color="#8b5e34" />
    </mesh>
  );
}

// ---------- Window panel (drag + Shift vertical) ----------
function WindowPanel({
  opening, position, wallLen, onDrag, onVerticalDrag, onPick, controlsRef
}: {
  opening: Opening;
  position: [number, number, number];
  wallLen: number;
  onDrag: (newCenterLocalX: number)=>void;
  onVerticalDrag: (newCenterLocalY: number)=>void;
  onPick: ()=>void;
  controlsRef: React.RefObject<any>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [dragging, setDragging] = useState(false);
  const [shift, setShift] = useState(false);

  const tex = (() => {
    if (!opening.texUrl) return null;
    try { return useLoader(THREE.TextureLoader, opening.texUrl); }
    catch { return null; }
  })();

  const keyHandler = (e: KeyboardEvent) => setShift(e.shiftKey);
  if (typeof window !== "undefined") {
    window.onkeydown = keyHandler; window.onkeyup = keyHandler;
  }

  const onPointerDown = (e: any) => {
    e.stopPropagation();
    controlsRef.current && (controlsRef.current.enabled = false);
    setDragging(true);
    onPick();
    e.target.setPointerCapture?.(e.pointerId);
  };
  const onPointerUp   = (e: any) => {
    e.stopPropagation();
    setDragging(false);
    controlsRef.current && (controlsRef.current.enabled = true);
    e.target.releasePointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: any) => {
    if (!dragging || !groupRef.current) return;
    const inv = new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert();
    const ro = e.ray.origin.clone().applyMatrix4(inv);
    const rd = e.ray.direction.clone().transformDirection(inv);

    if (!shift) {
      const t = (position[1] - ro.y) / rd.y; // intersect local Y plane
      if (!isFinite(t) || t < 0) return;
      const hit = ro.clone().addScaledVector(rd, t);
      const half = wallLen / 2, halfW = opening.width / 2;
      const xLocal = THREE.MathUtils.clamp(hit.x, -half + halfW, half - halfW);
      onDrag(xLocal);
    } else {
      const t = (position[2] - ro.z); // vertical move in local space
      if (!isFinite(t) || Math.abs(rd.z) < 1e-6) return;
      const hit = ro.clone().addScaledVector(rd, t / rd.z);
      onVerticalDrag(hit.y);
    }
  };

  const w = opening.width, h = opening.height;
  const depth = 0.5;

  return (
    <group ref={groupRef}>
      <mesh position={position} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerMove={onPointerMove}>
        <boxGeometry args={[w/100, h/100, depth/100]} />
        {tex ? (
          <meshBasicMaterial map={tex} transparent />
        ) : (
          <meshPhysicalMaterial color="#a5f3fc" roughness={0.1} transmission={0.7} thickness={0.02} transparent />
        )}
      </mesh>
      {/* thin frame */}
      <group position={[position[0], position[1], position[2]]}>
        <mesh position={[0,  (h/2 + 1)/100, 0]}><boxGeometry args={[w/100, 0.01, (depth+1)/100]} /><meshStandardMaterial color="#9ca3af"/></mesh>
        <mesh position={[0, -(h/2 + 1)/100, 0]}><boxGeometry args={[w/100, 0.01, (depth+1)/100]} /><meshStandardMaterial color="#9ca3af"/></mesh>
        <mesh position={[ (w/2 + 1)/100, 0, 0]}><boxGeometry args={[0.01, h/100, (depth+1)/100]} /><meshStandardMaterial color="#9ca3af"/></mesh>
        <mesh position={[-(w/2 + 1)/100, 0, 0]}><boxGeometry args={[0.01, h/100, (depth+1)/100]} /><meshStandardMaterial color="#9ca3af"/></mesh>
      </group>
    </group>
  );
}

function clamp(v:number, a:number, b:number){ return Math.max(a, Math.min(b, v)); }
