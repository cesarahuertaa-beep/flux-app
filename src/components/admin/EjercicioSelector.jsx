import { useState } from "react";
import { C, GRUPOS, TIPOS } from "../../styles/theme";
import { Tag } from "../ui";

export function EjercicioSelector({ biblioteca, onSelect, selected }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");
  const [filtroTipo, setFiltroTipo] = useState("Todos");

  const filtrados = biblioteca.filter(e => {
    const yaEsta = selected.find(s => s.biblioteca_id===e.id);
    if (yaEsta) return false;
    const matchG = filtroGrupo==="Todos" || e.grupo_muscular===filtroGrupo;
    const matchT = filtroTipo==="Todos" || e.tipo_movimiento===filtroTipo;
    const matchB = e.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchG && matchT && matchB;
  });

  return (
    <div style={{background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,padding:12,marginBottom:8}}>
      <div style={{fontSize:12,color:C.muted,marginBottom:8,fontWeight:600}}>AGREGAR EJERCICIO DE LA BIBLIOTECA</div>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍 Buscar…" style={{maxWidth:160,padding:"6px 10px",fontSize:12}}/>
        <select value={filtroGrupo} onChange={e=>setFiltroGrupo(e.target.value)} style={{fontSize:12,padding:"6px 8px"}}>
          <option>Todos</option>{GRUPOS.map(g=><option key={g}>{g}</option>)}
        </select>
        <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={{fontSize:12,padding:"6px 8px"}}>
          <option>Todos</option>{TIPOS.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      {biblioteca.length===0
        ?<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:10}}>La biblioteca está vacía. Agrega ejercicios primero.</div>
        :filtrados.length===0
          ?<div style={{color:C.muted,fontSize:12,textAlign:"center",padding:10}}>No hay más ejercicios que coincidan.</div>
          :<div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:160,overflowY:"auto"}}>
            {filtrados.map(e=>(
              <button key={e.id} onClick={()=>onSelect(e)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,cursor:"pointer",color:C.text,fontSize:12}}>
                <div style={{width:24,height:24,borderRadius:4,overflow:"hidden",background:C.surface,flexShrink:0}}>
                  {e.gif_url?<img src={e.gif_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:14,lineHeight:"24px",display:"block",textAlign:"center"}}>🏋️</span>}
                </div>
                <span>{e.nombre}</span>
                <Tag color={C.accent}>{e.grupo_muscular}</Tag>
              </button>
            ))}
          </div>}
    </div>
  );
}
