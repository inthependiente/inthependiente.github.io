import React from "react";
import { DbTable } from "../types";
import { 
  FolderKanban, 
  PhoneCall, 
  MapPin, 
  Film, 
  Users, 
  Link2, 
  Building2, 
  Theater, 
  Timer, 
  Camera,
  Layers,
  Database
} from "lucide-react";

interface SidebarProps {
  activeTable: DbTable;
  onTableChange: (table: DbTable) => void;
  counts: Record<DbTable, number>;
}

export default function Sidebar({ activeTable, onTableChange, counts }: SidebarProps) {
  
  const tablesInfo: { value: DbTable; label: string; description: string; icon: React.ComponentType<any>; color: string }[] = [
    {
      value: "proyectos",
      label: "Proyectos",
      description: "Campañas y productora",
      icon: FolderKanban,
      color: "bg-amber-50 text-amber-600 border-amber-200",
    },
    {
      value: "llamados",
      label: "Llamados",
      description: "Hojas de llamado y fechas",
      icon: PhoneCall,
      color: "bg-blue-50 text-blue-600 border-blue-200",
    },
    {
      value: "locaciones",
      label: "Locaciones",
      description: "Sets de grabación",
      icon: MapPin,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    {
      value: "escenas",
      label: "Escenas",
      description: "Escenas por orden de rodaje",
      icon: Film,
      color: "bg-indigo-50 text-indigo-600 border-indigo-200",
    },
    {
      value: "crew",
      label: "Crew",
      description: "Base de datos del equipo técnico",
      icon: Users,
      color: "bg-purple-50 text-purple-600 border-purple-200",
    },
    {
      value: "crew_llamado",
      label: "Asignación Crew",
      description: "Vínculo de equipo a llamados",
      icon: Link2,
      color: "bg-neutral-50 text-neutral-600 border-neutral-200",
    },
    {
      value: "cliente_agencia",
      label: "Cliente / Agencia",
      description: "Supervisión y horarios de set",
      icon: Building2,
      color: "bg-rose-50 text-rose-600 border-rose-200",
    },
    {
      value: "talento",
      label: "Talento",
      description: "Reparto en set",
      icon: Theater,
      color: "bg-violet-50 text-violet-600 border-violet-200",
    },
    {
      value: "pdr",
      label: "PDR (Rodaje)",
      description: "Plan de rodaje y tiempos",
      icon: Timer,
      color: "bg-cyan-50 text-cyan-600 border-cyan-200",
    },
    {
      value: "shotlist",
      label: "Shotlist",
      description: "Planos y storyboard",
      icon: Camera,
      color: "bg-pink-50 text-pink-600 border-pink-200",
    },
  ];

  return (
    <div className="w-full md:w-80 bg-white border-r border-neutral-200 flex flex-col h-full shrink-0">
      
      {/* Brand / Title Header */}
      <div className="p-6 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-neutral-900 text-white p-2 rounded-xl shadow-xs">
            <Layers className="w-6 h-6 text-orange-500 animate-pulse" />
          </div>
          <div>
            <h1 className="font-condensed font-black text-2xl tracking-tight text-neutral-800 uppercase leading-none">
              LlamadoAPP
            </h1>
            <span className="text-xs text-neutral-400 font-sans tracking-wide">Panel de Control Backend</span>
          </div>
        </div>
      </div>

      {/* Database Quick Health */}
      <div className="px-6 py-3 border-b border-neutral-100 bg-emerald-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-800">Conexión Supabase</span>
        </div>
        <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shadow-[0_0_8px_#10b981]"></span>
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <h2 className="text-xs font-bold text-neutral-400 uppercase px-3 mb-2 tracking-widest">
          Tablas de la Base de Datos
        </h2>
        {tablesInfo.map((table) => {
          const Icon = table.icon;
          const isActive = activeTable === table.value;
          const count = counts[table.value] || 0;
          
          return (
            <button
              key={table.value}
              onClick={() => onTableChange(table.value)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? "bg-neutral-900 border-neutral-900 text-white shadow-md shadow-neutral-900/10 scale-[1.01]"
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-200"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-lg shrink-0 border ${
                  isActive ? "bg-neutral-800 text-orange-400 border-neutral-700" : table.color
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">
                    {table.label}
                  </p>
                  <p className={`text-xs truncate ${isActive ? "text-neutral-400" : "text-neutral-400"}`}>
                    {table.description}
                  </p>
                </div>
              </div>
              
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ml-1.5 ${
                isActive 
                  ? "bg-neutral-800 text-orange-400 border border-neutral-700" 
                  : "bg-neutral-100 text-neutral-600"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Sidebar Footer */}
      <div className="p-4 border-t border-neutral-100 bg-neutral-50 text-center">
        <p className="text-[11px] text-neutral-400 font-mono">
          © {new Date().getFullYear()} LlamadoAPP • Admin 1.0.0
        </p>
      </div>

    </div>
  );
}
