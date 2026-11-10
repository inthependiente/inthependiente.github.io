export interface Ciudad {
  id: number;
  nombre: string;
  lat: number | null;
  long: number | null;
}

export interface Proyecto {
  id: number;
  campana: string | null;
  productora: string | null;
  logo_productora: string | null;
  direccion_productora: string | null;
  map_productora: string | null;
  cliente: string | null;
  color_cliente: string | null;
  color_campana: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Llamado {
  id: number;
  proyecto_id: number;
  d_o_d: string | null;
  fecha: string | null;
  llamado_hora: string | null;
  lugar_llamado: string | null;
  lluvia_c: string | null;
  ciudad_id: number | null;
  desayuno: string | null;
  almuerzo: string | null;
  cena: string | null;
  notas: string | null;
  proyectos: Proyecto | null;
  ciudades: Ciudad | null;
}

export interface Crew {
  id: number;
  nombre: string;
  cargo: string | null;
  departamento: string | null;
  celular: string | null;
  llamado_hora: string | null;
  notas: string | null;
}

export interface CrewLlamado {
  id: number;
  crew_id: number;
  orden: number | null;
  hora_llamado: string | null;
  notas: string | null;
  crew: Crew | null;
}

export interface Hospital {
  id: number;
  hospital: string;
  direccion_hosp: string | null;
  ubicacion_hosp: string | null;
}

export interface Locacion {
  id: number;
  locacion: string | null;
  direccion_loc: string | null;
  url_loc: string | null;
  lat: number | null;
  lng: number | null;
  hospitales: Hospital | null;
}

export interface Escena {
  id: number;
  orden: number | null;
  escena: string | null;
  hora: string | null;
  descripcion: string | null;
  cast_nombres: string | null;
  int_ext: string | null;
  d_n: string | null;
  locacion_id: number | null;
  locaciones: Locacion | null;
}

export interface Shotlist {
  id: number;
  esc: string | null;
  plano: string | null;
  descripcion: string | null;
  cast_ids: string | null;
  notas: string | null;
  referencia_urls: string | null;
  locacion_id: number | null;
  locaciones: Locacion | null;
}

export interface PdrRow {
  id: number;
  orden: number | null;
  duracion_min: number | null;
  status: boolean | null;
  inicio_reg: string | null;
  shotlist: Shotlist | null;
}

export interface Talento {
  id: number;
  id_personaje: number | null;
  nombre: string;
  rol: string | null;
  llamado_hora?: string | null;
  en_set?: string | null;
  notas?: string | null;
  w_status?: string | null;
  locacion_id?: number | null;
  locaciones?: Pick<Locacion, 'id' | 'locacion'> | null;
}

export interface LlamadoData {
  llamado: Llamado;
  crew: CrewLlamado[];
  escenas: Escena[];
  pdr: PdrRow[];
  talento: Talento[];
}

/** Persona identificada por su token personal o elegida de la lista. */
export interface Persona {
  crewId: number;
  nombre: string;
}
