import { saveAs } from "file-saver";
export default function RightPanel(){
  return (
    <div className="w-72 p-3 border-l bg-white/70 backdrop-blur space-y-4">
      <div className="font-semibold">Right Panel</div>
      <button
        onClick={()=>saveAs(new Blob([JSON.stringify({ok:true})],{type:'application/json'}),'project.json')}
        className="px-3 py-1 rounded bg-black text-white"
      >
        Save
      </button>
    </div>
  );
}
