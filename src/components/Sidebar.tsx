import React from "react";
import { DbTable } from "../types";
import { 
  Smartphone,
  HelpCircle,
  SquareChartGantt, 
  Calendar, 
  MapPin, 
  HeartPulse, 
  Clapperboard, 
  Users, 
  UserGroup, 
  Building2, 
  Theater, 
  Film, 
  Timer,
  Layers,
  Database
} from "lucide-react";

export type AdminView = "tablas" | "invitaciones";

interface SidebarProps {
  activeTable: DbTable;
  onTableChange: (table: DbTable) => void;
  counts: Record<DbTable, number>;
  activeView: AdminView;
  onViewChange: (view: AdminView) => void;
}

export default function Sidebar({
  activeTable,
  onTableChange,
  counts,
  activeView,
  onViewChange,
}: SidebarProps) {
  
  const tablesInfo: { value: DbTable; label: string; description: string; icon: React.ComponentType<any> }[] = [
    {
      value: "proyectos",
      label: "Proyectos",
      description: "Campañas y productora",
      icon: SquareChartGantt,
    },
    {
      value: "llamados",
      label: "Llamados",
      description: "Hojas de llamado y fechas",
      icon: Calendar,
    },
    {
      value: "locaciones",
      label: "Locaciones",
      description: "Sets de grabación",
      icon: MapPin,
    },
    {
      value: "hospitales",
      label: "Centros médicos",
      description: "Catálogo de centros médicos",
      icon: HeartPulse,
    },
    {
      value: "escenas",
      label: "Escenas",
      description: "Escenas por orden de rodaje",
      icon: Clapperboard,
    },
    {
      value: "crew",
      label: "Crew",
      description: "Base de datos del equipo técnico",
      icon: Users,
    },
    {
      value: "crew_llamado",
      label: "Crew llamado",
      description: "Vínculo de equipo a llamados",
      icon: UserGroup,
    },
    {
      value: "cliente_agencia",
      label: "Cliente / Agencia",
      description: "Supervisión y horarios de set",
      icon: Building2,
    },
    {
      value: "talento",
      label: "Talento",
      description: "Reparto en set",
      icon: Theater,
    },
    {
      value: "shotlist",
      label: "Shotlist",
      description: "Planos y storyboard",
      icon: Film,
    },
    {
      value: "pdr",
      label: "PDR (Rodaje)",
      description: "Plan de rodaje y tiempos",
      icon: Timer,
    },
  ];

  return (
    <div className="w-full md:w-72 bg-surface border-r border-hairline flex flex-col h-full shrink-0">
      
      {/* Brand / Title Header */}
      <div className="px-4 py-3.5 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-brand text-on-brand p-1.5 rounded-md btn-shadow">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm tracking-tight text-content leading-none truncate">
              LlamadoAPP
            </h1>
            <span className="text-[11px] text-content-subtle leading-none">Panel de Control Backend</span>
          </div>
        </div>
      </div>

      {/* Database Quick Health */}
      <div className="px-4 py-2 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-success" />
          <span className="text-[11px] font-medium text-content-muted">Conexión Supabase</span>
        </div>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping"></span>
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success"></span>
          </span>
        </span>
      </div>

      {/* Navigation list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <h2 className="text-[10px] font-medium text-content-subtle uppercase px-2.5 mb-1.5 tracking-[0.14em]">
          Comunicación
        </h2>

        <button
          type="button"
          onClick={() => onViewChange("invitaciones")}
          aria-current={activeView === "invitaciones" ? "page" : undefined}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md border text-left transition-colors duration-150 cursor-pointer group ${
            activeView === "invitaciones"
              ? "bg-brand-subtle border-brand-border text-brand-content"
              : "bg-transparent border-transparent text-content-secondary hover:bg-subtle hover:text-content"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Smartphone
              className={`w-4 h-4 shrink-0 ${
                activeView === "invitaciones"
                  ? "text-brand-content"
                  : "text-content-subtle group-hover:text-content-muted"
              }`}
            />
            <div className="min-w-0">
              <p
                className={`text-[13px] leading-tight truncate ${
                  activeView === "invitaciones" ? "font-medium" : "font-normal"
                }`}
              >
                Invitaciones
              </p>
              <p className="text-[11px] truncate text-content-subtle">Links, accesos y confirmaciones</p>
            </div>
          </div>
        </button>

        <h2 className="text-[10px] font-medium text-content-subtle uppercase px-2.5 mb-1.5 mt-3 tracking-[0.14em]">
          Tablas de la Base de Datos
        </h2>
        {tablesInfo.map((table) => {
          const Icon = table.icon;
          const isActive = activeView === "tablas" && activeTable === table.value;
          const count = counts[table.value] || 0;
          
          return (
            <button
              key={table.value}
              onClick={() => {
              onViewChange("tablas");
              onTableChange(table.value);
            }}
              aria-current={isActive && activeView === "tablas" ? "page" : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md border text-left transition-colors duration-150 cursor-pointer group ${
                isActive
                  ? "bg-brand-subtle border-brand-border text-brand-content"
                  : "bg-transparent border-transparent text-content-secondary hover:bg-subtle hover:text-content"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-brand-content" : "text-content-subtle group-hover:text-content-muted"
                  }`}
                />
                <div className="min-w-0">
                  <p className={`text-[13px] leading-tight truncate ${isActive ? "font-medium" : "font-normal"}`}>
                    {table.label}
                  </p>
                  <p className="text-[11px] truncate text-content-subtle">{table.description}</p>
                </div>
              </div>
              
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono tabular-nums shrink-0 ml-1.5 ${
                isActive 
                  ? "bg-brand text-on-brand font-medium" 
                  : "bg-subtle text-content-muted"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Sidebar Footer */}
      <div className="px-4 py-2.5 border-t border-hairline text-center">
        <p className="text-[10px] text-content-subtle font-mono">
          © {new Date().getFullYear()} LlamadoAPP • Admin 1.0.0
        </p>
      </div>

    </div>
  );
}
