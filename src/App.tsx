import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { DbTable, Proyectos, Llamados, Locaciones } from "./types";
import Sidebar from "./components/Sidebar";
import TableEditor from "./components/TableEditor";
import FormModal from "./components/FormModal";
import { 
  LogOut, 
  RefreshCw, 
  Settings2, 
  Video, 
  Loader2, 
  Globe, 
  User, 
  ShieldCheck,
  CheckCircle,
  XCircle,
  HelpCircle
} from "lucide-react";

export default function App() {
  // Authentication & session state
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Active collection and records state
  const [activeTable, setActiveTable] = useState<DbTable>("proyectos");
  const [tableData, setTableData] = useState<any[]>([]);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<DbTable, number>>({
    proyectos: 0,
    llamados: 0,
    locaciones: 0,
    escenas: 0,
    crew: 0,
    crew_llamado: 0,
    cliente_agencia: 0,
    talento: 0,
    pdr: 0,
    shotlist: 0,
  });

  // Global relational lookup caches for dropdown menus
  const [lookups, setLookups] = useState<{
    proyectos: any[];
    llamados: any[];
    locaciones: any[];
    crew: any[];
    shotlist: any[];
    ciudades: any[];
  }>({
    proyectos: [],
    llamados: [],
    locaciones: [],
    crew: [],
    shotlist: [],
    ciudades: [],
  });

  // Form Modal controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

  // Status alerts & notifications
  const [notification, setNotification] = useState<{ text: string; mode: "success" | "error" | null }>({
    text: "",
    mode: null,
  });

  // 1. Initial mounting checks for active Supabase Auth user session
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionUser(session.user);
        }
      } catch (err) {
        console.error("Error checking auth status", err);
      } finally {
        setIsAuthChecking(false);
      }
    }
    
    checkAuth();

    // Listen to changes (Magic links, Google Login redirections)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSessionUser(session.user);
      } else {
        setSessionUser(null);
      }
      setIsAuthChecking(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 2. Load Lookups and RowCounts whenever session active or updated
  useEffect(() => {
    if (sessionUser) {
      loadLookupCaches();
      loadAllTableCounts();
    }
  }, [sessionUser]);

  // 3. Load active table data whenever activeTable state changes
  useEffect(() => {
    if (sessionUser) {
      fetchCurrentTableData();
    }
  }, [activeTable, sessionUser]);

  // Toast auto-clearing timer
  useEffect(() => {
    if (notification.text) {
      const tm = setTimeout(() => {
        setNotification({ text: "", mode: null });
      }, 5000);
      return () => clearTimeout(tm);
    }
  }, [notification]);

  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Trigger login using email and password
  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
      });
      if (error) {
        setNotification({ text: `Error de login: ${error.message}`, mode: "error" });
      } else {
        setNotification({ text: `Sesión iniciada con éxito`, mode: "success" });
      }
    } catch (err: any) {
      setNotification({ text: `Excepción de login: ${err.message}`, mode: "error" });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out triggers
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setSessionUser(null);
      setTableData([]);
    } catch (err: any) {
      setNotification({ text: `Logout error: ${err.message}`, mode: "error" });
    }
  };

  // Fetch count indicators for all 10 tables to show as badges in the sidebar
  const loadAllTableCounts = async () => {
    const list: DbTable[] = [
      "proyectos",
      "llamados",
      "locaciones",
      "escenas",
      "crew",
      "crew_llamado",
      "cliente_agencia",
      "talento",
      "pdr",
      "shotlist",
    ];
    
    // We can run these calls in parallel for optimal responsiveness
    try {
      const promises = list.map(async (table) => {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        
        return { table, count: error ? 0 : (count || 0) };
      });

      const results = await Promise.all(promises);
      const newCounts = { ...tableCounts };
      results.forEach((res) => {
        newCounts[res.table] = res.count;
      });
      setTableCounts(newCounts);
    } catch (err) {
      console.warn("Could not load table metadata counts", err);
    }
  };

  // Fetch values for dropdown select lookups (Proyectos, Llamados, Locaciones, Crew, Shotlist, Ciudades)
  const loadLookupCaches = async () => {
    // 1. Proyectos
    let projs: any[] = [];
    try {
      const { data, error } = await supabase.from("proyectos").select("id, campana, cliente").order("id", { ascending: false });
      if (error) console.error("Error fetching proyectos database lookup:", error);
      else projs = data || [];
    } catch (e) {
      console.error("Exception fetching proyectos lookup:", e);
    }

    // 2. Locaciones
    let locs: any[] = [];
    try {
      const { data, error } = await supabase.from("locaciones").select("id, locacion").order("locacion", { ascending: true });
      if (error) console.error("Error fetching locaciones database lookup:", error);
      else locs = data || [];
    } catch (e) {
      console.error("Exception fetching locaciones lookup:", e);
    }

    // 3. Crew members
    let crewList: any[] = [];
    try {
      const { data, error } = await supabase.from("crew").select("id, nombre, cargo, departamento").order("nombre", { ascending: true });
      if (error) console.error("Error fetching crew database lookup:", error);
      else crewList = data || [];
    } catch (e) {
      console.error("Exception fetching crew lookup:", e);
    }

    // 4. Shotlists
    let shotlistList: any[] = [];
    try {
      const { data, error } = await supabase.from("shotlist").select("id, esc, plano, descripcion, proyecto_id").order("id", { ascending: false });
      if (error) console.error("Error fetching shotlist database lookup:", error);
      else shotlistList = data || [];
    } catch (e) {
      console.error("Exception fetching shotlist lookup:", e);
    }

    // 5. Llamados (combines with decorated project campana names)
    let decoratedCalls: any[] = [];
    try {
      const { data: calls, error } = await supabase.from("llamados").select("id, fecha, d_o_d, proyecto_id").order("fecha", { ascending: false });
      if (error) {
        console.error("Error fetching llamados database lookup:", error);
      } else if (calls) {
        decoratedCalls = calls.map((c: any) => {
          const matchingProj = projs.find((p: any) => p.id === c.proyecto_id);
          return {
            ...c,
            proyecto_id_campana: matchingProj ? matchingProj.campana : `Proyecto #${c.proyecto_id}`,
          };
        });
      }
    } catch (e) {
      console.error("Exception fetching llamados lookup:", e);
    }

    // 6. Ciudades
    let cities: any[] = [];
    try {
      const { data, error } = await supabase.from("ciudades").select("*");
      if (error) {
        console.error("Error fetching ciudades database lookup (verify if RLS policy allows read/select access):", error);
      } else if (data) {
        cities = [...data];
        // Sort alphabetically by Name, safely handling mixed casing columns 'Nombre' or 'nombre'
        cities.sort((a, b) => {
          const nameA = String(a.Nombre || a.nombre || "").toLowerCase();
          const nameB = String(b.Nombre || b.nombre || "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
      }
    } catch (e) {
      console.error("Exception fetching ciudades lookup:", e);
    }

    setLookups({
      proyectos: projs,
      locaciones: locs,
      crew: crewList,
      shotlist: shotlistList,
      llamados: decoratedCalls,
      ciudades: cities,
    });
  };

  // Fetch complete rows from database for current selected activeTable state
  const fetchCurrentTableData = async () => {
    setIsTableLoading(true);
    try {
      let query = supabase.from(activeTable).select("*");
      
      const tablesSortedByIdAsc: DbTable[] = [
        "locaciones",
        "escenas",
        "crew",
        "crew_llamado",
        "cliente_agencia",
        "talento",
        "shotlist"
      ];

      if (tablesSortedByIdAsc.includes(activeTable)) {
        query = query.order("id", { ascending: true });
      } else if (activeTable === "pdr") {
        query = query.order("orden", { ascending: true });
      } else {
        query = query.order("id", { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }
      setTableData(data || []);
    } catch (err: any) {
      setNotification({
        text: `Error al cargar la tabla '${activeTable}': ${err.message}`,
        mode: "error",
      });
    } finally {
      setIsTableLoading(false);
    }
  };

  // Action: Insert or Update row payload in Supabase Db
  const handleSaveRow = async (values: any) => {
    const isEdit = !!values.id;
    const payload = { ...values };

    // Format clean timestamps or handle primary key omission
    if (!isEdit) {
      delete payload.id; // Let Supabase auto-increment generate BigInt
      if (activeTable === "proyectos") {
        payload.creado_en = new Date().toISOString();
      }
      if (activeTable === "llamados") {
        payload.creado_en = new Date().toISOString();
      }
      if (activeTable === "locaciones") {
        payload.created_at = new Date().toISOString();
      }
    } else {
      // Must not send identity primary key 'id' in updates to prevent:
      // column "id" can only be updated to DEFAULT
      delete payload.id;
    }

    try {
      let responseError;
      if (isEdit) {
        const { error } = await supabase
          .from(activeTable)
          .update(payload)
          .eq("id", values.id);
        responseError = error;
      } else {
        const { error } = await supabase
          .from(activeTable)
          .insert([payload]);
        responseError = error;
      }

      if (responseError) {
        throw new Error(responseError.message);
      }

      setNotification({
        text: `Registro ${isEdit ? "actualizado" : "creado"} correctamente en '${activeTable}'.`,
        mode: "success",
      });

      // Reload lookups (since we might have created a new parent element)
      loadLookupCaches();
      // Reload count indicators
      loadAllTableCounts();
      // Refresh current records list
      fetchCurrentTableData();
    } catch (err: any) {
      throw new Error(err.message || "Error escribiendo en la base de datos.");
    }
  };

  // Action: Delete row payload in Supabase
  const handleDeleteRow = async (id: number) => {
    try {
      // Find row details before we delete it to clean up references in storage if any
      const rowToDelete = tableData.find((row) => row.id === id);
      if (rowToDelete) {
        // Helper to extract storage path/filename from public URL
        const getFileNameFromUrl = (url: string) => {
          if (!url) return null;
          try {
            const marker = "/storage/v1/object/public/referencias/";
            const index = url.indexOf(marker);
            if (index !== -1) {
              return decodeURIComponent(url.slice(index + marker.length));
            }
            const parts = url.split("/");
            return decodeURIComponent(parts[parts.length - 1]);
          } catch {
            return null;
          }
        };

        const deleteFromStorage = async (url: string) => {
          const filename = getFileNameFromUrl(url);
          if (filename) {
            await supabase.storage.from("referencias").remove([filename]);
          }
        };

        if (activeTable === "proyectos") {
          if (rowToDelete.cliente) await deleteFromStorage(rowToDelete.cliente);
          if (rowToDelete.logo_productora) await deleteFromStorage(rowToDelete.logo_productora);
        } else if (activeTable === "shotlist") {
          const urlsStr = rowToDelete.referencia_urls || "";
          if (urlsStr) {
            const urls = urlsStr.split(",").map((s: string) => s.trim()).filter(Boolean);
            for (const url of urls) {
              await deleteFromStorage(url);
            }
          }
        }
      }

      const { error } = await supabase
        .from(activeTable)
        .delete()
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      setNotification({
        text: `Registro con ID #${id} eliminado con éxito de '${activeTable}'.`,
        mode: "success",
      });

      // Refresh listings and states
      loadAllTableCounts();
      loadLookupCaches();
      fetchCurrentTableData();
    } catch (err: any) {
      setNotification({
        text: `Error al borrar registro #${id} en '${activeTable}': ${err.message}`,
        mode: "error",
      });
    }
  };

  // Modal actions triggered from subcomponent list buttons
  const openAddFlow = () => {
    setSelectedRow(null);
    setIsModalOpen(true);
  };

  const openEditFlow = (row: any) => {
    setSelectedRow(row);
    setIsModalOpen(true);
  };

  // ───── GATE SCREEN: AUTHENTICATION LOGIN VIEW ─────
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
        <p className="text-neutral-400 font-sans text-sm animate-pulse">Conectando a bases de datos de LlamadoAPP...</p>
      </div>
    );
  }

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-neutral-200">
          
          <div className="text-center mb-8">
            <div className="inline-flex bg-neutral-950 p-3 rounded-2xl shadow-lg mb-4">
              <Video className="w-8 h-8 text-orange-500 animate-bounce" />
            </div>
            <h1 className="font-condensed font-black text-4xl text-neutral-800 tracking-tight leading-none uppercase">
              LlamadoApp inthependiente
            </h1>
            <p className="text-neutral-400 text-xs uppercase tracking-widest font-mono font-bold mt-1.5">Backend Admin System</p>
          </div>

          <div className="space-y-6">
            <div className="bg-amber-55/10 border border-amber-300/40 rounded-xl p-4 text-center">
              <span className="text-sm font-semibold text-neutral-800 block mb-1">🔐 Acceso Administrativo</span>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Este panel requiere autenticación para poder editar, crear y borrar registros de Hojas de Llamado, Proyectos y subir Referencias.
              </p>
            </div>

            <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  className="w-full border border-neutral-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden bg-neutral-50 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-neutral-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-neutral-800 focus:outline-hidden bg-neutral-50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-md hover:shadow-lg cursor-pointer"
              >
                {isLoggingIn ? "Iniciando sesión..." : "Iniciar Sesión"}
              </button>
            </form>
            
            {notification.text && (
              <div className="p-3.5 bg-red-50 text-red-600 rounded-lg text-xs break-words text-center border border-red-200">
                {notification.text}
              </div>
            )}
            
            <div className="text-center">
              <span className="text-[10px] text-neutral-400 font-mono">
                Desarrollado en entorno seguro • Conexión cifrada TLS
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ───── MAIN WORKSPACE VIEW ─────
  return (
    <div className="min-h-screen flex flex-col bg-neutral-100 text-neutral-800">
      
      {/* Dynamic Floating Toast Alerts */}
      {notification.text && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`flex items-center gap-3 p-4 rounded-xl shadow-2xl border text-sm max-w-sm font-semibold transition-all ${
            notification.mode === "success" 
              ? "bg-emerald-950 border-emerald-800 text-emerald-300"
              : "bg-red-950 border-red-800 text-red-300"
          }`}>
            {notification.mode === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <p className="line-clamp-2">{notification.text}</p>
          </div>
        </div>
      )}

      {/* Top Level Quick Action Dashboard Bar */}
      <header className="bg-neutral-900 text-white p-4 px-6 border-b border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-700/60 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold text-neutral-300">Nivel Admin: Total Control</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-neutral-800/50 px-3 py-1.5 rounded-lg text-xs text-neutral-400">
            <Globe className="w-3.5 h-3.5" />
            <span className="font-mono truncate max-w-xs">{sessionUser.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh current table button wrapper */}
          <button
            onClick={() => {
              fetchCurrentTableData();
              loadLookupCaches();
              loadAllTableCounts();
            }}
            disabled={isTableLoading}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/50 disabled:bg-neutral-800/20 text-neutral-300 disabled:text-neutral-500 rounded-lg transition-colors cursor-pointer flex items-center gap-2 text-xs"
            title="Refrescar datos locales"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isTableLoading ? "animate-spin text-orange-500" : ""}`} />
            <span className="hidden md:inline font-bold uppercase tracking-wider text-[10px]">Actualizar</span>
          </button>

          {/* User Signout Button */}
          <button
            onClick={handleLogout}
            className="bg-neutral-850 hover:bg-red-650 hover:text-white text-neutral-300 font-bold text-xs py-2 px-3 rounded-lg border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer"
            id="btn-logout"
            title="Cerrar sesión de administrador"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Primary Layout (Sidebar + Grid list content) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left tables indexer */}
        <Sidebar 
          activeTable={activeTable} 
          onTableChange={(table) => {
            setActiveTable(table);
          }}
          counts={tableCounts}
        />

        {/* Central rows management zone */}
        {isTableLoading && tableData.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-neutral-50/50">
            <Loader2 className="w-10 h-10 text-neutral-700 animate-spin mb-2" />
            <p className="text-sm text-neutral-500 font-semibold uppercase font-mono tracking-wider">Cargando colección de '{activeTable}'...</p>
          </div>
        ) : (
          <TableEditor
            table={activeTable}
            data={tableData}
            onAddClick={openAddFlow}
            onEditClick={openEditFlow}
            onDeleteClick={handleDeleteRow}
            onRefresh={fetchCurrentTableData}
            lookups={lookups}
          />
        )}

      </div>

      {/* Dynamic Creation / Editing Popover */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        table={activeTable}
        initialData={selectedRow}
        onSubmit={handleSaveRow}
        lookups={lookups}
      />

    </div>
  );
}
