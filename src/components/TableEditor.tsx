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
  Layers,
  Users,
  Copy,
  ChevronUp,
  ChevronDown,
  X
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
    talento: any[];
    ciudades: any[];
  };
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
  selectedLlamadoId: number | null;
  setSelectedLlamadoId: (id: number | null) => void;
}

export default function TableEditor({
  table,
  data,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onRefresh,
  lookups,
  selectedProjectId,
  setSelectedProjectId,
  selectedLlamadoId,
  setSelectedLlamadoId,
}: TableEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [crewSortMode, setCrewSortMode] = useState<"id" | "dept">("id");

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    proyecto_id: true,
    esc: true,
    plano: true,
    descripcion: true,
    cast_ids: true,
    locacion_id: true,
    notas: true,
    referencia_urls: true,
  });
  const [isUploadingRowId, setIsUploadingRowId] = useState<number | null>(null);
  const [newlyCreatedId, setNewlyCreatedId] = useState<number | null>(null);

  const handleQuickAddShotlist = async () => {
    setIsProcessing(true);
    try {
      const defaultProjId = selectedProjectId || (lookups.proyectos && lookups.proyectos.length > 0
        ? lookups.proyectos[0].id
        : null);

      if (!defaultProjId) {
        alert("Primero crea o selecciona un Proyecto para registrar renglones en el Shotlist.");
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
        descripcion: "",
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
      const defaultLlamadoId = selectedLlamadoId || (lookups.llamados && lookups.llamados.length > 0
        ? lookups.llamados[0].id
        : null);

      if (!defaultLlamadoId) {
        alert("Primero selecciona un Llamado para registrar renglones en el PDR.");
        return;
      }

      if (!quickAddPdrShotlistId) {
        alert("Por favor, selecciona una Toma del Shotlist en el menú desplegable para añadirla al PDR.");
        return;
      }

      const maxOrden = data && data.length > 0 
        ? Math.max(...data.map(d => Number(d.orden || 0))) 
        : 0;

      const newRow = {
        llamado_id: defaultLlamadoId,
        shotlist_id: Number(quickAddPdrShotlistId),
        orden: maxOrden + 1,
        duracion_min: 0
      };

      const { data: insertedData, error } = await supabase.from("pdr").insert([newRow]).select();
      if (error) throw error;

      if (insertedData && insertedData.length > 0) {
        setNewlyCreatedId(insertedData[0].id);
      }

      setQuickAddPdrShotlistId("");

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
      const defaultLlamadoId = selectedLlamadoId || (lookups.llamados && lookups.llamados.length > 0
        ? lookups.llamados[0].id
        : null);

      if (!defaultLlamadoId) {
        alert("Primero selecciona un Llamado para asignar Crew.");
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
  const [quickAddPdrShotlistId, setQuickAddPdrShotlistId] = useState<number | "">("");
  const [modalFeedback, setModalFeedback] = useState<{
    success: boolean;
    title: string;
    message: string;
    sqlStatement?: string;
  } | null>(null);
  const [isCrewBulkOpen, setIsCrewBulkOpen] = useState(false);
  const [selectedCrewIds, setSelectedCrewIds] = useState<Set<number>>(new Set());
  const [isCrewBulkSaving, setIsCrewBulkSaving] = useState(false);
  const [crewBulkSearch, setCrewBulkSearch] = useState("");
  const [isHoraBulkOpen, setIsHoraBulkOpen] = useState(false);
  const [bulkHora, setBulkHora] = useState("");
  const [isHoraBulkSaving, setIsHoraBulkSaving] = useState(false);
  const [isCopyCrewOpen, setIsCopyCrewOpen] = useState(false);
  const [copyCrewSourceId, setCopyCrewSourceId] = useState<number | "">("");
  const [copyCrewMode, setCopyCrewMode] = useState<"merge" | "replace">("merge");
  const [copyCrewSearch, setCopyCrewSearch] = useState("");
  const [isCopyCrewSaving, setIsCopyCrewSaving] = useState(false);
  const [isPdrBulkOpen, setIsPdrBulkOpen] = useState(false);
  const [selectedPdrShotlistIds, setSelectedPdrShotlistIds] = useState<Set<number>>(new Set());
  const [isPdrBulkSaving, setIsPdrBulkSaving] = useState(false);
  const [pdrBulkSearch, setPdrBulkSearch] = useState("");
  const [projectPdrShotlistIds, setProjectPdrShotlistIds] = useState<Set<number>>(new Set());
  const [isTalentoBulkOpen, setIsTalentoBulkOpen] = useState(false);
  const [selectedTalentoKeys, setSelectedTalentoKeys] = useState<Set<string>>(new Set());
  const [isTalentoBulkSaving, setIsTalentoBulkSaving] = useState(false);
  const [talentoBulkSearch, setTalentoBulkSearch] = useState("");
  const [isClienteBulkOpen, setIsClienteBulkOpen] = useState(false);
  const [selectedClienteKeys, setSelectedClienteKeys] = useState<Set<string>>(new Set());
  const [isClienteBulkSaving, setIsClienteBulkSaving] = useState(false);
  const [clienteBulkSearch, setClienteBulkSearch] = useState("");

  // When the PDR bulk modal opens, load which shotlists are already used across ALL llamados of the project
  React.useEffect(() => {
    if (!isPdrBulkOpen) return;
    if (table !== "pdr" || !selectedLlamadoId) return;

    const matchingLlamado = lookups.llamados.find((l) => Number(l.id) === Number(selectedLlamadoId));
    const proyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
    if (!proyectoId) return;

    const projectLlamadoIds = lookups.llamados
      .filter((l) => Number(l.proyecto_id) === proyectoId)
      .map((l) => Number(l.id));

    let cancelled = false;
    (async () => {
      try {
        const { data: pdrRows, error } = await supabase
          .from("pdr")
          .select("shotlist_id")
          .in("llamado_id", projectLlamadoIds);
        if (error) throw error;
        if (!cancelled) {
          setProjectPdrShotlistIds(new Set((pdrRows || []).map((r: any) => Number(r.shotlist_id))));
        }
      } catch (err) {
        console.error("Error fetching project PDR assignments:", err);
        if (!cancelled) setProjectPdrShotlistIds(new Set());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPdrBulkOpen, table, selectedLlamadoId, lookups.llamados]);

  // Crew not yet assigned to the active llamado (for bulk assignment)
  const unassignedCrew = React.useMemo(() => {
    if (table !== "crew_llamado" || !selectedLlamadoId) return [];
    const assignedIds = new Set(
      data.filter((r) => Number(r.llamado_id) === Number(selectedLlamadoId)).map((r) => Number(r.crew_id))
    );
    return lookups.crew.filter((c) => !assignedIds.has(Number(c.id)));
  }, [table, selectedLlamadoId, data, lookups.crew]);

  // Llamados del mismo proyecto que el llamado activo (excluyendo el activo)
  // con la cantidad de crew asignado, para el modal de "Copiar Crew"
  const copyCrewCandidates = React.useMemo(() => {
    if (table !== "crew_llamado" || !selectedLlamadoId) return [];
    const matchingLlamado = lookups.llamados.find((l) => Number(l.id) === Number(selectedLlamadoId));
    const proyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
    if (!proyectoId) return [];

    // Contar filas de crew_llamado por llamado (data contiene todas las filas sin filtrar)
    const crewCountByLlamado = new Map<number, number>();
    (data || []).forEach((r) => {
      const lid = Number(r.llamado_id);
      crewCountByLlamado.set(lid, (crewCountByLlamado.get(lid) || 0) + 1);
    });

    const list = lookups.llamados.filter((l) => {
      if (Number(l.id) === Number(selectedLlamadoId)) return false;
      return Number(l.proyecto_id) === proyectoId;
    });

    // Aplicar búsqueda
    const filtered = copyCrewSearch.trim()
      ? list.filter((l) => resolveLlamado(Number(l.id)).toLowerCase().includes(copyCrewSearch.toLowerCase()))
      : list;

    return [...filtered]
      .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""), undefined, { numeric: true }))
      .map((l) => ({ ...l, crewCount: crewCountByLlamado.get(Number(l.id)) || 0 }));
  }, [table, selectedLlamadoId, lookups.llamados, data, copyCrewSearch]);

  // Filtered list inside the bulk modal by search query
  const filteredUnassignedCrew = React.useMemo(() => {
    const list = crewBulkSearch.trim()
      ? unassignedCrew.filter((c) =>
          `${c.nombre} ${c.cargo || ""} ${c.departamento || ""}`.toLowerCase().includes(crewBulkSearch.toLowerCase())
        )
      : unassignedCrew;

    // Group by departamento (alphabetical) and keep alphabetical order by nombre within each group
    return [...list].sort((a, b) => {
      const deptA = String(a.departamento || "").toLowerCase();
      const deptB = String(b.departamento || "").toLowerCase();
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return String(a.nombre || "").localeCompare(String(b.nombre || ""), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [unassignedCrew, crewBulkSearch]);

  // Shotlists available for the PDR bulk modal:
  // - Belong to the active llamado's project
  // - EXCLUDED if already used in ANY llamado of the project (projectPdrShotlistIds),
  //   EXCEPT planos "ES" which are reusable multiple times
  const availablePdrShotlists = React.useMemo(() => {
    if (table !== "pdr" || !selectedLlamadoId) return [];
    const matchingLlamado = lookups.llamados.find((l) => Number(l.id) === Number(selectedLlamadoId));
    const proyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
    if (!proyectoId) return [];

    const list = lookups.shotlist.filter((s) => {
      if (Number(s.proyecto_id) !== proyectoId) return false;
      const plano = String(s.plano || "").toUpperCase();
      if (plano === "ES") return true; // ES reusable
      return !projectPdrShotlistIds.has(Number(s.id));
    });

    // Apply search filter
    const filtered = pdrBulkSearch.trim()
      ? list.filter((s) =>
          `${s.esc || ""} ${s.plano || ""} ${s.descripcion || ""}`.toLowerCase().includes(pdrBulkSearch.toLowerCase())
        )
      : list;

    // Sort by esc (numeric) then plano (numeric)
    return [...filtered].sort((a, b) => {
      const escComp = String(a.esc || "").localeCompare(String(b.esc || ""), undefined, { numeric: true, sensitivity: "base" });
      if (escComp !== 0) return escComp;
      return String(a.plano || "").localeCompare(String(b.plano || ""), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [table, selectedLlamadoId, lookups.llamados, lookups.shotlist, projectPdrShotlistIds, pdrBulkSearch]);

  const handleBulkAssignPdr = async () => {
    if (!selectedLlamadoId) return;
    if (selectedPdrShotlistIds.size === 0) {
      alert("Selecciona al menos una toma del Shotlist.");
      return;
    }
    setIsPdrBulkSaving(true);
    try {
      const maxOrden = data && data.length > 0
        ? Math.max(...data.map((d) => Number(d.orden || 0)))
        : 0;

      const rows = Array.from(selectedPdrShotlistIds).map((shotlistId, i) => ({
        llamado_id: selectedLlamadoId,
        shotlist_id: shotlistId,
        orden: maxOrden + 1 + i,
        duracion_min: 0,
      }));

      const { error } = await supabase.from("pdr").insert(rows);
      if (error) throw error;

      setSelectedPdrShotlistIds(new Set());
      setPdrBulkSearch("");
      setIsPdrBulkOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al asignar tomas al PDR: ${err.message}`);
    } finally {
      setIsPdrBulkSaving(false);
    }
  };

  // Unique talent "base" profiles available for the active llamado:
  // - Belong to the active llamado's project
  // - Dedup by normalized nombre (a talent may have one row per llamado)
  // - Excluded if a row with that nombre already exists in the ACTIVE llamado
  const availableTalentoBase = React.useMemo(() => {
    if (table !== "talento" || !selectedLlamadoId) return [];
    const matchingLlamado = lookups.llamados.find((l) => Number(l.id) === Number(selectedLlamadoId));
    const proyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
    if (!proyectoId) return [];

    // names already present in the ACTIVE llamado (data contains all talento rows;
    // filter by selectedLlamadoId to only count rows of the active llamado)
    const activeLlamadoNames = new Set(
      data
        .filter((r) => Number(r.llamado_id) === Number(selectedLlamadoId))
        .map((r) => String(r.nombre || "").trim().toLowerCase())
        .filter(Boolean)
    );

    // project llamados ids
    const projectLlamadoIds = new Set(
      lookups.llamados.filter((l) => Number(l.proyecto_id) === proyectoId).map((l) => Number(l.id))
    );

    // Collect unique profiles from talents that belong to the project's llamados
    const seen = new Map<string, any>(); // key -> profile
    lookups.talento.forEach((t) => {
      if (!projectLlamadoIds.has(Number(t.llamado_id))) return;
      const name = String(t.nombre || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (activeLlamadoNames.has(key)) return; // already assigned to active llamado
      if (!seen.has(key)) seen.set(key, t);
    });

    let list = Array.from(seen.values());

    // Apply search filter
    if (talentoBulkSearch.trim()) {
      const q = talentoBulkSearch.toLowerCase();
      list = list.filter((t) => `${t.nombre || ""} ${t.rol || ""}`.toLowerCase().includes(q));
    }

    // Sort alphabetically by nombre
    return [...list].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), undefined, { sensitivity: "base" }));
  }, [table, selectedLlamadoId, lookups.llamados, lookups.talento, data, talentoBulkSearch]);

  const handleBulkAssignTalento = async () => {
    if (!selectedLlamadoId) return;
    if (selectedTalentoKeys.size === 0) {
      alert("Selecciona al menos un talento.");
      return;
    }
    setIsTalentoBulkSaving(true);
    try {
      const activeLlamadoRows = data.filter((r) => Number(r.llamado_id) === Number(selectedLlamadoId));
      const maxIdPersonaje = activeLlamadoRows.length > 0
        ? Math.max(...activeLlamadoRows.map((d) => Number(d.id_personaje || 0)))
        : 0;

      // Map selected keys back to their profile rows
      const keyToProfile = new Map<string, any>();
      availableTalentoBase.forEach((t) => {
        keyToProfile.set(String(t.nombre || "").trim().toLowerCase(), t);
      });

      const rows = Array.from(selectedTalentoKeys).map((key: string, i) => {
        const profile = keyToProfile.get(key) || {};
        return {
          llamado_id: selectedLlamadoId,
          nombre: profile.nombre || "",
          rol: profile.rol || null,
          id_personaje: maxIdPersonaje + 1 + i,
          llamado_hora: profile.llamado_hora || null,
          locacion_id: profile.locacion_id || null,
          en_set: profile.en_set || null,
          notas: profile.notas || null,
          w_status: profile.w_status || null,
        };
      });

      const { error } = await supabase.from("talento").insert(rows);
      if (error) throw error;

      setSelectedTalentoKeys(new Set());
      setTalentoBulkSearch("");
      setIsTalentoBulkOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al asignar talentos: ${err.message}`);
    } finally {
      setIsTalentoBulkSaving(false);
    }
  };

  // Unique "Cliente/Agencia" base profiles available for the active llamado:
  // - Belong to the active llamado's project
  // - Dedup by normalized nombre
  // - Excluded if a row with that nombre already exists in the ACTIVE llamado
  const availableClienteBase = React.useMemo(() => {
    if (table !== "cliente_agencia" || !selectedLlamadoId) return [];
    const matchingLlamado = lookups.llamados.find((l) => Number(l.id) === Number(selectedLlamadoId));
    const proyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
    if (!proyectoId) return [];

    // names already present in the ACTIVE llamado (data contains all rows; filter by selectedLlamadoId)
    const activeLlamadoNames = new Set(
      data
        .filter((r) => Number(r.llamado_id) === Number(selectedLlamadoId))
        .map((r) => String(r.nombre || "").trim().toLowerCase())
        .filter(Boolean)
    );

    // project llamados ids
    const projectLlamadoIds = new Set(
      lookups.llamados.filter((l) => Number(l.proyecto_id) === proyectoId).map((l) => Number(l.id))
    );

    // Collect unique profiles from cliente_agencia rows that belong to the project's llamados
    const seen = new Map<string, any>();
    data.forEach((r) => {
      if (!projectLlamadoIds.has(Number(r.llamado_id))) return;
      const name = String(r.nombre || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (activeLlamadoNames.has(key)) return;
      if (!seen.has(key)) seen.set(key, r);
    });

    let list = Array.from(seen.values());

    // Apply search filter
    if (clienteBulkSearch.trim()) {
      const q = clienteBulkSearch.toLowerCase();
      list = list.filter((r) => `${r.nombre || ""} ${r.empresa || ""} ${r.tipo || ""}`.toLowerCase().includes(q));
    }

    // Sort alphabetically by nombre
    return [...list].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), undefined, { sensitivity: "base" }));
  }, [table, selectedLlamadoId, lookups.llamados, data, clienteBulkSearch]);

  const handleBulkAssignCliente = async () => {
    if (!selectedLlamadoId) return;
    if (selectedClienteKeys.size === 0) {
      alert("Selecciona al menos un cliente / agencia.");
      return;
    }
    setIsClienteBulkSaving(true);
    try {
      // Map selected keys back to their profile rows
      const keyToProfile = new Map<string, any>();
      availableClienteBase.forEach((r) => {
        keyToProfile.set(String(r.nombre || "").trim().toLowerCase(), r);
      });

      const rows = Array.from(selectedClienteKeys).map((key: string) => {
        const profile = keyToProfile.get(key) || {};
        return {
          llamado_id: selectedLlamadoId,
          tipo: profile.tipo || "Cliente",
          nombre: profile.nombre || "",
          empresa: profile.empresa || null,
          horario_loc: profile.horario_loc || null,
        };
      });

      const { error } = await supabase.from("cliente_agencia").insert(rows);
      if (error) throw error;

      setSelectedClienteKeys(new Set());
      setClienteBulkSearch("");
      setIsClienteBulkOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al asignar clientes: ${err.message}`);
    } finally {
      setIsClienteBulkSaving(false);
    }
  };

  const handleBulkAssignCrew = async () => {
    if (!selectedLlamadoId) return;
    if (selectedCrewIds.size === 0) {
      alert("Selecciona al menos un miembro del Crew.");
      return;
    }
    setIsCrewBulkSaving(true);
    try {
      const maxOrden = data && data.length > 0
        ? Math.max(...data.map((d) => Number(d.orden || 0)))
        : 0;

      const rows = Array.from(selectedCrewIds).map((crewId, i) => ({
        llamado_id: selectedLlamadoId,
        crew_id: crewId,
        orden: maxOrden + 1 + i,
        prioridad: null,
      }));

      const { error } = await supabase.from("crew_llamado").insert(rows);
      if (error) throw error;

      setSelectedCrewIds(new Set());
      setIsCrewBulkOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al asignar Crew: ${err.message}`);
    } finally {
      setIsCrewBulkSaving(false);
    }
  };

  const handleBulkSetHora = async () => {
    if (!selectedLlamadoId) return;
    const hora = bulkHora.trim();
    if (!hora) {
      alert("Ingresa una hora válida (ej: 07:00).");
      return;
    }
    setIsHoraBulkSaving(true);
    try {
      const { error } = await supabase
        .from("crew_llamado")
        .update({ hora_llamado: hora })
        .eq("llamado_id", selectedLlamadoId);
      if (error) throw error;

      setBulkHora("");
      setIsHoraBulkOpen(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al actualizar Hora Llamado: ${err.message}`);
    } finally {
      setIsHoraBulkSaving(false);
    }
  };

  // Mover una fila de crew_llamado hacia arriba o abajo (reorden dinámico)
  const handleMoveCrew = async (rowId: number, direction: "up" | "down") => {
    if (!selectedLlamadoId) return;

    // Filas del llamado activo ya ordenadas según el orden visual actual
    const activeRows = sortedAndFilteredData.filter(
      (r) => Number(r.llamado_id) === Number(selectedLlamadoId)
    );

    const index = activeRows.findIndex((r) => Number(r.id) === Number(rowId));
    if (index === -1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= activeRows.length) return;

    // Intercambiar en la copia local
    const reordered = [...activeRows];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapIndex, 0, moved);

    // Recalcular orden 1..N para TODAS las filas del llamado (secuencia limpia)
    try {
      const updates = reordered.map((row, i) =>
        supabase
          .from("crew_llamado")
          .update({ orden: i + 1 })
          .eq("id", row.id)
      );
      await Promise.all(updates);

      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error("Error reordenando crew:", err);
      alert(`Error al reordenar el crew: ${err.message}`);
    }
  };

  // Copiar la asignación de crew desde otro llamado hacia el llamado activo
  const handleCopyCrew = async () => {
    if (!selectedLlamadoId) return;
    if (!copyCrewSourceId) {
      alert("Selecciona un llamado de origen para copiar el crew.");
      return;
    }
    const sourceId = Number(copyCrewSourceId);
    if (sourceId === Number(selectedLlamadoId)) {
      alert("El llamado de origen no puede ser el mismo que el destino.");
      return;
    }
    setIsCopyCrewSaving(true);
    try {
      // 1. Traer las filas de crew del llamado origen
      const { data: sourceRows, error: srcError } = await supabase
        .from("crew_llamado")
        .select("*")
        .eq("llamado_id", sourceId);
      if (srcError) throw srcError;

      if (!sourceRows || sourceRows.length === 0) {
        alert("El llamado de origen no tiene crew asignado para copiar.");
        return;
      }

      const destId = Number(selectedLlamadoId);
      // 2. Ordenar el origen por su "orden" (los null al final) para respetar el orden relativo
      const sortedSource = [...sourceRows].sort((a, b) => {
        const oa = a.orden === null || a.orden === undefined ? Infinity : Number(a.orden);
        const ob = b.orden === null || b.orden === undefined ? Infinity : Number(b.orden);
        if (oa !== ob) return oa - ob;
        return Number(a.id) - Number(b.id);
      });

      // 3. Filas actuales del destino
      const destRows = (data || []).filter((r) => Number(r.llamado_id) === destId);
      const destByCrewId = new Map(destRows.map((r) => [Number(r.crew_id), r]));
      const sourceCrewIds = new Set(sortedSource.map((r) => Number(r.crew_id)));

      // En modo "replace", borrar el crew actual del destino
      if (copyCrewMode === "replace") {
        const { error: delError } = await supabase
          .from("crew_llamado")
          .delete()
          .eq("llamado_id", destId);
        if (delError) throw delError;
      }

      // 4. Valores "ocupados" = los de las filas del destino que NO serán tocadas
      //    (en replace ya no queda ninguna porque se borró todo)
      const usedOrden = new Set<number>();
      const usedPrioridad = new Set<number>();
      destRows.forEach((r) => {
        if (copyCrewMode === "replace") return;
        if (sourceCrewIds.has(Number(r.crew_id))) return; // será actualizada
        if (r.orden !== null && r.orden !== undefined) usedOrden.add(Number(r.orden));
        if (r.prioridad !== null && r.prioridad !== undefined) usedPrioridad.add(Number(r.prioridad));
      });

      // Devuelve el valor deseado si está libre; si no, el siguiente valor libre (renormalizar solo conflictos)
      const nextFree = (used: Set<number>, desired: number | null): number | null => {
        if (desired === null) return null;
        let val = desired;
        while (used.has(val)) val += 1;
        return val;
      };

      // 5. Construir operaciones: actualizar filas existentes o insertar filas nuevas
      const updates: { id: number; payload: any }[] = [];
      const inserts: any[] = [];

      sortedSource.forEach((row: any) => {
        const crewId = Number(row.crew_id);
        const destRow = destByCrewId.get(crewId);

        const desiredOrden = row.orden === null || row.orden === undefined ? null : Number(row.orden);
        const desiredPrioridad = row.prioridad === null || row.prioridad === undefined ? null : Number(row.prioridad);

        const finalOrden = nextFree(usedOrden, desiredOrden);
        const finalPrioridad = nextFree(usedPrioridad, desiredPrioridad);
        if (finalOrden !== null) usedOrden.add(finalOrden);
        if (finalPrioridad !== null) usedPrioridad.add(finalPrioridad);

        const payload = {
          orden: finalOrden,
          prioridad: finalPrioridad,
          notas: row.notas ?? null,
          hora_llamado: row.hora_llamado ?? null,
        };

        if (destRow) {
          updates.push({ id: destRow.id, payload });
        } else {
          inserts.push({ ...payload, llamado_id: destId, crew_id: crewId });
        }
      });

      // 6. Ejecutar en batch (copiando los valores exactos de orden/prioridad del origen)
      if (updates.length > 0) {
        await Promise.all(
          updates.map((u) =>
            supabase.from("crew_llamado").update(u.payload).eq("id", u.id)
          )
        );
      }
      if (inserts.length > 0) {
        const { error: insError } = await supabase.from("crew_llamado").insert(inserts);
        if (insError) throw insError;
      }

      setCopyCrewSourceId("");
      setIsCopyCrewOpen(false);
      if (onRefresh) onRefresh();

      if (copyCrewMode === "replace") {
        alert(`Se reemplazó el crew de ${resolveLlamado(destId)} con ${sortedSource.length} miembro(s) del origen.`);
      } else {
        const parts: string[] = [];
        if (updates.length > 0) parts.push(`${updates.length} actualizado(s)`);
        if (inserts.length > 0) parts.push(`${inserts.length} agregado(s)`);
        alert(`Crew copiado hacia ${resolveLlamado(destId)}: ${parts.join(", ") || "sin cambios"}.`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al copiar el crew: ${err.message}`);
    } finally {
      setIsCopyCrewSaving(false);
    }
  };

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

  const getFileStoragePathFromUrl = (url: string) => {
    if (!url) return null;
    try {
      const marker = "/storage/v1/object/public/referencias/";
      const index = url.indexOf(marker);
      if (index !== -1) {
        return decodeURIComponent(url.slice(index + marker.length));
      }
      const parts = url.split("/");
      return decodeURIComponent(parts[parts.length - 1]);
    } catch (err) {
      console.error("Error parsing URL path:", err);
      return null;
    }
  };

  const deleteFileFromBucket = async (url: string) => {
    if (!url) return;
    const filename = getFileStoragePathFromUrl(url);
    if (!filename) return;

    try {
      const { error } = await supabase.storage
        .from("referencias")
        .remove([filename]);
      if (error) {
        console.warn("Could not delete from storage bucket:", error.message);
      } else {
        console.log("Deleted successfully from storage bucket:", filename);
      }
    } catch (err) {
      console.warn("Error deleting file from bucket:", err);
    }
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

  // Resolve comma-separated talent IDs (cast_ids) into talent names
  const resolveCastIds = (castIds?: string | null) => {
    if (!castIds) return [] as any[];
    return castIds
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n: number) => !isNaN(n))
      .map((id: number) => lookups.talento.find((t) => Number(t.id_personaje) === id))
      .filter(Boolean);
  };

  // 1. Filter dynamically by Active Project / Active Called working context
  const relationallyFilteredData = data.filter((row) => {
    // If called is active, filter llamados by project if selected
    if (table === "llamados" && selectedProjectId !== null) {
      return row.proyecto_id === selectedProjectId;
    }
    // If shotlist is active, filter by project if selected
    if (table === "shotlist" && selectedProjectId !== null) {
      return row.proyecto_id === selectedProjectId;
    }
    // If llamado child collections are active, filter by the selected llamado ID
    if (["escenas", "crew_llamado", "cliente_agencia", "talento", "pdr"].includes(table)) {
      if (selectedLlamadoId !== null) {
        return row.llamado_id === selectedLlamadoId;
      }
    }
    // No match or other tables (e.g. proyectos, crew, locaciones) have no filters
    return true;
  });

  // 2. Perform a case-insensitive search across ALL keys of a row to filter local records easily
  const filteredData = relationallyFilteredData.filter((row) => {
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
      if (key === "cast_ids" && typeof val === "string") {
        return resolveCastIds(val).some((t: any) => t.nombre.toLowerCase().includes(query));
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
    <div className="flex-1 p-6 space-y-6 overflow-hidden flex flex-col bg-neutral-50/50 animate-fade-in">
      
      {/* Active working context panel */}
      <div className="bg-neutral-900 border border-neutral-800 text-white rounded-2xl p-4 shrink-0 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-6">
          {/* Working Project Context */}
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${selectedProjectId ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 font-bold' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono text-neutral-400 font-bold mb-0.5">Proyecto de Trabajo</div>
              <div className="text-xs font-semibold">
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setSelectedProjectId(Number(val));
                      setSelectedLlamadoId(null);
                    } else {
                      setSelectedProjectId(null);
                      setSelectedLlamadoId(null);
                    }
                  }}
                  className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-orange-500 cursor-pointer min-w-[140px] max-w-[200px]"
                >
                  <option value="" className="text-neutral-400 bg-neutral-900">-- Mostrar Todos --</option>
                  {lookups.proyectos?.map(p => (
                    <option key={p.id} value={p.id} className="text-white bg-neutral-900">
                      {p.campana || `Proyecto #${p.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedProjectId && (
              <button
                onClick={() => {
                  setSelectedProjectId(null);
                  setSelectedLlamadoId(null);
                }}
                className="ml-2 text-neutral-400 hover:text-rose-400 font-bold text-[9px] uppercase tracking-wider bg-neutral-800/80 hover:bg-neutral-800 px-2 py-1 rounded transition-colors cursor-pointer"
                title="Quitar filtro de proyecto"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Vertical divider */}
          <div className="hidden md:block w-px h-8 bg-neutral-800" />

          {/* Working Call Sheet Context */}
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${selectedLlamadoId ? 'bg-teal-500/10 border-teal-500/40 text-teal-400 font-bold' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest font-mono text-neutral-400 font-bold mb-0.5">Llamado Activo</div>
              <div className="text-xs font-semibold">
                <select
                  value={selectedLlamadoId || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const id = Number(val);
                      setSelectedLlamadoId(id);
                      // Match parent project
                      const matchingLlamado = lookups.llamados?.find(l => l.id === id);
                      if (matchingLlamado && matchingLlamado.proyecto_id) {
                        setSelectedProjectId(matchingLlamado.proyecto_id);
                      }
                    } else {
                      setSelectedLlamadoId(null);
                    }
                  }}
                  className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer min-w-[140px] max-w-[240px]"
                >
                  <option value="" className="text-neutral-400 bg-neutral-900">-- Seleccionar --</option>
                  {(lookups.llamados || [])
                    .filter(l => !selectedProjectId || l.proyecto_id === selectedProjectId)
                    .map(l => {
                      const proj = lookups.proyectos?.find(p => p.id === l.proyecto_id);
                      const projLabel = proj ? proj.campana : `Proy #${l.proyecto_id}`;
                      return (
                        <option key={l.id} value={l.id} className="text-white bg-neutral-900">
                          {l.fecha} ({l.d_o_d || "Día único"}) [{projLabel}]
                        </option>
                      );
                    })
                  }
                </select>
              </div>
            </div>
            {selectedLlamadoId && (
              <button
                onClick={() => setSelectedLlamadoId(null)}
                className="ml-2 text-neutral-400 hover:text-rose-400 font-bold text-[9px] uppercase tracking-wider bg-neutral-800/80 hover:bg-neutral-800 px-2 py-1 rounded transition-colors cursor-pointer"
                title="Quitar filtro de llamado"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Warning Badge if no active filter */}
        <div className="text-right flex items-center gap-2">
          {(!selectedProjectId || !selectedLlamadoId) && (
            <span className="text-xs text-orange-400 font-medium inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Para filtrar sub-tablas, activa un proyecto/llamado en sus secciones.</span>
            </span>
          )}
        </div>
      </div>
      
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
        
        <div className="flex flex-wrap items-center gap-2">
          {["escenas", "talento", "pdr", "shotlist", "proyectos", "llamados", "locaciones", "cliente_agencia", "crew_llamado"].includes(table) && (
            <>
              <button
                onClick={() => setConfirmModal({ type: "deleteAll", isOpen: true })}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs hover:shadow-sm"
                title="Borrar todas las filas de esta tabla"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Borrar todo
              </button>
              
              <button
                onClick={() => setConfirmModal({ type: "resetIds", isOpen: true })}
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs hover:shadow-sm"
                title="Resetear valor de auto-incremento de ID de esta tabla a 1"
              >
                <RefreshCcw className="w-4 h-4 text-amber-500 animate-spin-hover" />
                Resetear IDs
              </button>
            </>
          )}

          <button
            onClick={onAddClick}
            className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
            id={`btn-add-${table}`}
          >
            <Plus className="w-4 h-4 text-orange-500" />
            Nueva Entrada
          </button>

          {table === "crew_llamado" && selectedLlamadoId !== null && (
            <>
              <button
                onClick={() => {
                  setSelectedCrewIds(new Set());
                  setCrewBulkSearch("");
                  setIsCrewBulkOpen(true);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
                title="Asignar varios miembros del crew al llamado activo"
              >
                <Users className="w-4 h-4 text-teal-200" />
                Asignar Varios
              </button>

              <button
                onClick={() => {
                  setBulkHora("");
                  setIsHoraBulkOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
                title="Asignar la misma Hora Llamado a todo el crew del llamado activo"
              >
                <Clock className="w-4 h-4 text-indigo-200" />
                Hora Llamado
              </button>

              <button
                onClick={() => {
                  setCopyCrewSourceId("");
                  setCopyCrewMode("merge");
                  setCopyCrewSearch("");
                  setIsCopyCrewOpen(true);
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
                title="Copiar la asignación de crew de otro llamado al llamado activo"
              >
                <Copy className="w-4 h-4 text-sky-200" />
                Copiar Crew
              </button>
            </>
          )}

          {table === "pdr" && selectedLlamadoId !== null && (
            <button
              onClick={() => {
                setSelectedPdrShotlistIds(new Set());
                setPdrBulkSearch("");
                setIsPdrBulkOpen(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
              title="Asignar varias tomas del shotlist al llamado activo"
            >
              <Plus className="w-4 h-4 text-orange-200" />
              Asignar Varios
            </button>
          )}

          {table === "talento" && selectedLlamadoId !== null && (
            <button
              onClick={() => {
                setSelectedTalentoKeys(new Set());
                setTalentoBulkSearch("");
                setIsTalentoBulkOpen(true);
              }}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
              title="Asignar varios talentos (clonando su perfil) al llamado activo"
            >
              <Plus className="w-4 h-4 text-violet-200" />
              Asignar Varios
            </button>
          )}

          {table === "cliente_agencia" && selectedLlamadoId !== null && (
            <button
              onClick={() => {
                setSelectedClienteKeys(new Set());
                setClienteBulkSearch("");
                setIsClienteBulkOpen(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-xs cursor-pointer"
              title="Asignar varios clientes/agencias (clonando su perfil) al llamado activo"
            >
              <Plus className="w-4 h-4 text-rose-200" />
              Asignar Varios
            </button>
          )}
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
                { key: "descripcion", label: "Descripción" },
                { key: "cast_ids", label: "Cast IDs" },
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
        {["crew_llamado", "cliente_agencia", "pdr"].includes(table) && !selectedLlamadoId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto my-auto animate-fade-in shadow-xs">
            <div className="p-3.5 bg-teal-50 border border-teal-100 rounded-full text-teal-600 mb-4 animate-bounce">
              <Calendar className="w-8 h-8" />
            </div>
            <h4 className="font-condensed font-extrabold text-xl text-neutral-800 uppercase tracking-tight">Debes seleccionar un Llamado</h4>
            <p className="text-neutral-500 text-sm mt-1.5 max-w-md mb-6 font-sans">
              Para ver, agregar o editar <strong>{getTableTitle()}</strong>, primero debes seleccionar sobre cuál Hoja de Llamado de Rodaje vas a trabajar.
            </p>
            
            <div className="w-full max-w-md space-y-3 bg-neutral-50 p-6 rounded-2xl border border-neutral-200 shadow-xs text-left font-sans">
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
                Elegir un llamado rápido:
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const id = Number(val);
                    setSelectedLlamadoId(id);
                    const matchingLlamado = lookups.llamados.find(l => l.id === id);
                    if (matchingLlamado && matchingLlamado.proyecto_id) {
                      setSelectedProjectId(matchingLlamado.proyecto_id);
                    }
                  }
                }}
                className="w-full pl-3 pr-10 py-3 bg-white border border-neutral-350 rounded-xl text-sm font-semibold text-neutral-700 focus:outline-hidden focus:ring-2 focus:ring-neutral-800 transition-all cursor-pointer shadow-xs"
                defaultValue=""
              >
                <option value="">-- Selecciona un llamado de la lista --</option>
                {lookups.llamados
                  .filter(l => !selectedProjectId || l.proyecto_id === selectedProjectId)
                  .map(l => {
                    const proj = lookups.proyectos.find(p => p.id === l.proyecto_id);
                    const nameStr = proj ? proj.campana : `Proyecto #${l.proyecto_id}`;
                    return (
                      <option key={l.id} value={l.id}>
                        {l.fecha} ({l.d_o_d || "Día único"}) [Proy: {nameStr}]
                      </option>
                    );
                  })
                }
              </select>
              
              {selectedProjectId ? (
                <div className="text-xs text-neutral-450 mt-2">
                  Filtrando llamados del proyecto <span className="font-bold text-orange-500">{resolveProject(selectedProjectId)}</span>.
                </div>
              ) : (
                <div className="text-xs text-neutral-450 mt-2">
                  Mostrando todos los llamados disponibles de todos los proyectos.
                </div>
              )}
            </div>
          </div>
        ) : filteredData.length === 0 ? (
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
                  {table !== "crew_llamado" && table !== "shotlist" && table !== "pdr" && table !== "talento" && <th className="p-3.5 pl-6 w-20">ID</th>}
                  
                  {/* Dynamic headers depending on table */}
                  {table === "proyectos" && (
                    <>
                      <th className="p-3.5 w-32 text-orange-400">Trabajar</th>
                      <th className="p-3.5">Campaña</th>
                      <th className="p-3.5">Productora</th>
                      <th className="p-3.5">Colores de Marca</th>
                    </>
                  )}

                  {table === "llamados" && (
                    <>
                      <th className="p-3.5 w-36 text-teal-400">Trabajar</th>
                      <th className="p-3.5">Proyecto Relacionado</th>
                      <th className="p-3.5">Fecha / D.O.D</th>
                      <th className="p-3.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hora / Ciudad</th>
                      <th className="p-3.5">Comidas</th>
                      <th className="p-3.5">Lugar / Lluvia</th>
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
                      <th className="p-3.5">Notas</th>
                      <th className="p-3.5">Hora Llamado</th>
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
                      <th className="p-3.5">ID</th>
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
                      <th className="p-3.5 w-40 text-center">Referencia</th>
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
                      {visibleColumns.descripcion && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed min-w-[14rem]">Descripción</th>
                      )}
                      {visibleColumns.cast_ids && (
                        <th className="p-2 border border-neutral-200 bg-neutral-900 text-white font-condensed w-40 text-center">Cast IDs</th>
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
                    {table !== "crew_llamado" && table !== "shotlist" && table !== "pdr" && table !== "talento" && (
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
                          <button
                            onClick={() => {
                              if (selectedProjectId === row.id) {
                                setSelectedProjectId(null);
                                setSelectedLlamadoId(null);
                              } else {
                                setSelectedProjectId(row.id);
                                setSelectedLlamadoId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              selectedProjectId === row.id
                                ? "bg-orange-500 border-orange-500 text-white shadow-xs hover:bg-orange-600"
                                : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>{selectedProjectId === row.id ? "Activo" : "Seleccionar"}</span>
                          </button>
                        </td>
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
                        <td className="p-3.5">
                          <button
                            onClick={() => {
                              if (selectedLlamadoId === row.id) {
                                setSelectedLlamadoId(null);
                              } else {
                                setSelectedLlamadoId(row.id);
                                if (row.proyecto_id && selectedProjectId !== row.proyecto_id) {
                                  setSelectedProjectId(row.proyecto_id);
                                }
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              selectedLlamadoId === row.id
                                ? "bg-teal-600 border-teal-600 text-white shadow-xs hover:bg-teal-700"
                                : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{selectedLlamadoId === row.id ? "Activo" : "Seleccionar"}</span>
                          </button>
                        </td>
                        <td className="p-3.5 font-semibold text-neutral-800">
                          {resolveProject(row.proyecto_id)}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-semibold font-mono text-neutral-700">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            {row.fecha}
                          </div>
                          <div className="text-xs text-orange-600 font-bold uppercase">{row.d_o_d || "Día único"}</div>
                          {/* <a
                            href={`./llamado.html?id=${row.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline mt-1.5 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" /> Ver Hoja de Llamado
                          </a> */}
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="font-bold text-neutral-700">{row.llamado_hora || "-- : --"}</div>
                          <div className="text-neutral-500 font-medium">{resolveCiudad(row.ciudad_id)}</div>
                        </td>
                        <td className="p-3.5 text-xs text-neutral-500">
                          <div>☕ Desayuno: <span className="font-bold">{row.desayuno || "No especifica"}</span></div>
                          <div>🍽️ Almuerzo: <span className="font-bold">{row.almuerzo || "No especifica"}</span></div>
                        </td>
                        <td className="p-3.5 text-xs">
                          <div className="font-semibold text-neutral-700">📍 {row.lugar_llamado || <span className="text-neutral-400 italic">sin especificar</span>}</div>
                          <div className="text-neutral-500">🌧️ {row.lluvia_c || <span className="text-neutral-400 italic">—</span>}</div>
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
                        <td>
                          <div className="p-3.5 text-xs font-mono font-bold text-neutral-700 bg-neutral-50 px-2 py-1 rounded inline-block">{row.llamado_hora || "Sin definir"}</div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: CREW_LLAMADO ───── */}
                    {table === "crew_llamado" && (
                      <>
                        <td className="p-3.5 font-mono text-xs">
                          <div className="flex items-center gap-1">
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
                              className="w-12 px-1.5 py-0.5 text-center font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:ring-1 focus:ring-neutral-800 focus:outline-hidden"
                              placeholder="—"
                            />
                            <div className="flex flex-col">
                              {(() => {
                                const activeCrewRows = sortedAndFilteredData.filter(
                                  (r) => Number(r.llamado_id) === Number(selectedLlamadoId)
                                );
                                const pos = activeCrewRows.findIndex((r) => Number(r.id) === Number(row.id));
                                const isFirst = pos === 0;
                                const isLast = pos === activeCrewRows.length - 1;
                                return (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isFirst}
                                      onClick={() => handleMoveCrew(row.id, "up")}
                                      className="text-neutral-400 hover:text-neutral-900 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-neutral-100 rounded transition-colors leading-none cursor-pointer p-0.5"
                                      title="Mover arriba"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLast}
                                      onClick={() => handleMoveCrew(row.id, "down")}
                                      className="text-neutral-400 hover:text-neutral-900 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-neutral-100 rounded transition-colors leading-none cursor-pointer p-0.5"
                                      title="Mover abajo"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
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
                                  {c.nombre} [{c.cargo || "S/C"}]
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-neutral-700 uppercase bg-neutral-100 px-2 py-1 rounded-sm tracking-wide text-xs">
                            {lookups.crew.find((c) => c.id === row.crew_id)?.departamento || "Cámara"}
                          </span>
                        </td>
                        <td className="p-3.5 text-xs">
                          <input
                            key={`${row.id}_${row.prioridad ?? ""}`}
                            type="number"
                            defaultValue={row.prioridad === undefined || row.prioridad === null ? "" : row.prioridad}
                            onBlur={(e) => {
                              const val = e.target.value === "" ? null : Number(e.target.value);
                              if (val !== row.prioridad) {
                                handleInlineUpdate(row.id, "prioridad", val);
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
                          <input
                            key={`${row.id}_${row.notas ?? ""}`}
                            type="text"
                            defaultValue={row.notas || ""}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (row.notas || "")) {
                                handleInlineUpdate(row.id, "notas", val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full max-w-[140px] px-1.5 py-0.5 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:ring-1 focus:ring-neutral-800 focus:outline-hidden"
                            placeholder="—"
                          />
                        </td>
                        <td className="p-3.5 text-xs">
                          <input
                            key={`${row.id}_${row.hora_llamado ?? ""}`}
                            type="text"
                            defaultValue={row.hora_llamado || ""}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (row.hora_llamado || "")) {
                                handleInlineUpdate(row.id, "hora_llamado", val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-20 px-1.5 py-0.5 text-center font-mono font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 rounded focus:bg-white focus:ring-1 focus:ring-neutral-800 focus:outline-hidden"
                            placeholder="—"
                          />
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
                        <td>
                          <div className="p-3.5 text-xs font-mono font-bold text-neutral-700 bg-neutral-50 px-2 py-1 rounded inline-block">{row.horario_loc || "Sin definir"}</div>
                        </td>
                      </>
                    )}

                    {/* ───── TABLA: TALENTO (REPARTO) ───── */}
                    {table === "talento" && (
                      <>
                        <td className="p-3.5 font-mono font-bold text-sm text-neutral-800">{row.id_personaje}</td>
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
                              {[...(() => {
                                const matchingLlamado = lookups.llamados.find(l => Number(l.id) === Number(row.llamado_id));
                                const rowProyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
                                return rowProyectoId 
                                  ? lookups.shotlist.filter(s => Number(s.proyecto_id) === Number(rowProyectoId))
                                  : [];
                              })()]
                                .sort((a, b) => {
                                  const escComp = (a.esc || "").localeCompare(b.esc || "", undefined, { numeric: true, sensitivity: "base" });
                                  if (escComp !== 0) return escComp;
                                  return (a.plano || "").localeCompare(b.plano || "", undefined, { numeric: true, sensitivity: "base" });
                                })
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    Esc: {s.esc || "—"} | Plano: {s.plano || "—"} ({s.descripcion ? (s.descripcion.length > 40 ? s.descripcion.substring(0, 40) + "..." : s.descripcion) : "Sin descripción"})
                                  </option>
                                ))}
                            </select>
                          </div>
                        </td>
                        <td className="p-2 border-l border-r border-neutral-100 bg-white w-40">
                          {(() => {
                            const shotlistRow = lookups.shotlist.find((s) => s.id === row.shotlist_id);
                            const refUrls = shotlistRow?.referencia_urls ? shotlistRow.referencia_urls.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                            return refUrls.length > 0 ? (
                              <div className="flex flex-col gap-1 max-h-24 overflow-y-auto p-0.5">
                                {refUrls.map((url: string, i: number) => (
                                  <div key={i} className="relative aspect-video bg-neutral-50 border border-neutral-200 rounded overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                    <img
                                      src={url}
                                      alt={`Ref ${i + 1}`}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-1.5 text-[10px] text-neutral-405 italic">
                                Sin Referencias
                              </div>
                            );
                          })()}
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

                        {/* 4. Descripción de la Toma */}
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

                        {/* 5. Cast IDs */}
                        {visibleColumns.cast_ids && (
                          <td className="p-1 border border-neutral-200 bg-white">
                            {(() => {
                              const talents = resolveCastIds(row.cast_ids);
                              return talents.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {talents.map((t: any) => (
                                    <span key={t.id} className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                                      {t.nombre}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[10px] text-neutral-400 italic text-center">—</div>
                              );
                            })()}
                          </td>
                        )}

                        {/* 6. Locación */}
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

                        {/* 7. Notas */}
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

                        {/* 8. Referencia con subida directa y vista storyboard stacked */}
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
                                                await deleteFileFromBucket(url);
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
                                                  const cleanName = `img/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
                                                  
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
                    {visibleColumns.descripcion && (
                      <td className="p-1 border border-neutral-200 bg-white" />
                    )}
                    {visibleColumns.cast_ids && (
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

                    {/* 2. Llamado empty cell placeholder */}
                    <td className="p-1 border border-neutral-200 bg-white text-xs text-center font-mono font-bold text-neutral-400">
                      Nuevo
                    </td>

                    {/* 3. Toma del Shotlist dropdown select */}
                    <td className="p-1 border border-neutral-200 bg-white text-xs">
                      <div className="flex items-center gap-1">
                        <CornerDownRight className="w-3.5 h-3.5 text-neutral-400 shrink-0 ml-1.5" />
                        <select
                          value={quickAddPdrShotlistId}
                          onChange={(e) => setQuickAddPdrShotlistId(e.target.value ? Number(e.target.value) : "")}
                          className="bg-transparent border-0 hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-neutral-800 text-xs font-bold text-[#059669] p-2 rounded cursor-pointer max-w-md w-full"
                        >
                          <option value="">-- Seleccionar Toma/Plano a añadir --</option>
                          {[...(() => {
                            const matchingLlamado = lookups.llamados.find(l => Number(l.id) === Number(selectedLlamadoId));
                            const rowProyectoId = matchingLlamado ? Number(matchingLlamado.proyecto_id) : null;
                            return rowProyectoId 
                              ? lookups.shotlist.filter(s => Number(s.proyecto_id) === Number(rowProyectoId))
                              : [];
                          })()]
                            .sort((a, b) => {
                              const escComp = (a.esc || "").localeCompare(b.esc || "", undefined, { numeric: true, sensitivity: "base" });
                              if (escComp !== 0) return escComp;
                              return (a.plano || "").localeCompare(b.plano || "", undefined, { numeric: true, sensitivity: "base" });
                            })
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                Esc: {s.esc || "—"} | Plano: {s.plano || "—"} ({s.descripcion ? (s.descripcion.length > 40 ? s.descripcion.substring(0, 40) + "..." : s.descripcion) : "Sin descripción"})
                              </option>
                            ))}
                        </select>
                      </div>
                    </td>

                    {/* 4. Referencia empty cell */}
                    <td className="p-1 border border-neutral-200 bg-white" />

                    {/* 5. Minutos empty cell */}
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

      {/* ───── MODAL: ASIGNACIÓN MASIVA DE CREW ───── */}
      {isCrewBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-5xl w-full p-5 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  Asignar Varios Crew
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Selecciona el personal para <span className="font-bold text-neutral-700">{resolveLlamado(selectedLlamadoId!)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsCrewBulkOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {unassignedCrew.length === 0 ? (
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 text-center text-sm text-teal-700 font-medium">
                ✅ Todo el personal del crew ya está asignado a este llamado.
              </div>
            ) : (
              <>
                {/* Barra de búsqueda + contador */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={crewBulkSearch}
                      onChange={(e) => setCrewBulkSearch(e.target.value)}
                      placeholder="Buscar por nombre, cargo o departamento..."
                      className="w-full pl-8 pr-8 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-800 focus:bg-white transition-all"
                    />
                    {crewBulkSearch && (
                      <button
                        onClick={() => setCrewBulkSearch("")}
                        className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCrewIds(
                          new Set(filteredUnassignedCrew.map((c) => Number(c.id)))
                        );
                      }}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      Seleccionar todos ({filteredUnassignedCrew.length})
                    </button>
                    <span className="text-xs font-semibold text-neutral-500">
                      {selectedCrewIds.size} seleccionados
                    </span>
                  </div>
                </div>

                {/* Grid de 3 columnas compacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 max-h-[55vh] overflow-y-auto border border-neutral-200 rounded-xl p-1.5">
                  {filteredUnassignedCrew.map((c) => {
                    const isSelected = selectedCrewIds.has(Number(c.id));
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-teal-50/80 ring-1 ring-teal-200" : "hover:bg-neutral-50"
                        }`}
                        title={`${c.nombre} — ${c.cargo || "Sin cargo"} (${c.departamento || "Sin depto"})`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedCrewIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(Number(c.id));
                              else next.delete(Number(c.id));
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 accent-teal-600 cursor-pointer shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-neutral-800 truncate">{c.nombre}</div>
                          <div className="text-[10px] text-neutral-500 truncate">
                            {c.cargo || "Sin cargo"} · {c.departamento || "Sin depto"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {filteredUnassignedCrew.length === 0 && (
                  <div className="text-center text-xs text-neutral-400 italic py-6">
                    No se encontraron resultados para "{crewBulkSearch}".
                  </div>
                )}

                <div className="flex gap-2.5 pt-4 mt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    disabled={isCrewBulkSaving}
                    onClick={() => setIsCrewBulkOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isCrewBulkSaving || selectedCrewIds.size === 0}
                    onClick={handleBulkAssignCrew}
                    className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCrewBulkSaving ? "Asignando..." : "Asignar Seleccionados"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ───── MODAL: HORA LLAMADO MASIVA ───── */}
      {isHoraBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Hora Llamado Masiva
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Asignará la misma hora a todo el crew de <span className="font-bold text-neutral-700">{resolveLlamado(selectedLlamadoId!)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsHoraBulkOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">
              Hora de Llamado (HH:MM)
            </label>
            <input
              type="text"
              value={bulkHora}
              onChange={(e) => setBulkHora(e.target.value)}
              placeholder="Ej: 07:00"
              className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm font-mono font-bold focus:ring-2 focus:ring-neutral-800 focus:outline-hidden"
            />

            <div className="flex gap-2.5 pt-4 mt-4 border-t border-neutral-100">
              <button
                type="button"
                disabled={isHoraBulkSaving}
                onClick={() => setIsHoraBulkOpen(false)}
                className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isHoraBulkSaving}
                onClick={handleBulkSetHora}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isHoraBulkSaving ? "Guardando..." : "Aplicar a Todos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MODAL: COPIAR ASIGNACIÓN DE CREW ───── */}
      {isCopyCrewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight flex items-center gap-2">
                  <Copy className="w-5 h-5 text-sky-600" />
                  Copiar Asignación de Crew
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Copia el crew de otro llamado hacia <span className="font-bold text-neutral-700">{resolveLlamado(selectedLlamadoId!)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsCopyCrewOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de llamado origen */}
            <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">
              Llamado de Origen
            </label>
            <select
              value={copyCrewSourceId}
              onChange={(e) => setCopyCrewSourceId(e.target.value ? Number(e.target.value) : "")}
              className="w-full border border-neutral-300 rounded-lg p-2.5 text-sm font-semibold text-neutral-800 focus:ring-2 focus:ring-sky-500 focus:outline-hidden mb-1"
            >
              <option value="">-- Seleccionar llamado de origen --</option>
              {copyCrewCandidates.map((l) => (
                <option key={l.id} value={l.id}>
                  {resolveLlamado(Number(l.id))} ({l.crewCount} crew)
                </option>
              ))}
            </select>

            {/* Búsqueda dentro de los candidatos */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={copyCrewSearch}
                onChange={(e) => setCopyCrewSearch(e.target.value)}
                placeholder="Buscar llamado por campaña o D.O.D..."
                className="w-full pl-8 pr-8 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
              />
              {copyCrewSearch && (
                <button
                  onClick={() => setCopyCrewSearch("")}
                  className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Modo de copia */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 mb-4">
              <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">
                Modo de Copia
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCopyCrewMode("merge")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer border ${
                    copyCrewMode === "merge"
                      ? "bg-sky-600 border-sky-600 text-white shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-600 hover:border-sky-300 hover:text-sky-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">➕</span> Unir (Merge)
                  </div>
                  <div className={`mt-0.5 font-normal ${copyCrewMode === "merge" ? "text-sky-100" : "text-neutral-400"}`}>
                    Agrega solo el crew que falte en el destino, sin tocar el actual.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCopyCrewMode("replace")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer border ${
                    copyCrewMode === "replace"
                      ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                      : "bg-white border-neutral-200 text-neutral-600 hover:border-rose-300 hover:text-rose-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🔄</span> Reemplazar
                  </div>
                  <div className={`mt-0.5 font-normal ${copyCrewMode === "replace" ? "text-rose-100" : "text-neutral-400"}`}>
                    Borra el crew actual del destino y copia todo el del origen.
                  </div>
                </button>
              </div>
            </div>

            {/* Resumen antes de confirmar */}
            {copyCrewSourceId ? (
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-800 mb-4">
                {(() => {
                  const src = copyCrewCandidates.find((l) => Number(l.id) === Number(copyCrewSourceId));
                  if (!src) return null;
                  const crewCount = src.crewCount || 0;
                  if (crewCount === 0) {
                    return <span>⚠️ El llamado de origen no tiene crew asignado.</span>;
                  }
                  return (
                    <span>
                      Se {copyCrewMode === "merge" ? "sincronizarán" : "reemplazarán"} <strong>{crewCount}</strong>{" "}
                      miembro(s) de crew de <strong>{resolveLlamado(Number(copyCrewSourceId))}</strong> hacia{" "}
                      <strong>{resolveLlamado(Number(selectedLlamadoId))}</strong>,{" "}
                      copiando también su <strong>orden</strong> y <strong>prioridad</strong>{" "}
                      {copyCrewMode === "merge"
                        ? "(actualizando los que ya existan y agregando los que falten)."
                        : "(reemplazando todo el crew del destino)."}
                    </span>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3 text-xs text-neutral-400 mb-4">
                Selecciona un llamado de origen para ver el resumen.
              </div>
            )}

            <div className="flex gap-2.5 pt-4 mt-3 border-t border-neutral-100">
              <button
                type="button"
                disabled={isCopyCrewSaving}
                onClick={() => setIsCopyCrewOpen(false)}
                className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCopyCrewSaving || !copyCrewSourceId}
                onClick={handleCopyCrew}
                className="flex-1 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isCopyCrewSaving ? "Copiando..." : "Copiar Crew"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── MODAL: ASIGNACIÓN MASIVA DE PDR (SHOTLIST) ───── */}
      {isPdrBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-600" />
                  Asignar Varios Planos (PDR)
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Selecciona las tomas del shotlist para <span className="font-bold text-neutral-700">{resolveLlamado(selectedLlamadoId!)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsPdrBulkOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {availablePdrShotlists.length === 0 ? (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center text-sm text-orange-700 font-medium">
                ✅ No hay tomas del shotlist disponibles para asignar (todas las de este proyecto ya fueron usadas).
              </div>
            ) : (
              <>
                {/* Barra de búsqueda + contador */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={pdrBulkSearch}
                      onChange={(e) => setPdrBulkSearch(e.target.value)}
                      placeholder="Buscar por escena, plano o descripción..."
                      className="w-full pl-8 pr-8 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-800 focus:bg-white transition-all"
                    />
                    {pdrBulkSearch && (
                      <button
                        onClick={() => setPdrBulkSearch("")}
                        className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPdrShotlistIds(
                          new Set(availablePdrShotlists.map((s) => Number(s.id)))
                        );
                      }}
                      className="text-xs font-bold text-orange-700 hover:text-orange-900 cursor-pointer"
                    >
                      Seleccionar todos ({availablePdrShotlists.length})
                    </button>
                    <span className="text-xs font-semibold text-neutral-500">
                      {selectedPdrShotlistIds.size} seleccionados
                    </span>
                  </div>
                </div>

                {/* Lista vertical de tomas */}
                <div className="max-h-[55vh] overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                  {availablePdrShotlists.map((s) => {
                    const isSelected = selectedPdrShotlistIds.has(Number(s.id));
                    const plano = String(s.plano || "").toUpperCase();
                    const isReusable = plano === "ES";
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                          isSelected ? "bg-orange-50/70" : "hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedPdrShotlistIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(Number(s.id));
                              else next.delete(Number(s.id));
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-orange-600 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                            <span className="font-mono">Esc: {s.esc || "—"} | Plano: {s.plano || "—"}</span>
                            {isReusable && (
                              <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                                Reusable
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {s.descripcion || "Sin descripción"}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {availablePdrShotlists.length === 0 && pdrBulkSearch && (
                  <div className="text-center text-xs text-neutral-400 italic py-6">
                    No se encontraron resultados para "{pdrBulkSearch}".
                  </div>
                )}

                <div className="flex gap-2.5 pt-4 mt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    disabled={isPdrBulkSaving}
                    onClick={() => setIsPdrBulkOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isPdrBulkSaving || selectedPdrShotlistIds.size === 0}
                    onClick={handleBulkAssignPdr}
                    className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isPdrBulkSaving ? "Asignando..." : "Asignar Seleccionados"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ───── MODAL: ASIGNACIÓN MASIVA DE TALENTO (CLONACIÓN) ───── */}
      {isTalentoBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight flex items-center gap-2">
                  <Plus className="w-5 h-5 text-violet-600" />
                  Asignar Varios Talentos
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Clonará los perfiles seleccionados para <span className="font-bold text-neutral-700">{resolveLlamado(selectedLlamadoId!)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsTalentoBulkOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {availableTalentoBase.length === 0 ? (
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-6 text-center text-sm text-violet-700 font-medium">
                ✅ No hay talentos disponibles para asignar (todos los del proyecto ya están en este llamado).
              </div>
            ) : (
              <>
                {/* Barra de búsqueda + contador */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={talentoBulkSearch}
                      onChange={(e) => setTalentoBulkSearch(e.target.value)}
                      placeholder="Buscar por nombre o rol..."
                      className="w-full pl-8 pr-8 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-800 focus:bg-white transition-all"
                    />
                    {talentoBulkSearch && (
                      <button
                        onClick={() => setTalentoBulkSearch("")}
                        className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTalentoKeys(
                          new Set(availableTalentoBase.map((t) => String(t.nombre || "").trim().toLowerCase()))
                        );
                      }}
                      className="text-xs font-bold text-violet-700 hover:text-violet-900 cursor-pointer"
                    >
                      Seleccionar todos ({availableTalentoBase.length})
                    </button>
                    <span className="text-xs font-semibold text-neutral-500">
                      {selectedTalentoKeys.size} seleccionados
                    </span>
                  </div>
                </div>

                {/* Lista vertical de talentos */}
                <div className="max-h-[55vh] overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                  {availableTalentoBase.map((t) => {
                    const key = String(t.nombre || "").trim().toLowerCase();
                    const isSelected = selectedTalentoKeys.has(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                          isSelected ? "bg-violet-50/70" : "hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedTalentoKeys((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-violet-600 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-neutral-800">{t.nombre}</div>
                          <div className="text-xs text-neutral-500 truncate">
                            {t.rol || "Sin rol"} {t.llamado_hora ? `· ${t.llamado_hora}` : ""}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {availableTalentoBase.length === 0 && talentoBulkSearch && (
                  <div className="text-center text-xs text-neutral-400 italic py-6">
                    No se encontraron resultados para "{talentoBulkSearch}".
                  </div>
                )}

                <div className="flex gap-2.5 pt-4 mt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    disabled={isTalentoBulkSaving}
                    onClick={() => setIsTalentoBulkOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isTalentoBulkSaving || selectedTalentoKeys.size === 0}
                    onClick={handleBulkAssignTalento}
                    className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isTalentoBulkSaving ? "Clonando..." : "Asignar Seleccionados"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ───── MODAL: ASIGNACIÓN MASIVA DE CLIENTE / AGENCIA (CLONACIÓN) ───── */}
      {isClienteBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-neutral-100 transform scale-100 transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 font-condensed uppercase tracking-tight flex items-center gap-2">
                  <Plus className="w-5 h-5 text-rose-600" />
                  Asignar Varios Clientes / Agencias
                </h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Clonará los perfiles seleccionados para <span className="font-bold text-neutral-700">{resolveLlamado(selectedLlamadoId!)}</span>
                </p>
              </div>
              <button
                onClick={() => setIsClienteBulkOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {availableClienteBase.length === 0 ? (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 text-center text-sm text-rose-700 font-medium">
                ✅ No hay clientes/agencias disponibles para asignar (todos los del proyecto ya están en este llamado).
              </div>
            ) : (
              <>
                {/* Barra de búsqueda + contador */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={clienteBulkSearch}
                      onChange={(e) => setClienteBulkSearch(e.target.value)}
                      placeholder="Buscar por nombre, empresa o tipo..."
                      className="w-full pl-8 pr-8 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-neutral-800 focus:bg-white transition-all"
                    />
                    {clienteBulkSearch && (
                      <button
                        onClick={() => setClienteBulkSearch("")}
                        className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClienteKeys(
                          new Set(availableClienteBase.map((r) => String(r.nombre || "").trim().toLowerCase()))
                        );
                      }}
                      className="text-xs font-bold text-rose-700 hover:text-rose-900 cursor-pointer"
                    >
                      Seleccionar todos ({availableClienteBase.length})
                    </button>
                    <span className="text-xs font-semibold text-neutral-500">
                      {selectedClienteKeys.size} seleccionados
                    </span>
                  </div>
                </div>

                {/* Lista vertical de clientes/agencias */}
                <div className="max-h-[55vh] overflow-y-auto border border-neutral-200 rounded-xl divide-y divide-neutral-100">
                  {availableClienteBase.map((r) => {
                    const key = String(r.nombre || "").trim().toLowerCase();
                    const isSelected = selectedClienteKeys.has(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                          isSelected ? "bg-rose-50/70" : "hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedClienteKeys((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(key);
                              else next.delete(key);
                              return next;
                            });
                          }}
                          className="w-4 h-4 accent-rose-600 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-neutral-800">{r.nombre}</div>
                          <div className="text-xs text-neutral-500 truncate">
                            {r.empresa || "Sin empresa"} {r.tipo ? `· ${r.tipo}` : ""}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {availableClienteBase.length === 0 && clienteBulkSearch && (
                  <div className="text-center text-xs text-neutral-400 italic py-6">
                    No se encontraron resultados para "{clienteBulkSearch}".
                  </div>
                )}

                <div className="flex gap-2.5 pt-4 mt-3 border-t border-neutral-100">
                  <button
                    type="button"
                    disabled={isClienteBulkSaving}
                    onClick={() => setIsClienteBulkOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isClienteBulkSaving || selectedClienteKeys.size === 0}
                    onClick={handleBulkAssignCliente}
                    className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isClienteBulkSaving ? "Clonando..." : "Asignar Seleccionados"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
