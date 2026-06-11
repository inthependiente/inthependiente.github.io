import React, { useState } from "react";
import { DbTable } from "../types";
import { supabase } from "../supabaseClient";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  HelpCircle, 
  CornerDownRight, 
  Calendar, 
  Clock, 
  MapPin,
  Camera,
  AlertTriangle,
  ExternalLink,
  GripVertical,
  RefreshCcw,
  Layers
} from "lucide-react";

interface TableEditorProps {
  table: DbTable;
  data: any[];
  onAddClick: () => void;
  onEditClick: (row: any) => void;
  onDeleteClick: (id: number) => void;
  onRefresh?: () => void;
  lookups: {
    proyectos: any[];
    llamados: any[];
    locaciones: any[];
    crew: any[];
    shotlist: any[];
    ciudades: any[];
  };
}

export default function TableEditor({
  table,
  data,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
  lookups,
}: TableEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [crewSortMode, setCrewSortMode] = useState<"id" | "dept">("id");

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    proyecto_id: true,
    esc: true,
    plano: true,
    prep: true,
    descripcion: true,
    cast_nombres: true,
    locacion_id: true,
    notas: true,
    referencia_urls: true,
  });
  const [isUploadingRowId, setIsUploadingRowId] = useState<number | null>(null);
  const [newlyCreatedId, setNewlyCreatedId] = useState<number | null>(null);

  const handleQuickAddShotlist = async () => {
    setIsProcessing(true);
    try {
      const defaultProjId = lookups.proyectos && lookups.proyectos.length > 0
        ? lookups.proyectos[0].id
        : null;

      if (!defaultProjId) {
        alert("Primero crea un Proyecto para registrar renglones en el Shotlist.");
        return;
      }

      const maxOrden = data && data.length > 0 
        ? Math.max(...data.map(d => Number(d.orden || 0))) 
        : 0;

      const newRow = {
        proyecto_id: defaultProjId,
        esc: "1",
        plano: "1",
        orden: maxOrden + 1,
        prep: "",
        descripcion: "",
        cast_nombres: "",
        locacion_id: (lookups.locaciones && lookups.locaciones.length > 0) ? lookups.locaciones[0].id : null,
        notas: "",
        referencia_urls: ""
      };

      const { data: insertedData, error } = await supabase.from("shotlist").insert([newRow]).select();
      if (error) throw error;

      if (insertedData && insertedData.length > 0) {
        setNewlyCreatedId(insertedData[0].id);
      }

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al añadir fila: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAddPdr = async () => {
    setIsProcessing(true);
    try {
      const defaultLlamadoId = lookups.llamados && lookups.llamados.length > 0
        ? lookups.llamados[0].id
        : null;

      if (!defaultLlamadoId) {
        alert("Primero crea un Llamado para registrar renglones en el PDR.");
        return;
      }

      const defaultShotlistId = lookups.shotlist && lookups.shotlist.length > 0
        ? lookups.shotlist[0].id
        : null;

      if (!defaultShotlistId) {
        alert("Primero crea un registro en el Shotlist para vincularlo en el PDR.");
        return;
      }

      const maxOrden = data && data.length > 0 
        ? Math.max(...data.map(d => Number(d.orden || 0))) 
        : 0;

      const newRow = {
        llamado_id: defaultLlamadoId,
        shotlist_id: defaultShotlistId,
        orden: maxOrden + 1,
        duracion_min: 0
      };

      const { data: insertedData, error } = await supabase.from("pdr").insert([newRow]).select();
      if (error) throw error;

      if (insertedData && insertedData.length > 0) {
        setNewlyCreatedId(insertedData[0].id);
      }

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al añadir fila de PDR: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAddCrewLlamado = async () => {
    setIsProcessing(true);
    try {
      const defaultLlamadoId = lookups.llamados && lookups.llamados.length > 0
        ? lookups.llamados[0].id
        : null;

      if (!defaultLlamadoId) {
        alert("Primero crea un Llamado para asignar Crew.");
        return;
      }

      const defaultCrewId = lookups.crew && lookups.crew.length > 0
        ? lookups.crew[0].id
        : null;

      if (!defaultCrewId) {
        alert("Primero crea Personal de Crew para asignarlo al Llamado.");
        return;
      }

      const maxOrden = data && data.length > 0 
        ? Math.max(...data.map(d => Number(d.orden || 0))) 
        : 0;
      const maxPrioridad = data && data.length > 0 
        ? Math.max(...data.map(d => Number(d.prioridad || 0))) 
        : 0;

      const newRow = {
        llamado_id: defaultLlamadoId,
        crew_id: defaultCrewId,
        orden: maxOrden + 1,
        prioridad: maxPrioridad + 1
      };

      const { data: insertedData, error } = await supabase.from("crew_llamado").insert([newRow]).select();
      if (error) throw error;

      if (insertedData && insertedData.length > 0) {
        setNewlyCreatedId(insertedData[0].id);
      }

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al asignar Crew: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const [confirmModal, setConfirmModal] = useState<{
    type: "deleteAll" | "resetIds" | "sqlExplanation";
    isOpen: boolean;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{
    success: boolean;
    title: string;
    message: string;
    sqlStatement?: string;
  } | null>(null);

  const handleDeleteAll = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from(table).delete().gt("id", -1);
      
      if (error) {
        throw error;
      }
      
      if (onRefresh) {
        onRefresh();
      }

      setModalFeedback({
        success: true,
        title: "¡Éxito!",
        message: `Se han eliminado todas las filas de la tabla '${table}' de forma segura.`,
      });
      setConfirmModal({ type: "sqlExplanation", isOpen: true });
    } catch (err: any) {
      console.error("Error deleting all rows:", err);
      setModalFeedback({
        success: false,
        title: "Error al borrar todo",
        message: err.message || "Ocurrió un error inesperado al intentar borrar los registros.",
      });
      setConfirmModal({ type: "sqlExplanation", isOpen: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetIds = async () => {
    setIsProcessing(true);
    const sql = `ALTER TABLE ${table} ALTER COLUMN id RESTART WITH 1;`;
    try {
      const { error } = await supabase.rpc("execute_sql", { sql_text: sql });
      
      if (error) {
        throw error;
      }

      setModalFeedback({
        success: true,
        title: "¡IDs Reiniciados!",
        message: `Se reinició el contador secuencial de IDs para la tabla '${table}' a 1 de forma exitosa usando Postgres SQL.`,
      });
      setConfirmModal({ type: "sqlExplanation", isOpen: true });
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.warn("RPC SQL Reset fallback scenario active:", err);
      setModalFeedback({
        success: false,
        title: "Instrucciones de SQL requeridas",
        message: `El backend cliente en iFrame utiliza una clave 'anon'. Para reiniciar de forma segura el contador auto-numérico de IDs (secuencia AUTOINCREMENT) de la tabla '${table}', debes ejecutar la consulta SQL directamente en la consola de tu base de datos:`,
        sqlStatement: sql,
      });
      setConfirmModal({ type: "sqlExplanation", isOpen: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
  };

  const handleDrop = async (idx: number) => {
    if (draggedIndex === null || draggedIndex === idx) return;

    const items = [...filteredData];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(idx, 0, draggedItem);

    setDraggedIndex(null);

    try {
      const updates = items.map((item, index) => {
        const newOrder = index + 1;
        return supabase
          .from("pdr")
          .update({ orden: newOrder })
          .eq("id", item.id);
      });

      await Promise.all(updates);

      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      console.error("Error setting order:", err);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleInlineUpdate = async (rowId: number, fieldName: string, value: any) => {
    try {
      const { error } = await supabase
        .from(table)
        .update({ [fieldName]: value })
        .eq("id", rowId);

      if (error) {
        console.error("Error updating inline:", error.message);
        alert(`Error al actualizar inline: ${error.message}`);
      } else {
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Helper resolvers to render friendly text in table columns instead of raw IDs where possible
  const resolveProject = (id: number) => {
    const parent = lookups.proyectos.find((p) => p.id === id);
    return parent ? parent.campana : `Proyecto #${id}`;
  };

  const resolveLlamado = (id: number) => {
    const parent = lookups.llamados.find((l) => l.id === id);
    if (!parent) return `Llamado #${id}`;
    const proj = lookups.proyectos.find((p) => p.id === parent.proyecto_id);
    const projName = proj ? proj.campana : (parent.proyecto_id_campana || `Proyecto #${parent.proyecto_id}`);
    return `${projName} (${parent.d_o_d || "Día único"})`;
  };

  const resolveLocacion = (id: number | null | undefined) => {
    if (!id) return "Sin locación asignada";
    const parent = lookups.locaciones.find((l) => l.id === id);
    return parent ? parent.locacion : `Locación #${id}`;
  };

  const resolveCrewName = (id: number) => {
    const parent = lookups.crew.find((c) => c.id === id);
    return parent ? `${parent.nombre} [${parent.cargo || "S/C"}]` : `Crew #${id}`;
  };

  const resolveShotlistSnippet = (id: number) => {
    const parent = lookups.shotlist.find((s) => s.id === id);
    return parent ? `Esc: ${parent.esc || "S/E"} | Plano: ${parent.plano || "S/P"} (${parent.descripcion?.substring(0, 30)}...)` : `Plano #${id}`;
  };

  const resolveCiudad = (id: number | null | undefined) => {
    if (!id) return "Santiago";
    const parent = lookups.ciudades?.find((c) => c.id === id);
    return parent ? (parent.Nombre || parent.nombre || `Ciudad #${id}`) : `Ciudad #${id}`;
  };

  // Perform a case-insensitive search across ALL keys of a row to filter local records easily
  const filteredData = data.filter((row) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Check main text attributes inside row
    return Object.keys(row).some((key) => {
      const val = row[key];
      if (val === null || val === undefined) return false;
      const valString = String(val).toLowerCase();
      if (valString.includes(query)) return true;

      // also check resolved foreign labels
      if (key === "proyecto_id" && typeof val === "number") {
        return resolveProject(val).toLowerCase().includes(query);
      }
      if (key === "llamado_id" && typeof val === "number") {
        return resolveLlamado(val).toLowerCase().includes(query);
      }
      if (key === "locacion_id" && typeof val === "number") {
        return resolveLocacion(val).toLowerCase().includes(query);
      }
      if (key === "crew_id" && typeof val === "number") {
        return resolveCrewName(val).toLowerCase().includes(query);
      }
      if (key === "shotlist_id" && typeof val === "number") {
        return resolveShotlistSnippet(val).toLowerCase().includes(query);
      }

      return false;
    });
  });

  // Secondary sort for tables crew and crew_llamado based on user choice
  const sortedAndFilteredData = React.useMemo(() => {
    let sortedList = [...filteredData];
    if (table === "crew") {
      if (crewSortMode === "id") {
        sortedList.sort((a, b) => a.id - b.id);
      } else {
        sortedList.sort((a, b) => {
          const deptA = String(a.departamento || "").toLowerCase();
          const deptB = String(b.departamento || "").toLowerCase();
          if (deptA !== deptB) return deptA.localeCompare(deptB);
          return a.id - b.id;
        });
      }
    } else if (table === "crew_llamado") {
      if (crewSortMode === "id") {
        sortedList.sort((a, b) => {
          const ordA = a.orden === null || a.orden === undefined ? Infinity : Number(a.orden);
          const ordB = b.orden === null || b.orden === undefined ? Infinity : Number(b.orden);
          if (ordA !== ordB) return ordA - ordB;
          return a.id - b.id;
        });
      } else {
        sortedList.sort((a, b) => {
          const cA = lookups.crew.find((c) => c.id === a.crew_id);
          const cB = lookups.crew.find((c) => c.id === b.crew_id);
          const deptA = String(cA?.departamento || "").toLowerCase();
          const deptB = String(cB?.departamento || "").toLowerCase();
          if (deptA !== deptB) return deptA.localeCompare(deptB);
          
          const ordA = a.orden === null || a.orden === undefined ? Infinity : Number(a.orden);
          const ordB = b.orden === null || b.orden === undefined ? Infinity : Number(b.orden);
          if (ordA !== ordB) return ordA - ordB;
          return a.id - b.id;
        });
      }
    }
    return sortedList;
  }, [filteredData, table, crewSortMode, lookups.crew]);

  const getTableTitle = () => {
    const titles: Record<DbTable, string> = {
      proyectos: "Proyecto / Campaña",
      llamados: "Hojas de Llamado",
      locaciones: "Locaciones de Filmación",
      escenas: "Escenas",
      crew: "Crew",
      crew_llamado: "Crew en Llamado",
      cliente_agencia: "Cliente & Agencia",
      talento: "Talento",
      pdr: "Plan de Rodaje",
      shotlist: "Shotlist",
    };
    return titles[table] || table;
  };

  const handleDeleteTrigger = (id: number) => {
    if (confirmDeleteId === id) {
      onDeleteClick(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Auto-dismiss after 4 seconds
      setTimeout(() => setConfirmDeleteId((prev) => (prev === id ? null : prev)), 4000);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-6 overflow-hidden flex flex-col bg-neutral-50/50">
      
      {/* Header section with buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="font-condensed font-extrabold text-3xl text-neutral-800 uppercase tracking-tight">
            {getTableTitle()}
          </h2>
          <p className="text-sm text-neutral-500">
            Mostrando {filteredData.length} de {data.length} registros en total.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {["escenas", "talento", "pdr", "shotlist"].includes(table) && (
            <>
              <button
                onClick={() => setConfirmModal({ type: "deleteAll", isOpen: true })}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs hover:shadow-sm"
                title="Borrar todas las filas de esta tabla"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Borrar todo
              </button>
              
              <button
                onClick={() => setConfirmModal({ type: "resetIds", isOpen: true })}
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs hover:shadow-sm"
                title="Resetear valor de auto-incremento de ID de esta tabla a 1"
              >
                <RefreshCcw className="w-4 h-4 text-amber-500 animate-spin-hover" />
                Resetear IDs
              </button>
            </>
          )}

          <button
            onClick={onAddClick}
            className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-sm cursor-pointer"
            id={`btn-add-${table}`}
          >
            <Plus className="w-5 h-5 text-orange-500" />
            Nueva Entrada ({table})
          </button>
        </div>
      </div>

      {/* Search Input Card */}
      <div className="bg-white rounded-xl shadow-xs border border-neutral-200 p-4 shrink-0">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder={`Buscar por ID, nombre, campaña o cualquier campo en la tabla ${table}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-sm text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-800 focus:bg-white transition-all"
            />
          </div>

          {(table === "crew" || table === "crew_llamado") && (
            <div className="flex items-center gap-2.5 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-neutral-200">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider shrink-0">Ordenar por:</span>
              <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setCrewSortMode("id")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    crewSortMode === "id"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  {table === "crew_llamado" ? "NUM" : "ID (Asc)"}
                </button>
                <button
                  type="button"
                  onClick={() => setCrewSortMode("dept")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    crewSortMode === "dept"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  Departamento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Column visibility control for Shotlist */}
      {table === "shotlist" && (
        <div className="bg-white rounded-xl shadow-xs border border-neutral-200 p-4 shrink-0">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-neutral-500 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              <span>Columnas Visibles de Shotlist (Haz clic para alternar):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "proyecto_id", label: "Proyecto" },
                { key: "esc", label: "Escena" },
                { key: "plano", label: "Plano" },
                { key: "prep", label: "Prep Nº" },
                { key: "descripcion", label: "Descripción" },
                { key: "cast_nombres", label: "Cast" },
                { key: "locacion_id", label: "Locación" },
                { key: "notas", label: "Notas" },
                { key: "referencia_urls", label: "Referencia" },
              ].map((col) => {
                const isVisible = visibleColumns[col.key];
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                      isVisible
                        ? "bg-neutral-900 border-neutral-900 text-white"
                        : "bg-neutral-50 border-neutral-200 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="mr-1">{isVisible ? "✓" : "+"}</span>
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Database Table Display */}
      <div className="flex-1 bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-0">
        {filteredData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <HelpCircle className="w-12 h-12 text-neutral-300 mb-3" />
            <h4 className="font-bold text-lg text-neutral-700">No se encontraron registros</h4>
            <p className="text-neutral-500 text-sm max-w-sm mt-1">
              {searchQuery 
                ? "Prueba cambiando tu búsqueda o limpiando el filtro actual." 
                : "No existen filas en esta tabla todavía. Crea una entrada presionando el botón 'Nueva Entrada' de arriba."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 border border-neutral-300 text-xs font-semibold text-neutral-600 rounded-lg hover:bg-neutral-50"
              >
                Limpiar Búsqueda
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse relative">
              <thead>
                <tr className="bg-neutral-900 text-white font-condensed font-bold text-sm tracking-wide sticky top-0 uppercase z-10">
                  {table !== "crew_llamado" && table !== "shotlist" && table !== "pdr" && <th className="p-3.5 pl-6 w-20">ID</th>}
                  
                  {/* Dynamic headers depending on table */}
                  {table === "proyectos" && (
                    <>
                      <th className="p-3.5">Campaña</th>
                      <th className="p-3.5">Productora</th>
                      <th className="p-3.5">Colores de Marca</th>
                    </>
                  )}

                  {table === "llamados" && (
                    <>
                      <th className="p-3.5">Proyecto Relacionado</th>
                      <th className="p-3.5">Fecha / D.O.D</th>
                      <th className="p-3.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hora / Ciudad</th>
                      <th className="p-3.5">Comidas</th>
                    </>
                  )}

                  {table === "locaciones" && (
                    <>
                      <th className="p-3.5">Locación</th>
                      <th className="p-3.5">Dirección / Link Google Maps</th>
                      <th className="p-3.5">Centro Médico</th>
                    </>
                  )}

                  {table === "escenas" && (
                    <>
                      <th className="p-3.5 w-16">Orden</th>
                      <th className="p-3.5">Llamado</th>
                      <th className="p-3.5">Escena / Int-Ext</th>
                      <th className="p-3.5">Descripción / Elenco</th>
                    </>
                  )}

                  {table === "crew" && (
                    <>
                      <th className="p-3.5">Nombre</th>
                      <th className="p-3.5">Área / Cargo</th>
                      <th className="p-3.5">Contacto Celular</th>
                      <th className="p-3.5">Llamado</th>
                    </>
                  )}

                  {table === "crew_llamado" && (
                    <>
                      <th className="p-3.5">Orden</th>
                      <th className="p-3.5">Llamado</th>
                      <th className="p-3.5">Personal del Crew</th>
                      <th className="p-3.5">Departamento</th>
                      <th className="p-3.5">Prioridad</th>
                    </>
                  )}

                  {table === "cliente_agencia" && (
                    <>
                      <th className="p-3.5">Llamado</th>
                      <th className="p-3.5">Tipo / Nombre</th>
                      <th className="p-3.5">Empresa</th>
                      <th className="p-3.5">Horario Set</th>
                    </>
                  )}

                  {table === "talento" && (
                    <>
                      <th className="p-3.5">Orden</th>
                      <th className="p-3.5">Nombre</th>
                      <th className="p-3.5">Llamado / En Set / Status</th>
                      <th className="p-3.5">Notas</th>
                    </>
                  )}

                  {table === "pdr" && (
                    <>
                      <th className="p-3.5 w-16">Orden</th>
                      <th className="p-3.5">Llamado</th>
                      <th className="p-3.5">Toma del Shotlist</th>
                      <th className="p-3.5">Minutos</th>
                    </>
                  )}

                  {table === "shotlist" && (
                    <>
                      {visibleColumns.proyecto_id && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed">Proyecto</th>
                      )}
                      {visibleColumns.esc && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-24 text-center">Esc</th>
                      )}
                      {visibleColumns.plano && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-24 text-center">Plano</th>
                      )}
                      {visibleColumns.prep && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-28 text-center">Prep Nº</th>
                      )}
                      {visibleColumns.descripcion && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed min-w-[14rem]">Descripción</th>
                      )}
                      {visibleColumns.cast_nombres && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-28 text-center">Cast</th>
                      )}
                      {visibleColumns.locacion_id && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed">Locación</th>
                      )}
                      {visibleColumns.notas && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-40 text-center">Notas</th>
                      )}
                      {visibleColumns.referencia_urls && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-48 text-center">Referencia</th>
                      )}
                    </>
                  )}

                  <th className="p-3.5 pr-6 w-36 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-sans text-neutral-700 text-sm">
                {sortedAndFilteredData.map((row, index) => (
                  <tr 
                    key={`${table}_${row.id}`} 
                    className={`hover:bg-neutral-50/70 transition-colors ${
                      table === "pdr" ? "cursor-grab active:cursor-grabbing bg-white border-l-2 border-transparent hover:border-orange-500" : ""
                    } ${
                      table === "pdr" && draggedIndex === index ? "opacity-40 bg-neutral-105" : ""
                    }`}
                    draggable={table === "pdr"}
                    onDragStart={table === "pdr" ? () => handleDragStart(index) : undefined}
                    onDragOver={table === "pdr" ? (e) => handleDragOver(e, index) : undefined}
                    onDrop={table === "pdr" ? () => handleDrop(index) : undefined}
                    onDragEnd={table === "pdr" ? handleDragEnd : undefined}
                  >
                    {table !== "crew_llamado" && table !== "shotlist" && table !== "pdr" && (
                      <td className="p-3.5 pl-6 font-mono font-bold text-xs text-neutral-400">
                        <div className="flex items-center gap-1.5">
                          #{row.id}
                        </div>
                      </td>
                    )}
                    
                    {/* ───── TABLA: PROYECTOS ───── */}
                    {table === "proyectos" && (
                      <>
                        <td className="p-3.5">
                          <div className="font-bold text-neutral-900">{row.campana}</div>
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="font-semibold text-neutral-600">{row.productora}</div>
                          <div className="text-neutral-400 truncate max-w-xs">{row.direccion_productora || "Sin dirección"}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-2">
                            {row.color_cliente && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-sm border border-neutral-200 bg-white" style={{ borderLeftColor: row.color_cliente, borderLeftWidth: "4px" }}>
                                Cliente: <code className="font-mono">{row.color_cliente}</code>
                              </span>
                            )}
                            {row.color_campana && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-sm border border-neutral-200 bg-white" style={{ borderLeftColor: row.color_campana, borderLeftWidth: "4px" }}>
                                Campaña: <code className="font-mono">{row.color_campana}</code>
                              </span>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: LLAMADOS ───── */}
                    {table === "llamados" && (
                      <>
                        <td className="p-3.5 font-semibold text-neutral-800">
                          {resolveProject(row.proyecto_id)}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-semibold font-mono text-neutral-700">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            {row.fecha}
                          </div>
                          <div className="text-xs text-orange-600 font-bold uppercase">{row.d_o_d || "Día único"}</div>
                          <a
                            href={`./llamado.html?id=${row.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline mt-1.5 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" /> Ver Hoja de Llamado
                          </a>
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="font-bold text-neutral-700">{row.llamado_hora || "-- : --"}</div>
                          <div className="text-neutral-500 font-medium">{resolveCiudad(row.ciudad_id)}</div>
                        </td>
                        <td className="p-3.5 text-xs text-neutral-500">
                          <div>☕ Desayuno: <span className="font-bold">{row.desayuno || "No especifica"}</span></div>
                          <div>🍽️ Almuerzo: <span className="font-bold">{row.almuerzo || "No especifica"}</span></div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: LOCACIONES ───── */}
                    {table === "locaciones" && (
                      <>
                        <td className="p-3.5 font-bold text-neutral-900">{row.locacion}</td>
                        <td className="p-3.5 text-xs max-w-xs">
                          <div className="text-neutral-600 font-medium truncate">{row.direccion_loc || "Sin dirección"}</div>
                          {row.url_loc && (
                            <a href={row.url_loc} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5 font-sans break-all">
                              <MapPin className="w-3 h-3 flex-shrink-0" /> Abrir en Google Maps
                            </a>
                          )}
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="font-semibold text-red-700">🏥 {row.centro_medico || "Sin definir"}</div>
                          <div className="text-neutral-400 truncate">{row.direccion_med || "-"}</div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: ESCENAS ───── */}
                    {table === "escenas" && (
                      <>
                        <td className="p-3.5 font-mono font-bold text-sm text-neutral-800">{row.orden}º</td>
                        <td className="p-3.5 text-xs max-w-xs">
                          <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-md inline-block font-mono font-bold">{resolveLlamado(row.llamado_id)}</span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-neutral-900 font-mono text-sm">{row.escena}</div>
                          <div className="flex gap-1.5 mt-0.5">
                            {row.int_ext && <span className="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-sm font-bold">{row.int_ext}</span>}
                            {row.d_n && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-sm font-bold">{row.d_n}</span>}
                          </div>
                        </td>
                        <td className="p-3.5 text-xs max-w-sm">
                          <div className="text-neutral-600 truncate font-semibold">{row.descripcion || "Sin descripción"}</div>
                          <div className="text-orange-700 font-semibold mt-1">🎭 Elenco: <span className="text-neutral-500 font-normal">{row.cast_nombres || "Extras / Vacío"}</span></div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">📍 Loc: {resolveLocacion(row.locacion_id)}</div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: CREW (PERSONAL) ───── */}
                    {table === "crew" && (
                      <>
                        <td className="p-3.5 font-bold text-neutral-900">{row.nombre}</td>
                        <td className="p-3.5 text-xs">
                          <span className="font-bold text-neutral-700 uppercase bg-neutral-100 px-2 py-1 rounded-sm tracking-wide mr-1.5">{row.departamento || "Cámara"}</span>
                          <span className="text-neutral-600 font-medium">{row.cargo || "Asistente"}</span>
                        </td>
                        <td className="p-3.5 text-xs font-mono font-semibold text-neutral-600">{row.celular || "Sin celular"}</td>
                        <td className="p-3.5 text-xs font-mono font-bold text-neutral-700 bg-neutral-50 px-2 py-1 rounded inline-block">
                          {row.llamado_hora || "Sin definir"}
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: CREW_LLAMADO ───── */}
                    {table === "crew_llamado" && (
                      <>
                        <td className="p-3.5 font-mono text-xs">
                          <input
                            key={`${row.id}_${row.orden ?? ""}`}
                            type="number"
                            defaultValue={row.orden === undefined || row.orden === null ? "" : row.orden}
                            autoFocus={row.id === newlyCreatedId}
                            onFocus={(e) => {
                              if (row.id === newlyCreatedId) {
                                e.currentTarget.select();
                              }
                            }}
                            onBlur={(e) => {
                              if (row.id === newlyCreatedId) {
                                setNewlyCreatedId(null);
                              }
                              const val = e.target.value === "" ? null : Number(e.target.value);
                              if (val !== row.orden) {
                                handleInlineUpdate(row.id, "orden", val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-16 px-1.5 py-0.5 text-center font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:ring-1 focus:ring-neutral-800 focus:outline-hidden"
                            placeholder="—"
                          />
                        </td>
                        <td className="p-3.5 text-xs">
                          <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-md inline-block font-mono font-bold">{resolveLlamado(row.llamado_id)}</span>
                        </td>
                        <td className="p-1">
                          <select
                            value={row.crew_id || ""}
                            onChange={(e) => handleInlineUpdate(row.id, "crew_id", e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-semibold text-neutral-800 p-2 rounded cursor-pointer animate-fade-in"
                          >
                            <option value="">-- Seleccionar Crew --</option>
                            {[...lookups.crew]
                              .sort((a, b) => a.id - b.id)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.nombre} [{c.cargo || "S/C"}] (ID: {c.id})
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-neutral-700 uppercase bg-neutral-100 px-2 py-1 rounded-sm tracking-wide text-xs">
                            {lookups.crew.find((c) => c.id === row.crew_id)?.departamento || "Cámara"}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs font-semibold text-neutral-700">
                          {row.prioridad !== null && row.prioridad !== undefined ? row.prioridad : "—"}
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: CLIENTE_AGENCIA ───── */}
                    {table === "cliente_agencia" && (
                      <>
                        <td className="p-3.5 text-xs">
                          <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-md inline-block font-mono font-bold">{resolveLlamado(row.llamado_id)}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider mr-2">{row.tipo}</span>
                          <span className="font-bold text-neutral-900">{row.nombre}</span>
                        </td>
                        <td className="p-3.5 text-xs font-semibold text-neutral-600">{row.empresa || "Sin empresa"}</td>
                        <td className="p-3.5 text-xs font-mono font-bold text-orange-650 bg-neutral-50 px-2 py-1 rounded inline-block">
                          {row.horario_loc || "Sin definir"}
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: TALENTO (REPARTO) ───── */}
                    {table === "talento" && (
                      <>
                        <td className="p-3.5 font-mono font-bold text-sm text-neutral-800">{row.orden}º</td>
                        <td className="p-3.5">
                          <div className="font-bold text-neutral-900">{row.nombre}</div>
                          <div className="text-xs text-indigo-600 font-bold uppercase">{row.rol || "Actor Principal"}</div>
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold">
                              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider shrink-0">Llamado:</span>
                              <span className="font-mono font-bold text-neutral-800 bg-neutral-50 px-1.5 py-0.5 rounded">{row.llamado_hora || "Sin definir"}</span>
                            </div>
                            <div>🎬 En Set: <span className="font-bold text-violet-600">{row.en_set || "No especifica"}</span></div>
                            <div>📋 Status: <span className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded-sm font-mono font-extrabold text-[10px] ml-1">{row.w_status || "S/W"}</span></div>
                          </div>
                        </td>
                        <td className="p-3.5 text-xs text-neutral-500 max-w-xs">
                          <div className="italic">{row.notas || "Sin restricciones dietarias / notas"}</div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">Asociado a {resolveLlamado(row.llamado_id)}</div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: PDR (RODAJE) ───── */}
                    {table === "pdr" && (
                      <>
                        <td className="p-3.5 font-mono font-bold text-sm text-neutral-800">
                          <div className="flex items-center gap-1.5">
                            <GripVertical className="w-3.5 h-3.5 text-neutral-300 hover:text-neutral-500 shrink-0 cursor-grab active:cursor-grabbing" />
                            <span>{row.orden}º</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-xs">
                          <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-md inline-block font-mono font-bold">{resolveLlamado(row.llamado_id)}</span>
                        </td>
                        <td className="p-1 text-xs">
                          <div className="flex items-center gap-1">
                            <CornerDownRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-1.5" />
                            <select
                              value={row.shotlist_id || ""}
                              onChange={(e) => handleInlineUpdate(row.id, "shotlist_id", e.target.value ? Number(e.target.value) : null)}
                              className="bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-semibold text-neutral-800 p-2 rounded cursor-pointer max-w-md"
                            >
                              <option value="">-- Seleccionar Toma/Plano --</option>
                              {lookups.shotlist.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Esc: {s.esc || "—"} | Plano: {s.plano || "—"} ({s.descripcion ? (s.descripcion.length > 40 ? s.descripcion.substring(0, 40) + "..." : s.descripcion) : "Sin descripción"})
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-xs">
                          <div className="flex items-center gap-1">
                            <input
                              key={`${row.id}_${row.duracion_min || 0}`}
                              type="number"
                              defaultValue={row.duracion_min || 0}
                              autoFocus={row.id === newlyCreatedId}
                              onFocus={(e) => {
                                if (row.id === newlyCreatedId) {
                                  e.currentTarget.select();
                                }
                              }}
                              onBlur={(e) => {
                                if (row.id === newlyCreatedId) {
                                  setNewlyCreatedId(null);
                                }
                                const val = Number(e.target.value);
                                if (val !== row.duracion_min) {
                                  handleInlineUpdate(row.id, "duracion_min", val);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-16 px-1.5 py-0.5 text-center font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:ring-1 focus:ring-neutral-800 focus:outline-hidden"
                            />
                            <span className="text-neutral-500 font-semibold font-sans">min</span>
                          </div>
                        </td>
                      </>
                    )}

                     {/* ───── TABLA: SHOTLIST (STORIES) ───── */}
                    {table === "shotlist" && (
                      <>
                        {/* 1. Proyecto ID */}
                        {visibleColumns.proyecto_id && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <select
                              value={row.proyecto_id || ""}
                              onChange={(e) => handleInlineUpdate(row.id, "proyecto_id", e.target.value ? Number(e.target.value) : null)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-neutral-850 text-xs font-bold p-1 rounded text-neutral-850"
                            >
                              <option value="">-- Proy --</option>
                              {lookups.proyectos.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.campana || p.id}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        {/* 2. Escena */}
                        {visibleColumns.esc && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <input
                              type="text"
                              defaultValue={row.esc || ""}
                              autoFocus={row.id === newlyCreatedId}
                              onFocus={(e) => {
                                if (row.id === newlyCreatedId) {
                                  e.currentTarget.select();
                                }
                              }}
                              onBlur={(e) => {
                                if (row.id === newlyCreatedId) {
                                  setNewlyCreatedId(null);
                                }
                                if (e.target.value !== (row.esc || "")) {
                                  handleInlineUpdate(row.id, "esc", e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-extrabold text-neutral-850 p-1 text-center rounded text-neutral-850"
                              placeholder="—"
                            />
                          </td>
                        )}

                        {/* 3. Plano */}
                        {visibleColumns.plano && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <input
                              type="text"
                              defaultValue={row.plano || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (row.plano || "")) {
                                  handleInlineUpdate(row.id, "plano", e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-bold text-neutral-850 p-1 text-center rounded"
                              placeholder="—"
                            />
                          </td>
                        )}

                        {/* 4. Prep Nº */}
                        {visibleColumns.prep && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <input
                              type="text"
                              defaultValue={row.prep || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (row.prep || "")) {
                                  handleInlineUpdate(row.id, "prep", e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-bold text-pink-600 p-1 text-center rounded placeholder-pink-300"
                              placeholder="—"
                            />
                          </td>
                        )}

                        {/* 5. Descripción de la Toma */}
                        {visibleColumns.descripcion && (
                          <td className="p-1 border border-neutral-200 bg-white min-w-[14rem]">
                            <textarea
                              rows={2}
                              defaultValue={row.descripcion || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (row.descripcion || "")) {
                                  handleInlineUpdate(row.id, "descripcion", e.target.value);
                                }
                              }}
                              className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-semibold text-neutral-700 p-1 rounded resize-none leading-relaxed"
                              placeholder="Descripción..."
                            />
                          </td>
                        )}

                        {/* 6. Cast */}
                        {visibleColumns.cast_nombres && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <input
                              type="text"
                              defaultValue={row.cast_nombres || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (row.cast_nombres || "")) {
                                  handleInlineUpdate(row.id, "cast_nombres", e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-semibold text-neutral-600 p-1 text-center rounded"
                              placeholder="—"
                            />
                          </td>
                        )}

                        {/* 7. Locación */}
                        {visibleColumns.locacion_id && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <select
                              value={row.locacion_id || ""}
                              onChange={(e) => handleInlineUpdate(row.id, "locacion_id", e.target.value ? Number(e.target.value) : null)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-neutral-850 text-xs p-1 rounded text-neutral-855"
                            >
                              <option value="">-- Loc --</option>
                              {lookups.locaciones.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.locacion}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        {/* 8. Notas */}
                        {visibleColumns.notas && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            <input
                              type="text"
                              defaultValue={row.notas || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (row.notas || "")) {
                                  handleInlineUpdate(row.id, "notas", e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              className="w-full bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-semibold text-neutral-500 p-1 rounded"
                              placeholder="Notas..."
                            />
                          </td>
                        )}

                        {/* 9. Referencia con subida directa y vista storyboard stacked */}
                        {visibleColumns.referencia_urls && (
                          <td className="p-2 border border-neutral-200 bg-white w-48">
                            <div className="flex flex-col gap-2">
                              {(() => {
                                const urls = row.referencia_urls ? row.referencia_urls.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                                return (
                                  <>
                                    {urls.length > 0 ? (
                                      <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto p-0.5 border border-dashed border-neutral-100 rounded-lg">
                                        {urls.map((url: string, i: number) => (
                                          <div key={i} className="relative group aspect-video bg-neutral-50 border border-neutral-200 rounded-md overflow-hidden shadow-xs">
                                            <img
                                              src={url}
                                              alt={`Ref ${i + 1}`}
                                              referrerPolicy="no-referrer"
                                              className="w-full h-full object-cover"
                                            />
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const confirmed = window.confirm("¿Seguro que deseas eliminar esta imagen de referencia?");
                                                if (!confirmed) return;
                                                const newUrls = urls.filter((_, idx) => idx !== i).join(",");
                                                await handleInlineUpdate(row.id, "referencia_urls", newUrls === "" ? null : newUrls);
                                              }}
                                              className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded shadow-md cursor-pointer transition-transform duration-100 group-hover:scale-105 animate-fade-in"
                                              title="Eliminar de Referencias"
                                            >
                                              <Trash2 className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-2.5 bg-neutral-50/50 border border-dashed border-neutral-200 rounded-lg text-[10px] text-neutral-400 italic">
                                        Sin Referencias
                                      </div>
                                    )}

                                    <div className="relative">
                                      {isUploadingRowId === row.id ? (
                                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 font-bold bg-neutral-50 border border-neutral-200 py-1 rounded">
                                          <span className="w-2.5 h-2.5 border-2 border-t-transparent border-neutral-600 rounded-full animate-spin"></span>
                                          <span>Subiendo...</span>
                                        </div>
                                      ) : (
                                        <label className="flex items-center justify-center gap-1 px-2 py-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded text-[10px] font-bold text-neutral-700 cursor-pointer transition-colors w-full">
                                          <Camera className="w-3 h-3 text-orange-500 shrink-0" />
                                          <span>Subir Foto</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={async (e) => {
                                              const files = e.target.files;
                                              if (!files || files.length === 0) return;
                                              
                                              setIsUploadingRowId(row.id);
                                              try {
                                                const uploadedUrls: string[] = [];
                                                for (let idx = 0; idx < files.length; idx++) {
                                                  const file = files[idx];
                                                  const cleanName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
                                                  
                                                  const { error: uploadError } = await supabase.storage
                                                    .from("referencias")
                                                    .upload(cleanName, file, {
                                                      cacheControl: "3600",
                                                      upsert: false,
                                                    });

                                                  if (uploadError) throw uploadError;

                                                  const { data: urlData } = supabase.storage
                                                    .from("referencias")
                                                    .getPublicUrl(cleanName);

                                                  if (urlData?.publicUrl) {
                                                    uploadedUrls.push(urlData.publicUrl);
                                                  }
                                                }

                                                const activeUrls = [...urls, ...uploadedUrls].join(",");
                                                await handleInlineUpdate(row.id, "referencia_urls", activeUrls);
                                              } catch (err: any) {
                                                console.error(err);
                                                alert(`Error al subir imagen: ${err.message}`);
                                              } finally {
                                                setIsUploadingRowId(null);
                                              }
                                            }}
                                          />
                                        </label>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        )}
                      </>
                    )}

                    <td className="p-3.5 pr-6 text-center select-none">
                      <div className="inline-flex items-center gap-1.5 bg-neutral-100/50 p-1 rounded-xl">
                        {/* Ver Hoja de Llamado */}
                        {table === "llamados" && (
                          <a
                            href={`./llamado.html?id=${row.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                            title="Ver Hoja de Llamado"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => onEditClick(row)}
                          className="p-2 text-neutral-600 hover:bg-white hover:text-neutral-900 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {/* Delete Button with double tap verification state */}
                        <button
                          onClick={() => handleDeleteTrigger(row.id)}
                          className={`p-2 rounded-lg transition-all cursor-pointer ${
                            confirmDeleteId === row.id
                              ? "bg-red-500 text-white animate-shake"
                              : "text-neutral-400 hover:bg-white hover:text-red-600"
                          }`}
                          title={confirmDeleteId === row.id ? "¡Pulsa de nuevo para borrar!" : "Eliminar"}
                        >
                          {confirmDeleteId === row.id ? (
                            <AlertTriangle className="w-4 h-4 animate-bounce" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {table === "shotlist" && (
                  <tr className="bg-neutral-50/20 hover:bg-neutral-50/40 border-t border-neutral-200 animate-fade-in">
                    {/* 1. Proyecto column showing a clean green Plus button in the first position as per reference */}
                    {visibleColumns.proyecto_id && (
                      <td className="p-2.5 border border-neutral-200 bg-white text-center">
                        <button
                          type="button"
                          onClick={handleQuickAddShotlist}
                          className="flex items-center justify-center w-8 h-8 bg-[#059669] hover:bg-[#10b981] text-white rounded-lg shadow-sm cursor-pointer transition-transform duration-100 hover:scale-110 active:scale-95"
                          title="Añadir nueva fila"
                        >
                          <Plus className="w-4 h-4 text-white stroke-[3px]" />
                        </button>
                      </td>
                    )}

                    {/* All other columns with plain empty white cells */}
                    {visibleColumns.esc && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.plano && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.prep && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.descripcion && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.cast_nombres && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.locacion_id && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.notas && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.referencia_urls && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    
                    {/* Actions column empty placeholder */}
                    <td className="p-3.5 pr-6 text-center select-none bg-neutral-50/10 border border-neutral-200" />
                  </tr>
                )}
                {table === "pdr" && (
                  <tr className="bg-neutral-50/20 hover:bg-neutral-50/40 border-t border-neutral-200 animate-fade-in">
                    {/* 1. Orden column showing a clean green Plus button in the first position as per reference */}
                    <td className="p-2.5 border border-neutral-200 bg-white text-center">
                      <button
                        type="button"
                        onClick={handleQuickAddPdr}
                        className="flex items-center justify-center w-8 h-8 bg-[#059669] hover:bg-[#10b981] text-white rounded-lg shadow-sm cursor-pointer transition-transform duration-100 hover:scale-110 active:scale-95 mx-auto"
                        title="Añadir nueva fila"
                      >
                        <Plus className="w-4 h-4 text-white stroke-[3px]" />
                      </button>
                    </td>

                    {/* All other columns with plain empty white cells */}
                    <td className="p-1 border border-neutral-200 bg-white" />
                    <td className="p-1 border border-neutral-200 bg-white" />
                    <td className="p-1 border border-neutral-200 bg-white" />
                    
                    {/* Actions column empty placeholder */}
                    <td className="p-3.5 pr-6 text-center select-none bg-neutral-50/10 border border-neutral-200" />
                  </tr>
                )}
                {table === "crew_llamado" && (
                  <tr className="bg-neutral-50/20 hover:bg-neutral-50/40 border-t border-neutral-200 animate-fade-in">
                    {/* 1. Orden column showing a clean green Plus button in the first position as per reference */}
                    <td className="p-2.5 border border-neutral-200 bg-white text-center">
                      <button
                        type="button"
                        onClick={handleQuickAddCrewLlamado}
                        className="flex items-center justify-center w-8 h-8 bg-[#059669] hover:bg-[#10b981] text-white rounded-lg shadow-sm cursor-pointer transition-transform duration-100 hover:scale-110 active:scale-95 mx-auto"
                        title="Añadir nueva fila"
                      >
                        <Plus className="w-4 h-4 text-white stroke-[3px]" />
                      </button>
                    </td>

                    {/* All other columns with plain empty white cells */}
                    <td className="p-1 border border-neutral-200 bg-white" />
                    <td className="p-1 border border-neutral-200 bg-white" />
                    <td className="p-1 border border-neutral-200 bg-white" />
                    <td className="p-1 border border-neutral-200 bg-white" />
                    
                    {/* Actions column empty placeholder */}
                    <td className="p-3.5 pr-6 text-center select-none bg-neutral-50/10 border border-neutral-200" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic Action & Maintenance Modal for Bulk DB Reset Operations */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            {confirmModal.type === "deleteAll" && (
              <div className="space-y-4 animate-scale-up">
                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight">¿Borrar todos los registros?</h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Se borrarán todos los campos de la tabla <span className="font-bold text-neutral-800">'{table}'</span>. Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-750 font-medium">
                  ⚠️ Advertencia: Todos los datos vinculados a esta tabla se perderán permanentemente.
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleDeleteAll}
                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isProcessing ? "Borrando..." : "Sí, borrar todo"}
                  </button>
                </div>
              </div>
            )}

            {confirmModal.type === "resetIds" && (
              <div className="space-y-4 animate-scale-up">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                  <RefreshCcw className="w-6 h-6 animate-spin" style={{ animationDuration: "3s" }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight">¿Proceder Reset de ID?</h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Se intentará reiniciar la secuencia auto-numérica de la tabla <span className="font-bold text-neutral-800">'{table}'</span> para que los nuevos registros comiencen desde el ID 1.
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-xs text-amber-700 font-medium">
                  💡 Consejo: Es ideal hacerlo inmediatamente después de borrar todos los datos para evitar conflictos de clave primaria duplicada.
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleResetIds}
                    className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? "Procesando..." : "Reiniciar ID a 1"}
                  </button>
                </div>
              </div>
            )}

            {confirmModal.type === "sqlExplanation" && modalFeedback && (
              <div className="space-y-4 animate-scale-up">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  modalFeedback.success ? "bg-teal-50 text-teal-600" : "bg-neutral-100 text-indigo-600"
                }`}>
                  {modalFeedback.success ? (
                    <RefreshCcw className="w-6 h-6" />
                  ) : (
                    <HelpCircle className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight">
                    {modalFeedback.title}
                  </h3>
                  <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                    {modalFeedback.message}
                  </p>
                </div>

                {modalFeedback.sqlStatement && (
                  <div className="space-y-2 pt-1">
                    <div className="bg-neutral-900 text-teal-400 font-mono text-xs p-4 rounded-xl border border-neutral-800 overflow-x-auto relative group">
                      <div className="text-[9px] text-neutral-500 uppercase tracking-widest mb-1 select-none">Comando de SQL:</div>
                      <code>{modalFeedback.sqlStatement}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(modalFeedback.sqlStatement || "");
                        }}
                        className="absolute right-2 top-2 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 text-[10px] px-2.5 py-1 rounded-md border border-neutral-700 transition-all font-sans cursor-pointer no-print font-bold"
                        title="Copiar comando SQL"
                      >
                        Copiar
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-normal">
                      Pega esta instrucción en la consola <span className="font-semibold text-neutral-800">"SQL Editor"</span> de Supabase para forzar manualmente el reinicio de la secuencia del contador autoincrementable.
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal(null);
                      setModalFeedback(null);
                    }}
                    className="w-full px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-bold transition-all shadow-md focus:outline-hidden cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
