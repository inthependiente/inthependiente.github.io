import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Eye,
  RefreshCw,
  Loader2
} from "lucide-react";
import { PdrRow, AppConfig, Proyecto, Llamado } from "./types";

// Production API configurations (Supabase connection parameters)
const DEFAULT_SUPABASE_URL = "https://mvmlwelmilhitoetessx.supabase.co";
const DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12bWx3ZWxtaWxoaXRvZXRlc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTYxOTksImV4cCI6MjA5NjUzMjE5OX0.1MIsmOLAZM31b1BsysxII88U6JzOQWMp5kNDRiFmCnc";

// Minimal safe fallback definitions
const EMPTY_PROYECTO: Proyecto = {
  id: 0,
  productora: "Productora",
  campana: "Campaña",
  cliente: "",
  color_cliente: "#1e1b4b"
};

const EMPTY_LLAMADO: Llamado = {
  id: 0,
  proyecto_id: 0,
  d_o_d: "LLAMADO",
  fecha: "",
  llamado_hora: "08:00",
  desayuno: "-",
  almuerzo: "-",
  cena: "-",
  notas: ""
};

export default function App() {
  const [config] = useState<AppConfig>(() => {
    const saved = localStorage.getItem("rodajeAPP_config_v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { /* ignore */ }
    }
    return {
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_ANON_KEY,
      selectedLlamadoId: 42,
      mode: "online"
    };
  });

  const [entered, setEntered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Core Data
  const [proyecto, setProyecto] = useState<Proyecto>(EMPTY_PROYECTO);
  const [llamado, setLlamado] = useState<Llamado>(EMPTY_LLAMADO);

  const [proyectosList, setProyectosList] = useState<Proyecto[]>(() => {
    const cached = localStorage.getItem("rodajeAPP_v2_cache_all_proyectos");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [llamadosList, setLlamadosList] = useState<Llamado[]>(() => {
    const cached = localStorage.getItem("rodajeAPP_v2_cache_all_llamados");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { /* ignore */ }
    }
    return [];
  });

  const [pdrRows, setPdrRows] = useState<PdrRow[]>([]);
  const [localCompletedTimes, setLocalCompletedTimes] = useState<Record<number, string>>({});

  // Lightbox modal Gallery
  const [activeRefImage, setActiveRefImage] = useState<string | null>(null);
  const [imageGallery, setImageGallery] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Clock dynamic minutes
  const [clockMinutes, setClockMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Setup clock listener (updates once per minute)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setClockMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Sync projects and llamados list initially from cache & live Supabase
  useEffect(() => {
    const fetchInitialIndex = async () => {
      try {
        const headers = {
          "apikey": config.supabaseAnonKey,
          "Authorization": `Bearer ${config.supabaseAnonKey}`,
          "Content-Type": "application/json"
        };
        const allProjRes = await fetch(`${config.supabaseUrl}/rest/v1/proyectos?select=*`, { headers });
        if (allProjRes.ok) {
          const allProjData = await allProjRes.json();
          if (allProjData && allProjData.length > 0) {
            setProyectosList(allProjData);
            localStorage.setItem("rodajeAPP_v2_cache_all_proyectos", JSON.stringify(allProjData));
          }
        }
        const allLlamRes = await fetch(`${config.supabaseUrl}/rest/v1/llamados?select=*`, { headers });
        if (allLlamRes.ok) {
          const allLlamData = await allLlamRes.json();
          if (allLlamData && allLlamData.length > 0) {
            setLlamadosList(allLlamData);
            localStorage.setItem("rodajeAPP_v2_cache_all_llamados", JSON.stringify(allLlamData));
          }
        }
      } catch (err) {
        console.warn("Could not load initial index from Supabase", err);
      }
    };
    if (navigator.onLine) {
      fetchInitialIndex();
    }
  }, [config.supabaseUrl, config.supabaseAnonKey]);

  // Read raw database or cache upon loading or changing selected llamado
  const loadCachedOrFetch = useCallback(async (forcedId?: number) => {
    const activeId = forcedId || config.selectedLlamadoId || 42;
    setLoading(true);

    const cachedProyecto = localStorage.getItem(`rodajeAPP_v2_cache_proyecto_${activeId}`);
    const cachedLlamado = localStorage.getItem(`rodajeAPP_v2_cache_llamado_${activeId}`);
    const cachedPdr = localStorage.getItem(`rodajeAPP_v2_cache_pdr_${activeId}`);
    const cachedCompTimes = localStorage.getItem(`rodajeAPP_v2_cache_compTimes_${activeId}`);

    if (cachedProyecto && cachedLlamado && cachedPdr) {
      try {
        setProyecto(JSON.parse(cachedProyecto));
        setLlamado(JSON.parse(cachedLlamado));
        setPdrRows(JSON.parse(cachedPdr));
        if (cachedCompTimes) {
          setLocalCompletedTimes(JSON.parse(cachedCompTimes));
        }
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }

    if (navigator.onLine) {
      try {
        const headers = {
          "apikey": config.supabaseAnonKey,
          "Authorization": `Bearer ${config.supabaseAnonKey}`,
          "Content-Type": "application/json"
        };

        const url = `${config.supabaseUrl}/rest/v1/llamados?id=eq.${activeId}&select=*,proyectos(*)`;
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const activeLlamado = data[0];
            let activeProyecto = activeLlamado.proyectos;
            if (!activeProyecto && proyectosList.length > 0) {
              const foundProj = proyectosList.find(p => p.id === activeLlamado.proyecto_id);
              if (foundProj) activeProyecto = foundProj;
            }

            if (activeProyecto) {
              setProyecto(activeProyecto);
              localStorage.setItem(`rodajeAPP_v2_cache_proyecto_${activeId}`, JSON.stringify(activeProyecto));
            }
            setLlamado(activeLlamado);
            localStorage.setItem(`rodajeAPP_v2_cache_llamado_${activeId}`, JSON.stringify(activeLlamado));

            // Fetch list in order
            const pdrUrl = `${config.supabaseUrl}/rest/v1/pdr?llamado_id=eq.${activeId}&select=id,orden,duracion_min,status,shotlist_id,shotlist(id,esc,plano,descripcion,cast_nombres,notas,referencia_urls)&order=orden.asc`;
            const pdrRes = await fetch(pdrUrl, { headers });
            if (pdrRes.ok) {
              const pdrData = await pdrRes.json();
              const parsed: PdrRow[] = pdrData.map((p: any) => ({
                id: p.id,
                orden: p.orden,
                duracion_min: p.duracion_min || 15,
                llamado_id: activeId,
                shotlist_id: p.shotlist_id,
                terminado: !!p.status,
                shotlist: {
                  id: p.shotlist?.id || Math.floor(Math.random() * 100000),
                  esc: p.shotlist?.esc || "12",
                  plano: p.shotlist?.plano || "1",
                  descripcion: p.shotlist?.descripcion || "Plano sin descripción",
                  cast_nombres: p.shotlist?.cast_nombres || "",
                  notas: p.shotlist?.notas || "",
                  referencia_urls: p.shotlist?.referencia_urls || ""
                }
              }));
              setPdrRows(parsed);
              localStorage.setItem(`rodajeAPP_v2_cache_pdr_${activeId}`, JSON.stringify(parsed));
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch active plan from Supabase", err);
      }
    }
    setLoading(false);
  }, [config.supabaseUrl, config.supabaseAnonKey, config.selectedLlamadoId, proyectosList]);

  // Synchronize on selected Called change
  useEffect(() => {
    loadCachedOrFetch();
  }, [loadCachedOrFetch]);

  // Synchronize matching list with fallback states
  useEffect(() => {
    if (proyectosList.length > 0 && proyecto.id === 0) {
      const activeLlamId = config.selectedLlamadoId;
      const matchingLlam = llamadosList.find(l => l.id === activeLlamId);
      if (matchingLlam) {
        const matchingProj = proyectosList.find(p => p.id === matchingLlam.proyecto_id);
        if (matchingProj) {
          setProyecto(matchingProj);
          setLlamado(matchingLlam);
          return;
        }
      }
      setProyecto(proyectosList[0]);
    }
  }, [proyectosList, llamadosList, config.selectedLlamadoId, proyecto.id]);

  useEffect(() => {
    if (llamadosList.length > 0 && llamado.id === 0) {
      const activeLlamId = config.selectedLlamadoId;
      const matchingLlam = llamadosList.find(l => l.id === activeLlamId);
      if (matchingLlam) {
        setLlamado(matchingLlam);
      } else {
        const related = llamadosList.filter(l => l.proyecto_id === proyecto.id);
        if (related.length > 0) {
          setLlamado(related[0]);
        }
      }
    }
  }, [llamadosList, proyecto.id, llamado.id, config.selectedLlamadoId]);

  // Sync project & default llamado with URL search parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get("id");
    const queryLlam = urlParams.get("llamado_id");

    if (queryLlam && llamadosList.length > 0) {
      const lId = parseInt(queryLlam, 10);
      const foundLlam = llamadosList.find(l => l.id === lId);
      if (foundLlam) {
        setLlamado(foundLlam);
        const foundProj = proyectosList.find(p => p.id === foundLlam.proyecto_id);
        if (foundProj) setProyecto(foundProj);
        setEntered(true);
        loadCachedOrFetch(lId);
      }
    } else if (queryId && proyectosList.length > 0) {
      const pId = parseInt(queryId, 10);
      const foundProj = proyectosList.find(p => p.id === pId);
      if (foundProj) {
        setProyecto(foundProj);
        const related = llamadosList.filter(l => l.proyecto_id === pId);
        if (related.length > 0) {
          setLlamado(related[0]);
        }
      }
    }
  }, [proyectosList, llamadosList, loadCachedOrFetch]);

  // Timings algorithms
  const baseLlamadoMinutes = parseTimeToMinutes(llamado.llamado_hora || "08:00");

  function parseTimeToMinutes(tStr: string): number {
    const m = (tStr || "08:00").match(/^(\d{1,2}):(\d{2})/);
    if (!m) return 480;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  function formatMinutesToTime(min: number): string {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 1. Planned timetable mapping
  let planCumulative = baseLlamadoMinutes;
  const rawPlanTimings = pdrRows.map((row) => {
    const start = planCumulative;
    planCumulative += row.duracion_min;
    return {
      pdrId: row.id,
      plannedStartStr: formatMinutesToTime(start),
      plannedEndStr: formatMinutesToTime(planCumulative),
      startMin: start,
      endMin: planCumulative
    };
  });

  // 2. Estimated timetable logic matching Swift computation
  let runningEstEnd = baseLlamadoMinutes;
  const wrapEstTimings = pdrRows.map((row, idx) => {
    const planTimes = rawPlanTimings[idx] || { startMin: baseLlamadoMinutes, endMin: baseLlamadoMinutes + row.duracion_min };
    
    let origStartMin: number;
    if (idx === 0) {
      origStartMin = baseLlamadoMinutes;
    } else {
      const prevRow = pdrRows[idx - 1];
      if (prevRow.terminado && localCompletedTimes[prevRow.id]) {
        origStartMin = parseTimeToMinutes(localCompletedTimes[prevRow.id]);
      } else {
        origStartMin = runningEstEnd;
      }
    }
    
    runningEstEnd = origStartMin + row.duracion_min;
    
    let estStartStr = "";
    let estEndStr = "";
    
    if (row.terminado && localCompletedTimes[row.id]) {
      const lockedStr = localCompletedTimes[row.id];
      estStartStr = lockedStr;
      estEndStr = lockedStr;
    } else {
      const isFirstPending = idx === 0 || pdrRows[idx - 1].terminado;
      let start: number;
      if (isFirstPending) {
        const nowTime = clockMinutes;
        const schedTime = planTimes.startMin;
        const diff = nowTime - schedTime;
        start = diff > 0 ? nowTime : schedTime;
      } else {
        start = runningEstEnd;
      }
      estStartStr = formatMinutesToTime(start);
      estEndStr = formatMinutesToTime(start + row.duracion_min);
    }
    
    return {
      pdrId: row.id,
      estimadaStartStr: estStartStr,
      estimadaEndStr: estEndStr,
      originalEstimadaStart: formatMinutesToTime(origStartMin)
    };
  });

  // 3. Dynamic Estado heading calculation
  const analyzeRealTimeCalculatedState = () => {
    if (pdrRows.length === 0) {
      return { text: "SIN PLANOS EN EL PLAN", class: "bg-slate-900 border-slate-700 text-zinc-350" };
    }

    if (llamado && llamado.fecha) {
      try {
        const targetDateStr = llamado.fecha.substring(0, 10);
        const parts = targetDateStr.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : targetDateStr;
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayDateStr = `${year}-${month}-${day}`;

        if (targetDateStr !== todayDateStr) {
          if (targetDateStr > todayDateStr) {
            return { text: `PROGRAMADO: ${formattedDate}`, class: "bg-indigo-950/85 border-indigo-900/40 text-indigo-305 font-bold font-mono text-center" };
          } else {
            return { text: `CONCLUIDO: ${formattedDate}`, class: "bg-slate-900/90 border-slate-850/60 text-slate-400 font-medium font-mono text-center" };
          }
        }
      } catch (err) {
        console.error("Error comparing dates", err);
      }
    }

    const firstPendingIdx = pdrRows.findIndex((row) => !row.terminado);

    if (firstPendingIdx !== -1) {
      let a = baseLlamadoMinutes;
      for (let i = 0; i < firstPendingIdx; i++) {
        a += pdrRows[i].duracion_min;
      }
      const b = pdrRows[firstPendingIdx].duracion_min;
      const c = a + b;
      const d = clockMinutes;
      
      if (d > c) {
        const diff = d - c;
        return { text: `${diff} MINUTOS ATRASADO`, class: "bg-rose-950/90 border-rose-900/40 text-rose-400 font-black font-mono tracking-wide text-center" };
      } else if (d >= a && d <= c) {
        return { text: "RODAJE A TIEMPO", class: "bg-cyan-950/90 border-cyan-900/40 text-cyan-400 font-black font-mono tracking-wide text-center" };
      } else {
        const diff = c - d;
        return { text: `${diff} MINUTOS ADELANTADO`, class: "bg-emerald-950/90 border-emerald-900/40 text-emerald-400 font-black font-mono tracking-wide text-center" };
      }
    } else {
      const lastDone = pdrRows[pdrRows.length - 1];
      if (lastDone && localCompletedTimes[lastDone.id]) {
        const actualMin = parseTimeToMinutes(localCompletedTimes[lastDone.id]);
        
        let totalPlanMin = baseLlamadoMinutes;
        for (const r of pdrRows) {
          totalPlanMin += r.duracion_min;
        }
        
        const difference = actualMin - totalPlanMin;
        if (difference === 0) {
          return { text: "RODAJE FINALIZADO A TIEMPO", class: "bg-cyan-950/90 border-cyan-900/40 text-cyan-400 font-black font-mono tracking-wide text-center" };
        } else if (difference < 0) {
          return { text: `FINALIZADO: ${Math.abs(difference)} MIN ADELANTO`, class: "bg-emerald-950/90 border-emerald-900/40 text-emerald-400 font-black font-mono tracking-wide text-center" };
        } else {
          return { text: `FINALIZADO: ${difference} MIN RETRASO`, class: "bg-rose-950/90 border-rose-900/40 text-rose-400 font-black font-mono tracking-wide text-center" };
        }
      }
    }

    return { text: "RODAJE INICIADO A TIEMPO", class: "bg-cyan-950/90 border-cyan-900/40 text-cyan-300 font-mono text-center" };
  };

  const calculatedState = analyzeRealTimeCalculatedState();

  // "Toma Actual" timer calculation
  const getTomaActualText = (): string => {
    if (pdrRows.length === 0) return "";
    
    // Find the first pending row index
    const firstPendingIdx = pdrRows.findIndex((row) => !row.terminado);
    
    // If all rows are completed, there is no active row/toma
    if (firstPendingIdx === -1) {
      return "";
    }
    
    let diff = 0;
    if (firstPendingIdx === 0) {
      // First row: difference between current time and planned start time of the chamado
      diff = clockMinutes - baseLlamadoMinutes;
    } else {
      // Following rows: difference between current time and "terminada" time of the last completed row
      const lastCompletedRow = pdrRows[firstPendingIdx - 1];
      const completedTimeStr = localCompletedTimes[lastCompletedRow.id];
      if (completedTimeStr) {
        const completedMinutes = parseTimeToMinutes(completedTimeStr);
        diff = clockMinutes - completedMinutes;
      } else {
        // Fallback: use its planned end time
        const prevPlanTimes = rawPlanTimings[firstPendingIdx - 1];
        if (prevPlanTimes) {
          const prevPlannedEndMin = parseTimeToMinutes(prevPlanTimes.plannedEndStr);
          diff = clockMinutes - prevPlannedEndMin;
        }
      }
    }
    
    return `PLANO ACTUAL - ${diff}`;
  };

  const tomaActualText = getTomaActualText();

  // Reference visual lightbox handler
  const triggerLightboxOpen = (selectedRow: PdrRow) => {
    const allVisualUrls = pdrRows
      .map((r) => r.shotlist?.referencia_urls)
      .join(",")
      .split(",")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http") || u.startsWith("https"));

    if (allVisualUrls.length > 0) {
      setImageGallery(allVisualUrls);
      const rowUr = (selectedRow.shotlist?.referencia_urls || "").split(",")[0]?.trim();
      const matchIdx = allVisualUrls.indexOf(rowUr);
      const defaultIdx = matchIdx >= 0 ? matchIdx : 0;
      setGalleryIndex(defaultIdx);
      setActiveRefImage(allVisualUrls[defaultIdx]);
    } else {
      alert("Este plano no tiene referencias de imágenes válidas guardadas.");
    }
  };

  const handlePrevGalleryImage = () => {
    if (imageGallery.length === 0) return;
    const nextIdx = (galleryIndex - 1 + imageGallery.length) % imageGallery.length;
    setGalleryIndex(nextIdx);
    setActiveRefImage(imageGallery[nextIdx]);
  };

  const handleNextGalleryImage = () => {
    if (imageGallery.length === 0) return;
    const nextIdx = (galleryIndex + 1) % imageGallery.length;
    setGalleryIndex(nextIdx);
    setActiveRefImage(imageGallery[nextIdx]);
  };

  const relatedLlamados = estimadosLlamadosForProject(proyecto.id);

  function estimadosLlamadosForProject(projId: number): Llamado[] {
    return llamadosList.filter((l) => l.proyecto_id === projId);
  }

  if (!entered) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col gap-6 text-center relative overflow-hidden">
          
          {loading && (
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center z-10 transition">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          )}

          {/* Logo Cliente / Titular */}
          <div className="flex justify-center">
            <div 
              style={{ backgroundColor: proyecto?.color_cliente || '#1e1b4b' }}
              className="w-24 h-24 rounded-2xl flex items-center justify-center p-2.5 border border-slate-800/60 shadow-inner overflow-hidden"
            >
              {proyecto?.cliente && (proyecto.cliente.startsWith("http://") || proyecto.cliente.startsWith("https://")) ? (
                <img
                  src={proyecto.cliente}
                  alt="Cliente Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-center text-xs font-black text-white uppercase tracking-wider break-words line-clamp-3">
                  {proyecto?.cliente || "CLIENTE"}
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-b border-slate-850/60 py-4 my-1 space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-white font-sans">
              {proyecto?.campana || (proyectosList.length === 0 ? "Cargando proyecto..." : "Campaña")}
            </h2>
            <p className="text-xs text-indigo-400 font-mono font-medium uppercase tracking-wider">
              {proyecto?.productora || "Productora"}
            </p>
          </div>

          {/* Selectors */}
          <div className="space-y-4">
            
            {/* Called dropdown selection */}
            <div className="w-full text-left space-y-1.5">
              <label className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block font-mono">
                Seleccionar Llamado:
              </label>
              <select
                value={llamado.id || ""}
                onChange={(e) => {
                  const lId = parseInt(e.target.value, 10);
                  const selectedLlam = llamadosList.find(l => l.id === lId);
                  if (selectedLlam) {
                    setLlamado(selectedLlam);
                    loadCachedOrFetch(lId);
                  }
                }}
                className="bg-slate-950 border border-slate-850/80 text-amber-400 text-sm font-bold rounded-xl px-4 py-3 w-full focus:border-indigo-500 focus:outline-none cursor-pointer font-mono shadow-inner"
              >
                {relatedLlamados.length === 0 ? (
                  <option value="" className="bg-slate-950 text-slate-500 col-span-3">
                    -- No hay llamados disponibles --
                  </option>
                ) : (
                  relatedLlamados.map((l) => (
                    <option key={l.id} value={l.id} className="bg-slate-955 text-amber-400">
                      {l.d_o_d || `Llamado ${l.id}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Summarized called times stats widget */}
            {llamado.id !== 0 && (
              <div className="bg-slate-950/40 border border-slate-850/50 rounded-2xl p-4 text-left text-xs space-y-2 font-mono text-slate-400">
                <div className="flex justify-between border-b border-slate-850/40 pb-1.5">
                  <span className="text-slate-500">Fecha:</span>
                  <span className="text-slate-200 font-bold">
                    {(() => {
                      if (llamado.fecha) {
                        const dateStr = llamado.fecha.substring(0, 10);
                        const parts = dateStr.split('-');
                        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
                      }
                      return "-";
                    })()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-850/40 pb-1.5">
                  <span className="text-slate-500">Hora de Llamado:</span>
                  <span className="text-amber-400 font-bold">{llamado.llamado_hora || "08:00"}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-0.5">
                  <span className="text-slate-500">Comidas:</span>
                  <span className="text-slate-300">
                    🥪 {llamado.desayuno || "-"} &nbsp;&bull;&nbsp; 🍲 {llamado.almuerzo || "-"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Launch layout button */}
          <div className="pt-2">
            <button
              onClick={() => {
                if (llamado.id !== 0) {
                  setEntered(true);
                } else {
                  alert("Por favor selecciona un llamado válido para ingresar.");
                }
              }}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-450 hover:to-amber-550 active:scale-[0.98] text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20 hover:shadow-amber-500/10 transition duration-150 uppercase tracking-widest font-sans cursor-pointer"
            >
              <span>Ingresar al Plan</span>
              <ChevronRight className="w-4 h-4 text-slate-950 shrink-0" />
            </button>
          </div>

          <div className="text-[10px] text-slate-650 font-mono text-center">
            rodajeApp v1.0 (inthependiente)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased relative">
      
      {/* Top sticky status widget banner */}
      <div className={`sticky top-0 z-40 transition-colors backdrop-blur-md border-b flex items-center justify-center px-4 py-3 md:px-6 shadow-xl ${calculatedState.class}`}>
        <div className="flex items-center gap-3 justify-center text-center">
          <Clock className="w-5 h-5 shrink-0 text-indigo-300" />
          <h1 className="text-sm md:text-base font-black tracking-wide font-mono uppercase flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>{calculatedState.text}</span>
            {tomaActualText && (
              <>
                <span className="opacity-40 hidden sm:inline">|</span>
                <span className="text-amber-400 bg-slate-950/40 px-2.5 py-0.5 rounded-md border border-amber-500/20 font-extrabold text-xs md:text-sm tracking-normal uppercase">
                  {tomaActualText}
                </span>
              </>
            )}
          </h1>
          {loading && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0 ml-1.5" />}
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 flex-1 flex flex-col gap-6">

        {/* Timeline Frame */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col justify-between">
          <div>
            <div className="bg-slate-950/60 px-4 py-3 border-b border-slate-850 flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold tracking-wider uppercase">PLAN DE RODAJE</span>
              <button
                onClick={() => setEntered(false)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:bg-[#1f1a4a]/40 rounded border border-indigo-900/40 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Volver a Inicio</span>
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-950/30 text-[8px] font-bold text-slate-450 uppercase tracking-widest border-b border-slate-850">
                    <th className="py-3 px-3 text-center w-[50px]">Status</th>
                    <th className="py-3 px-2 text-center w-[45px]">Esc/Pl</th>
                    <th className="py-3 px-3 text-center w-[65px]">Plan</th>
                    <th className="py-3 px-3 text-center w-[75px] bg-amber-950/10 text-amber-400">Estimada</th>
                    <th className="py-3 px-4">Descripción y Notas</th>
                    <th className="py-3 px-3 text-center w-[112px]">Referencias</th>
                  </tr>
                </thead>
                <tbody>
                  {pdrRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center italic text-sm text-slate-500">
                        {loading ? "Sincronizando plan..." : "No hay planos cargados para este día."}
                      </td>
                    </tr>
                  ) : (
                    pdrRows.map((row, index) => {
                      const planTimes = rawPlanTimings[index] || { plannedStartStr: "08:00", plannedEndStr: "08:15" };
                      const estTimes = wrapEstTimings[index] || { estimadaStartStr: "08:00", estimadaEndStr: "08:15", originalEstimadaStart: "08:00" };
                      const firstPhoto = row.shotlist?.referencia_urls && row.shotlist.referencia_urls.trim().length > 6
                        ? row.shotlist.referencia_urls.split(",")[0].trim()
                        : null;

                      const isSpecialRow = row.shotlist?.plano?.toUpperCase() === "ES";

                      return (
                        <tr
                          key={row.id}
                          className={`group align-middle hover:bg-slate-950/60 border-b border-indigo-950/10 transition duration-150 select-none ${
                            row.terminado ? "bg-slate-950/40 opacity-50" : ""
                          } ${
                            isSpecialRow ? "bg-[#18142d] hover:bg-[#201b3d] border-b border-indigo-900/30" : ""
                          }`}
                        >
                          {/* Status Finished read-only marker */}
                          <td className="py-3 px-3 text-center w-[50px]">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition mx-auto border ${
                                row.terminado
                                  ? "bg-emerald-950 text-emerald-400 border-emerald-500/60 shadow-lg"
                                  : "bg-slate-950/20 text-slate-850 border-slate-900/30 opacity-30"
                              }`}
                              title={row.terminado ? "Plano Terminado" : "Plano Pendiente"}
                            >
                              <CheckCircle className={`w-5 h-5 ${row.terminado ? "fill-emerald-400/20" : ""}`} />
                            </div>
                            {row.terminado && (
                              <div className="mt-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold font-mono tracking-tighter text-emerald-400 block leading-none text-center">
                                  {localCompletedTimes[row.id] || planTimes.plannedEndStr}
                                </span>
                              </div>
                            )}
                          </td>

                          {isSpecialRow ? (
                            <td colSpan={5} className="py-4 px-6 text-center">
                              <div className="font-extrabold text-sm text-slate-200 uppercase tracking-wider py-1 max-w-xl mx-auto drop-shadow-sm leading-relaxed">
                                {row.shotlist?.descripcion || "FILA ESPECIAL"}
                              </div>
                              {row.shotlist?.notas && (
                                <div className="text-[10px] text-indigo-400 font-mono mt-1 font-medium italic">
                                  NOTAS: {row.shotlist.notas}
                                </div>
                              )}
                            </td>
                          ) : (
                            <>
                              {/* Esc / Plano */}
                              <td className="py-3 px-2 text-center w-[45px]">
                                <div className="flex flex-col gap-0.5 items-center">
                                  <span className="text-[9px] text-[#94a3b8] font-mono font-bold leading-none">ESC</span>
                                  <span className="text-[14px] font-bold font-mono text-slate-200">{row.shotlist?.esc || "-"}</span>
                                  <span className="text-[9px] text-[#94a3b8] font-mono font-bold leading-none mt-1">PL</span>
                                  <span className="text-[14px] font-bold font-mono text-indigo-400">{row.shotlist?.plano || "-"}</span>
                                </div>
                              </td>

                              {/* Planned time */}
                              <td className="py-3 px-3 text-center font-mono w-[65px]">
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="text-[14px] font-semibold text-slate-100">{planTimes.plannedStartStr}</span>
                                  <span className="text-[8px] text-slate-500 leading-none">&bull;</span>
                                  <span className="text-[14px] font-bold text-slate-400">{planTimes.plannedEndStr}</span>
                                </div>
                              </td>

                              {/* Estimated time */}
                              <td className="py-3 px-3 text-center font-mono bg-amber-955 text-amber-300 w-[75px]">
                                <span className="text-[10px] font-semibold text-amber-500/80 block leading-none mb-1">INICIA</span>
                                <div className="font-black text-[16px] text-amber-450 leading-tight">{estTimes.estimadaStartStr}</div>
                                <span className="text-[10px] text-slate-500 block mt-1">{estTimes.estimadaEndStr}</span>
                              </td>

                              {/* Description & NOTES */}
                              <td className="py-3 px-4 text-xs">
                                <div className="flex items-start gap-1">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-slate-200 font-medium text-sm leading-relaxed break-words text-justify">
                                      {row.shotlist?.descripcion || <span className="italic text-slate-600">Sin descripción</span>}
                                    </p>
                                    {row.shotlist?.notas ? (
                                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                                        <span className="text-indigo-400 font-black tracking-wider shrink-0 uppercase text-[10px]">NOTAS:</span>
                                        <span className="text-slate-400 font-mono break-words">{row.shotlist.notas}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>

                              {/* References Lightbox zoom thumbnails */}
                              <td className="py-3 px-3 text-center w-[112px]">
                                {firstPhoto ? (
                                  <div 
                                    className="relative group/photo inline-block cursor-zoom-in font-sans"
                                    onClick={(e) => { e.stopPropagation(); triggerLightboxOpen(row); }}
                                  >
                                    <img
                                      src={firstPhoto}
                                      alt="Reference"
                                      className="w-[100px] h-[55px] object-cover rounded-lg border border-slate-750 group-hover/photo:border-amber-400 transition animate-fade-in"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-black/45 rounded-lg opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition">
                                      <Eye className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-600 select-none italic font-mono">-</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack Cards Layout */}
            <div className="block md:hidden divide-y divide-slate-850">
              {pdrRows.length === 0 ? (
                <div className="py-16 text-center italic text-sm text-slate-500">
                  {loading ? "Sincronizando plan..." : "No hay planos cargados para este día."}
                </div>
              ) : (
                pdrRows.map((row, index) => {
                  const planTimes = rawPlanTimings[index] || { plannedStartStr: "08:00", plannedEndStr: "08:15" };
                  const estTimes = wrapEstTimings[index] || { estimadaStartStr: "08:00", estimadaEndStr: "08:15", originalEstimadaStart: "08:05" };
                  const firstPhoto = row.shotlist?.referencia_urls && row.shotlist.referencia_urls.trim().length > 6
                    ? row.shotlist.referencia_urls.split(",")[0].trim()
                    : null;

                  const isSpecialRow = row.shotlist?.plano?.toUpperCase() === "ES";

                  if (isSpecialRow) {
                    return (
                      <div
                        key={row.id}
                        className={`p-4 bg-[#18142d] border-b border-slate-850 select-none ${
                          row.terminado ? "opacity-50" : ""
                        }`}
                      >
                        <div className="font-extrabold text-sm text-slate-200 uppercase tracking-wider text-center leading-relaxed font-sans">
                          {row.shotlist?.descripcion || "FILA ESPECIAL"}
                        </div>
                        {row.shotlist?.notas && (
                          <div className="text-[10px] text-indigo-400 font-mono mt-1 font-medium italic text-center">
                            NOTAS: {row.shotlist.notas}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={row.id}
                      className={`p-4 transition duration-150 select-none flex flex-col gap-3 ${
                        row.terminado ? "bg-slate-950/20 opacity-60" : "bg-slate-900/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-950 text-[10px] font-bold font-mono px-2 py-1 rounded border border-slate-800 text-slate-400">
                            ESC <span className="text-slate-100 font-extrabold text-xs">{row.shotlist?.esc || "-"}</span>
                          </span>
                          <span className="bg-indigo-950/60 text-[10px] font-bold font-mono px-2 py-1 rounded border border-indigo-900/40 text-indigo-300">
                            PLANO <span className="text-indigo-400 font-extrabold text-xs">{row.shotlist?.plano || "-"}</span>
                          </span>
                        </div>

                        <div>
                          {row.terminado ? (
                            <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5 fill-emerald-400/10 shrink-0" />
                              <span>FIN @ {localCompletedTimes[row.id] || planTimes.plannedEndStr}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse shrink-0"></span>
                              <span>PENDIENTE</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-950/30 border border-slate-850/55 rounded-xl p-2.5 text-xs font-mono">
                        <div className="flex flex-col items-center justify-center border-r border-slate-850/60 py-0.5">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5 text-center">PLANIFICADO</span>
                          <div className="flex items-center gap-1 text-[13px] font-semibold text-slate-200">
                            <span>{planTimes.plannedStartStr}</span>
                            <span className="text-[10px] text-slate-500">&bull;</span>
                            <span className="text-slate-400">{planTimes.plannedEndStr}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center py-0.5 text-amber-300 bg-amber-955 rounded-lg">
                          <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mb-0.5 text-center">ESTIMADO</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[14px] font-black text-amber-450">{estTimes.estimadaStartStr}</span>
                            <span className="text-[10px] text-amber-600/60">&bull;</span>
                            <span className="text-[11px] text-slate-500">{estTimes.estimadaEndStr}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0 font-sans">
                          <p className="text-slate-200 font-medium text-[13px] leading-relaxed break-words text-justify">
                            {row.shotlist?.descripcion || <span className="italic text-slate-600">Sin descripción</span>}
                          </p>
                          {row.shotlist?.notes || row.shotlist?.notas ? (
                            <div className="flex items-start gap-1.5 mt-2 text-[11px]">
                              <span className="text-indigo-300 font-black tracking-wider shrink-0 uppercase text-[9px] mt-0.5 font-mono">NOTAS:</span>
                              <span className="text-slate-400 font-mono break-words leading-relaxed">{row.shotlist.notas || row.shotlist.notes}</span>
                            </div>
                          ) : null}
                        </div>

                        {firstPhoto && (
                          <div
                            className="shrink-0 relative cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); triggerLightboxOpen(row); }}
                          >
                            <img
                              src={firstPhoto}
                              alt="Ref"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-800"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-slate-950/20 px-4 py-3 border-t border-slate-850 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 text-[11px] text-slate-500 font-mono">
            <span>Total Tomas: {pdrRows.length}</span>
            <span className="text-slate-600 sm:border-l sm:border-slate-800 sm:pl-6">rodajeApp v1.0 (inthependiente)</span>
          </div>
        </div>
      </div>

      {/* Lightbox full gallery modal */}
      {activeRefImage && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <button
            onClick={() => setActiveRefImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-4xl w-full flex flex-col items-center">
            <div className="relative w-full max-h-[70vh] flex justify-center items-center overflow-hidden bg-slate-950 rounded-2xl border border-slate-800">
              <img
                src={activeRefImage}
                alt="Reference"
                className="max-h-full max-w-full object-contain"
                referrerPolicy="no-referrer"
              />

              <button
                onClick={handlePrevGalleryImage}
                className="absolute left-3 p-3 bg-slate-900/80 hover:bg-indigo-600 rounded-full text-white backdrop-blur-sm transition border border-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handleNextGalleryImage}
                className="absolute right-3 p-3 bg-slate-900/80 hover:bg-indigo-600 rounded-full text-white backdrop-blur-sm transition border border-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="text-center mt-4 text-slate-300">
              <p className="text-sm font-bold font-mono tracking-wider text-emerald-400">
                REFERENCIA {galleryIndex + 1} DE {imageGallery.length}
              </p>
              <p className="text-xs text-slate-450 mt-1 max-w-xl mx-auto font-sans">
                {pdrRows.find((r) => r.shotlist?.referencia_urls?.includes(activeRefImage))?.shotlist?.descripcion || "Referencia visual del Plan de Rodaje"}
              </p>

              <div className="flex justify-center gap-1.5 mt-3 overflow-x-auto max-w-lg p-1">
                {imageGallery.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setGalleryIndex(i);
                      setActiveRefImage(img);
                    }}
                    className={`w-10 h-10 rounded border-2 overflow-hidden transition-all shrink-0 cursor-pointer ${
                      galleryIndex === i ? "border-emerald-400 scale-105" : "border-slate-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
