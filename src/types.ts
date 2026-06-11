export interface Proyectos {
  id?: number;
  campana: string;
  productora: string;
  logo_productora?: string;
  direccion_productora?: string;
  map_productora?: string;
  cliente: string;
  color_cliente?: string;
  color_campana?: string;
  creado_en?: string;
}

export interface Llamados {
  id?: number;
  proyecto_id: number;
  d_o_d?: string;
  fecha: string;
  llamado_hora?: string;
  ciudad_id?: number | null;
  desayuno?: string;
  almuerzo?: string;
  cena?: string;
  notas?: string;
  creado_en?: string;
}

export interface Locaciones {
  id?: number;
  locacion: string;
  direccion_loc?: string;
  url_loc?: string;
  centro_medico?: string;
  direccion_med?: string;
  url_med?: string;
  created_at?: string;
}

export interface Escenas {
  id?: number;
  llamado_id: number;
  orden: number;
  escena?: string;
  hora?: string;
  descripcion?: string;
  cast_nombres?: string;
  int_ext?: string;
  d_n?: string;
  locacion_id?: number | null;
}

export interface Crew {
  id?: number;
  orden?: number;
  departamento?: string;
  cargo?: string;
  nombre: string;
  notas?: string;
  celular?: string;
  llamado_hora?: string;
}

export interface CrewLlamado {
  id?: number;
  llamado_id: number;
  crew_id: number;
  orden?: number;
  prioridad?: number;
}

export interface ClienteAgencia {
  id?: number;
  llamado_id: number;
  tipo: string; // e.g. "Cliente", "Agencia"
  nombre: string;
  empresa?: string;
  horario_loc?: string;
}

export interface Talento {
  id?: number;
  llamado_id: number;
  orden?: number;
  nombre: string;
  rol?: string;
  llamado_hora?: string;
  locacion_id?: number | null;
  en_set?: string;
  notas?: string;
  w_status?: string;
}

export interface Pdr {
  id?: number;
  llamado_id: number;
  shotlist_id: number;
  orden: number;
  duracion_min?: number;
}

export interface Shotlist {
  id?: number;
  proyecto_id: number;
  orden: number;
  esc?: string;
  plano?: string;
  prep?: string;
  descripcion?: string;
  cast_ids?: string;
  cast_nombres?: string;
  locacion_id?: number | null;
  notas?: string;
  referencia_urls?: string; // Comma-separated URLs
}

export type DbTable =
  | "proyectos"
  | "llamados"
  | "locaciones"
  | "escenas"
  | "crew"
  | "crew_llamado"
  | "cliente_agencia"
  | "talento"
  | "pdr"
  | "shotlist";
