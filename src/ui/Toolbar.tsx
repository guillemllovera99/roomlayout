export default function Toolbar(){
  return (
    <div className="flex gap-2 p-2 bg-white/80 backdrop-blur rounded-xl shadow">
      <button className="px-3 py-1 rounded-md border bg-white">Select</button>
      <button className="px-3 py-1 rounded-md border bg-white">Wall</button>
      <button className="px-3 py-1 rounded-md border bg-white">Room</button>
    </div>
  );
}
