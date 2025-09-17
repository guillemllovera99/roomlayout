import { useEffect, useMemo, useState } from "react";
import Plan2D from "./editor/Plan2D";
import Scene3D from "./viewer/Scene3D";

export type Pt = { x: number; y: number };

export type Furniture = {
  id: string;
  name: string;
  size: { w: number; l: number; h: number }; // cm
  pos: { x: number; y: number };             // cm (top-left in interior)
  rot: number;
  url?: string;
};

export type Opening = {
  id: string;
  seg: number;
  kind: "door" | "window";
  offset: number; width: number; height: number; sill: number;
  texUrl?: string;
};

export default function App() {
  const [points, setPoints] = useState<Pt[]>([]);
  const [wallThick, setWallThick] = useState(15);
  const [wallHeight, setWallHeight] = useState(270);
  const [snap, setSnap] = useState(10);

  // Default to 11'2" x 17'8" → 340 cm x 538 cm
  const [rectW, setRectW] = useState(340);
  const [rectL, setRectL] = useState(538);

  const [openings, setOpenings] = useState<Opening[]>([]);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);

  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);

  // Appearance
  const [floorEnabled, setFloorEnabled] = useState(true);
  const [floorStyle, setFloorStyle] = useState<"wood"|"white"|"tan"|"darkwood">("wood");
  const [groundEnabled, setGroundEnabled] = useState(true);
  const [groundStyle, setGroundStyle] = useState<"wood"|"white"|"tan"|"darkwood">("tan");
  const [wallColor, setWallColor] = useState<string>("#b08a6e");

  // 3D navigation
  const [zoomDistance, setZoomDistance] = useState(6); // meters
  const [pan, setPan] = useState({ x: 0, z: 0 });      // meters

  // Helpers
  const segLength = (i: number) => {
    if (points.length < 2) return 0;
    const a = points[i], b = points[(i + 1) % points.length];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const makeRectangle = () => {
    setPoints([{x:0,y:0},{x:rectW,y:0},{x:rectW,y:rectL},{x:0,y:rectL}]);
    setSelectedSeg(0);
  };

  // Auto-create the default rectangle on first load
  useEffect(() => {
    if (points.length === 0) {
      setPoints([{x:0,y:0},{x:rectW,y:0},{x:rectW,y:rectL},{x:0,y:rectL}]);
      setSelectedSeg(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = interiorOrigin(points, wallThick);

  // Openings
  const addOpening = (seg:number, kind:"door"|"window", offset:number, width:number, height:number, sill:number) => {
    const L = segLength(seg);
    const o: Opening = {
      id: crypto.randomUUID(), seg, kind,
      offset: clamp(offset,0,Math.max(0,L-width)),
      width: clamp(width,10,L),
      height: clamp(height,10,wallHeight),
      sill: kind==="door"?0:clamp(sill,0,wallHeight-height),
    };
    setOpenings(arr=>[...arr,o]);
    setSelectedOpeningId(o.id);
  };
  const updateOpening = (id: string, patch: Partial<Opening>) =>
    setOpenings((arr) => arr.map((o) => (o.id === id ? bound(o, patch) : o)));
  const removeOpening = (id: string) => {
    setOpenings((arr) => arr.filter((o) => o.id !== id));
    if (selectedOpeningId === id) setSelectedOpeningId(null);
  };
  const bound = (o:Opening, p:Partial<Opening>)=>{
    const n = {...o, ...p};
    const L = segLength(n.seg);
    n.width = clamp(n.width, 10, L);
    n.offset = clamp(n.offset, 0, Math.max(0, L - n.width));
    n.height = clamp(n.height, 10, wallHeight);
    n.sill = n.kind==="door" ? 0 : clamp(n.sill, 0, wallHeight - n.height);
    return n;
  };

  // Furniture
  const addBed = () => {
    const o = origin; setFurniture(arr=>[...arr,{id:crypto.randomUUID(),name:"Bed",size:{w:150,l:200,h:45},pos:{x:o.x+20,y:o.y+20},rot:0}]);
  };
  const addDresser = () => {
    const o = origin; setFurniture(arr=>[...arr,{id:crypto.randomUUID(),name:"Dresser",size:{w:100,l:50,h:90},pos:{x:o.x+40,y:o.y+40},rot:0}]);
  };
  const updateFurniture = (id: string, patch: Partial<Furniture>) =>
    setFurniture((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFurniture = (id: string) => {
    setFurniture((arr) => arr.filter((f) => f.id !== id));
    if (selectedFurnitureId === id) setSelectedFurnitureId(null);
  };

  const selOpening = useMemo(()=>openings.find(o=>o.id===selectedOpeningId)||null,[openings,selectedOpeningId]);
  const selFurniture = useMemo(()=>furniture.find(f=>f.id===selectedFurnitureId)||null,[furniture,selectedFurnitureId]);

  // UI tabs
  const [tool, setTool] = useState<"window"|"door"|"bed"|"dresser"|"floor"|"ground"|"walls">("window");

  // Defaults for adding
  const [wOffset, setWOffset] = useState(50);
  const [wWidth, setWWidth]   = useState(90);
  const [wHeight,setWHeight]  = useState(100);
  const [wSill,  setWSill]    = useState(90);

  const [dOffset, setDOffset] = useState(50);
  const [dWidth, setDWidth]   = useState(90);
  const [dHeight,setDHeight]  = useState(210);

  // Drag&Drop GLTF
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const o = origin;
      setFurniture(arr=>[...arr,{id:crypto.randomUUID(),name:f.name,size:{w:120,l:200,h:50},pos:{x:o.x+40,y:o.y+40},rot:0,url}]);
      alert(`Imported: ${f.name}`);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => { window.removeEventListener("drop", onDrop); window.removeEventListener("dragover", onDragOver); };
  }, [origin]);

  return (
    <div className="h-screen w-screen grid grid-cols-[1fr_360px]">
      <div className="flex flex-col">
        <div className="px-4 py-3 border-b bg-white">
          <div className="text-lg font-semibold">Room Planner (Single Room)</div>
        </div>
        <div className="flex-1 grid grid-cols-2">
          <div className="relative">
            <Plan2D
              points={points} setPoints={setPoints} snap={snap}
              wallThick={wallThick} enableVertexDrag
              openings={openings}
              selectedSeg={selectedSeg} setSelectedSeg={setSelectedSeg}
              setSelectedOpeningId={setSelectedOpeningId}
              onOpeningChange={(id, patch) => updateOpening(id, patch)}
              onAddOpening={(seg, kind, offset, width) => {
                const h = kind==="door"?dHeight:wHeight;
                const sill = kind==="door"?0:wSill;
                addOpening(seg, kind, offset, width, h, sill);
              }}
              furniture={furniture}
              setSelectedFurnitureId={setSelectedFurnitureId}
              onFurnitureChange={updateFurniture}
              origin={origin}
            />
            <div className="absolute bottom-3 left-3 text-xs bg-white/80 p-1 rounded shadow">2D Plan</div>
          </div>

          <div className="relative">
            <Scene3D
              points={points}
              wallThick={wallThick}
              wallHeight={wallHeight}
              furniture={furniture}
              openings={openings}
              onOpeningChange={(id, patch) => updateOpening(id, patch)}
              setSelectedOpeningId={setSelectedOpeningId}
              origin={origin}
              floorEnabled={floorEnabled} floorStyle={floorStyle}
              groundEnabled={groundEnabled} groundStyle={groundStyle}
              wallColor={wallColor}
              zoomDistance={zoomDistance}
              pan={pan}
            />
            <div className="absolute bottom-3 left-3 text-xs bg-white/80 p-1 rounded shadow">3D View</div>

            {/* 3D navigation overlay */}
            <div className="absolute top-3 right-3 bg-white/90 border rounded p-2 space-y-2">
              <div className="text-xs font-medium">Zoom</div>
              <input type="range" min={3} max={20} step={0.5}
                     value={zoomDistance}
                     onChange={(e)=>setZoomDistance(+e.target.value)}
                     className="w-40" />
              <div className="grid grid-cols-3 gap-1 text-sm">
                <button className="border rounded px-2 py-1" onClick={()=>setPan(p=>({x:p.x, z:p.z-0.5}))}>↑</button>
                <button className="border rounded px-2 py-1" onClick={()=>setPan(p=>({x:p.x-0.5, z:p.z}))}>←</button>
                <button className="border rounded px-2 py-1" onClick={()=>setPan(p=>({x:p.x+0.5, z:p.z}))}>→</button>
                <div />
                <button className="border rounded px-2 py-1" onClick={()=>setPan(p=>({x:p.x, z:p.z+0.5}))}>↓</button>
                <div />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="border-l p-3 space-y-5 bg-white overflow-y-auto">
        <div className="font-semibold">Room Settings</div>

        <label className="block text-sm">Grid snap (cm)</label>
        <input type="number" value={snap} onChange={(e) => setSnap(Number(e.target.value || 1))} className="border rounded p-1 w-full" />

        <label className="block text-sm">Wall thickness (cm)</label>
        <input type="number" value={wallThick} onChange={(e) => setWallThick(Number(e.target.value || 10))} className="border rounded p-1 w-full" />

        <label className="block text-sm">Wall height (cm)</label>
        <input type="number" value={wallHeight} onChange={(e) => setWallHeight(Number(e.target.value || 240))} className="border rounded p-1 w-full" />

        <div className="space-y-2">
          <div className="font-semibold">Quick rectangle</div>
          <div className="flex gap-2">
            <input type="number" value={rectW} onChange={(e)=>setRectW(Number(e.target.value||0))} className="border rounded p-1 w-1/2" placeholder="Width (cm)" />
            <input type="number" value={rectL} onChange={(e)=>setRectL(Number(e.target.value||0))} className="border rounded p-1 w-1/2" placeholder="Length (cm)" />
          </div>
          <button onClick={makeRectangle} className="px-3 py-1 rounded bg-black text-white">Create rectangle</button>
        </div>

        {/* Tool tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["window","door","bed","dresser","floor","ground","walls"] as const).map(t=>(
            <button key={t}
              className={`px-2 py-1 border rounded ${tool===t?"bg-black text-white":"bg-white"}`}
              onClick={()=>setTool(t)}>{t[0].toUpperCase()+t.slice(1)}</button>
          ))}
        </div>

        {/* WINDOWS */}
        {tool==="window" && (
          <section className="space-y-2">
            <div className="font-semibold">Windows</div>
            <div className="text-sm">Selected wall: {selectedSeg==null?"none":`#${selectedSeg} (${Math.round(segLength(selectedSeg))} cm)`}</div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="text-sm">Offset (cm)</label>
                <input type="number" className="border rounded p-1 w-full" value={wOffset} onChange={(e)=>setWOffset(+e.target.value||0)} />
              </div>
              <div>
                <label className="text-sm">Width (cm)</label>
                <input type="number" className="border rounded p-1 w-full" value={wWidth} onChange={(e)=>setWWidth(+e.target.value||0)} />
              </div>
              <div>
                <label className="text-sm">Height (cm)</label>
                <input type="number" className="border rounded p-1 w-full" value={wHeight} onChange={(e)=>setWHeight(+e.target.value||0)} />
              </div>
              <div>
                <label className="text-sm">Sill (cm, up/down)</label>
                <input type="number" className="border rounded p-1 w-full" value={wSill} onChange={(e)=>setWSill(+e.target.value||0)} />
              </div>
              <button className="col-span-2 px-3 py-1 rounded bg-black text-white"
                onClick={()=>selectedSeg!=null && addOpening(selectedSeg,"window",wOffset,wWidth,wHeight,wSill)}
              >Add window</button>
            </div>

            {openings.filter(o=>o.kind==="window" && o.seg===selectedSeg).map(o=>(
              <OpeningRow key={o.id} o={o} onPick={()=>setSelectedOpeningId(o.id)} onRemove={()=>removeOpening(o.id)} />
            ))}
            {selOpening && selOpening.kind==="window" && (
              <OpeningInspector o={selOpening} onChange={(p)=>updateOpening(selOpening.id,p)} />
            )}
          </section>
        )}

        {/* DOORS */}
        {tool==="door" && (
          <section className="space-y-2">
            <div className="font-semibold">Doors</div>
            <div className="text-sm">Selected wall: {selectedSeg==null?"none":`#${selectedSeg} (${Math.round(segLength(selectedSeg))} cm)`}</div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="text-sm">Offset (cm)</label>
                <input type="number" className="border rounded p-1 w-full" value={dOffset} onChange={(e)=>setDOffset(+e.target.value||0)} />
              </div>
              <div>
                <label className="text-sm">Width (cm)</label>
                <input type="number" className="border rounded p-1 w-full" value={dWidth} onChange={(e)=>setDWidth(+e.target.value||0)} />
              </div>
              <div>
                <label className="text-sm">Height (cm)</label>
                <input type="number" className="border rounded p-1 w-full" value={dHeight} onChange={(e)=>setDHeight(+e.target.value||0)} />
              </div>
              <div />
              <button className="col-span-2 px-3 py-1 rounded bg-black text-white"
                onClick={()=>selectedSeg!=null && addOpening(selectedSeg,"door",dOffset,dWidth,dHeight,0)}
              >Add door</button>
            </div>

            {openings.filter(o=>o.kind==="door" && o.seg===selectedSeg).map(o=>(
              <OpeningRow key={o.id} o={o} onPick={()=>setSelectedOpeningId(o.id)} onRemove={()=>removeOpening(o.id)} />
            ))}
            {selOpening && selOpening.kind==="door" && (
              <OpeningInspector o={selOpening} onChange={(p)=>updateOpening(selOpening.id,p)} />
            )}
          </section>
        )}

        {/* BED */}
        {tool==="bed" && (
          <section className="space-y-2">
            <div className="font-semibold">Bed</div>
            <button className="border rounded px-3 py-1" onClick={addBed}>Add Bed</button>
            {selFurniture && /bed/i.test(selFurniture.name) && (
              <FurnitureInspector item={selFurniture}
                onChange={(patch)=>updateFurniture(selFurniture.id,{...selFurniture,...patch})}
                onRemove={()=>removeFurniture(selFurniture.id)} />
            )}
          </section>
        )}

        {/* DRESSER */}
        {tool==="dresser" && (
          <section className="space-y-2">
            <div className="font-semibold">Dresser</div>
            <button className="border rounded px-3 py-1" onClick={addDresser}>Add Dresser</button>
            {selFurniture && /dresser/i.test(selFurniture.name) && (
              <FurnitureInspector item={selFurniture}
                onChange={(patch)=>updateFurniture(selFurniture.id,{...selFurniture,...patch})}
                onRemove={()=>removeFurniture(selFurniture.id)} />
            )}
          </section>
        )}

        {/* FLOOR (interior) */}
        {tool==="floor" && (
          <section className="space-y-1">
            <div className="font-semibold">Floor (interior)</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={floorEnabled} onChange={(e)=>setFloorEnabled(e.target.checked)} />
              Enable interior floor
            </label>
            <select className="border rounded p-1 w-full" value={floorStyle} onChange={(e)=>setFloorStyle(e.target.value as any)} >
              <option value="wood">Wood</option>
              <option value="white">White</option>
              <option value="tan">Tan</option>
              <option value="darkwood">Dark wood</option>
            </select>
          </section>
        )}

        {/* GROUND */}
        {tool==="ground" && (
          <section className="space-y-1">
            <div className="font-semibold">Ground</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={groundEnabled} onChange={(e)=>setGroundEnabled(e.target.checked)} />
              Enable ground plane (under room)
            </label>
            <select className="border rounded p-1 w-full" value={groundStyle} onChange={(e)=>setGroundStyle(e.target.value as any)} >
              <option value="wood">Wood</option>
              <option value="white">White</option>
              <option value="tan">Tan</option>
              <option value="darkwood">Dark wood</option>
            </select>
          </section>
        )}

        {/* WALLS */}
        {tool==="walls" && (
          <section className="space-y-1">
            <div className="font-semibold">Walls</div>
            <label className="text-sm">Wall color</label>
            <input type="color" className="w-full h-8 p-0 border rounded" value={wallColor} onChange={(e)=>setWallColor(e.target.value)} />
          </section>
        )}

        <div className="text-xs text-gray-600">
          Tip: In 3D, drag a window to move left/right; hold <b>Shift</b> while dragging to move it up/down.
          Use the zoom slider and arrows to navigate.
        </div>
      </div>
    </div>
  );
}

function OpeningRow({o,onPick,onRemove}:{o:Opening;onPick:()=>void;onRemove:()=>void;}){
  return (
    <div className="flex justify-between items-center text-sm">
      <span onClick={onPick} className="underline cursor-pointer">
        {o.kind} • off {Math.round(o.offset)} • w {o.width}{o.kind==="window" ? ` • sill ${o.sill} • h ${o.height}` : ` • h ${o.height}`}
      </span>
      <button className="text-red-600 underline" onClick={onRemove}>remove</button>
    </div>
  );
}

function OpeningInspector({o,onChange}:{o:Opening;onChange:(p:Partial<Opening>)=>void;}){
  return (
    <div className="space-y-2 border rounded p-2">
      <div className="font-medium">Selected {o.kind}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-sm">Offset (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={o.offset}
                 onChange={(e)=>onChange({ offset:+e.target.value||0 })}/>
        </div>
        <div>
          <label className="text-sm">Width (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={o.width}
                 onChange={(e)=>onChange({ width:+e.target.value||0 })}/>
        </div>
        <div>
          <label className="text-sm">{o.kind==="door"?"Height (cm)":"Window height (cm)"}</label>
          <input type="number" className="border rounded p-1 w-full" value={o.height}
                 onChange={(e)=>onChange({ height:+e.target.value||0 })}/>
        </div>
        <div>
          <label className="text-sm">{o.kind==="door"?"Sill (0)":"Sill (cm, up/down)"}</label>
          <input type="number" className="border rounded p-1 w-full" value={o.sill}
                 disabled={o.kind==="door"}
                 onChange={(e)=>onChange({ sill:+e.target.value||0 })}/>
        </div>
      </div>

      {o.kind==="window" && (
        <div className="space-y-1">
          <label className="text-sm">Window image</label>
          <input type="file" accept="image/*"
                 onChange={(e)=>{
                   const f = e.target.files?.[0];
                   if(!f) return;
                   const url = URL.createObjectURL(f);
                   onChange({ texUrl: url });
                 }} />
        </div>
      )}
    </div>
  );
}

function FurnitureInspector({item,onChange,onRemove}:{item: any; onChange:(p:any)=>void; onRemove:()=>void;}){
  return (
    <div className="mt-2 space-y-2 border rounded p-2">
      <div className="font-medium">Selected furniture</div>
      <label className="text-sm">Name</label>
      <input className="border rounded p-1 w-full" value={item.name}
             onChange={(e)=>onChange({ name: e.target.value })} />
      <div className="grid grid-cols-3 gap-2">
        <div><label className="text-sm">Width (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={item.size.w}
                 onChange={(e)=>onChange({ size: { ...item.size, w: +e.target.value || 0 } })}/></div>
        <div><label className="text-sm">Length (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={item.size.l}
                 onChange={(e)=>onChange({ size: { ...item.size, l: +e.target.value || 0 } })}/></div>
        <div><label className="text-sm">Height (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={item.size.h}
                 onChange={(e)=>onChange({ size: { ...item.size, h: +e.target.value || 0 } })}/></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-sm">X (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={item.pos.x}
                 onChange={(e)=>onChange({ pos: { ...item.pos, x: +e.target.value || 0 } })}/></div>
        <div><label className="text-sm">Y (cm)</label>
          <input type="number" className="border rounded p-1 w-full" value={item.pos.y}
                 onChange={(e)=>onChange({ pos: { ...item.pos, y: +e.target.value || 0 } })}/></div>
      </div>
      <button className="text-red-600 underline" onClick={onRemove}>Remove</button>
    </div>
  );
}

function interiorOrigin(pts: Pt[], wallThick: number){
  if(pts.length===0) return { x: 0, y: 0 };
  const minX = Math.min(...pts.map(p=>p.x));
  const minY = Math.min(...pts.map(p=>p.y));
  return { x: minX + wallThick, y: minY + wallThick };
}
