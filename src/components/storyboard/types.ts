/** Contratos del panel de Storyboard. */

export interface StoryboardPanel {
  id: string;
  /** Nombre del plano; ordena alfanuméricamente al cargar una carpeta. */
  filename: string;
  image_path: string;
  image_url: string;
  description: string;
  /** Marca de tiempo para invalidar la caché de la imagen tras reemplazarla. */
  version?: number;
}

export interface StoryboardRecord {
  id: number;
  proyecto_id: number;
  name: string;
  panels: StoryboardPanel[] | null;
  locutions: string[] | null;
  created_at?: string;
  /** Se usa para detectar ediciones simultáneas (lock optimista). */
  updated_at?: string;
  /** Columna generada en Postgres: jsonb_array_length(panels). */
  panel_count?: number | null;
}

/** Fila de la lista: sin los JSONB, para no bajarlos de más. */
export interface StoryboardSummary {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  panel_count: number | null;
}

export interface ProyectoStoryboard {
  id: number;
  campana: string | null;
  color_cliente?: string | null;
  color_campana?: string | null;
}

/** Fila leída de un CSV: nombre de viñeta, descripción y locución. */
export interface CsvRow {
  filename: string;
  description: string;
  locution: string;
}

export type LayoutPDF = 1 | 4 | 6 | 20;
