import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import BorrarStoryboardDialog, { type StoryboardAEliminar } from './BorrarStoryboardDialog';
import ConfirmDialog from './ConfirmDialog';
import CSVImporter from './CSVImporter';
import PresenterMode from './PresenterMode';
import StoryboardTable from './StoryboardTable';
import { formatearPeso, prepararImagen } from './utils/imagenes';
import type {
  CsvRow,
  LayoutPDF,
  ProyectoStoryboard,
  StoryboardPanel,
  StoryboardRecord,
  StoryboardSummary,
} from './types';

interface Props {
  selectedProjectId: number | null;
  onProjectChange: (id: number | null) => void;
  /** Proyectos del admin, para el selector. */
  proyectos: { id: number; campana: string | null }[];
  onNotify: (text: string, mode?: 'success' | 'error') => void;
  /** Cambia cuando el header del admin pulsa "Actualizar". */
  refreshToken: number;
}

const BUCKET = 'storyboards';
/** Espera antes de escribir en la base mientras se escribe en la tabla. */
const DEBOUNCE_GUARDADO_MS = 800;

const comparadorNatural = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Id de viñeta con UUID v4 del navegador (con respaldo para contextos no seguros). */
const idAleatorio = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const nombreDeArchivo = (file: File) =>
  file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

type Confirmacion = { tipo: 'panel'; index: number };

export default function StoryboardPanel({
  selectedProjectId,
  onProjectChange,
  proyectos,
  onNotify,
  refreshToken,
}: Props) {
  const [storyboards, setStoryboards] = useState<StoryboardSummary[]>([]);
  const [activo, setActivo] = useState<StoryboardRecord | null>(null);
  const [panels, setPanels] = useState<StoryboardPanel[]>([]);
  const [locutions, setLocutions] = useState<string[]>([]);
  const [nombre, setNombre] = useState('');
  const [projectInfo, setProjectInfo] = useState<ProyectoStoryboard | null>(null);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [presentando, setPresentando] = useState(false);
  const [pdfLayout, setPdfLayout] = useState<LayoutPDF>(6);
  const [creando, setCreando] = useState(false);
  const [exportando, setExportando] = useState<'pdf' | 'ppt' | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [aBorrar, setABorrar] = useState<StoryboardAEliminar | null>(null);

  const carpetaRef = useRef<HTMLInputElement>(null);
  const revisionRef = useRef<HTMLInputElement>(null);

  // Guardado con retardo: escribir en la tabla no debe disparar un update por tecla.
  const temporizador = useRef<number | null>(null);
  const pendiente = useRef<{
    id: number;
    name: string;
    panels: StoryboardPanel[];
    locutions: string[];
  } | null>(null);

  // `onNotify` cambia de identidad en cada render del admin: se guarda en un ref
  // para que los callbacks de guardado sigan siendo estables.
  const notificarRef = useRef(onNotify);
  useEffect(() => {
    notificarRef.current = onNotify;
  }, [onNotify]);

  const activoRef = useRef<StoryboardRecord | null>(null);
  useEffect(() => {
    activoRef.current = activo;
  }, [activo]);

  // Lock optimista: se guarda el `updated_at` conocido del storyboard abierto.
  const actualizadoEn = useRef<string | null>(null);
  // Las escrituras se encadenan para que dos guardados seguidos no se pisen.
  const colaEscritura = useRef<Promise<unknown>>(Promise.resolve());

  const escribir = useCallback(async (datos: NonNullable<typeof pendiente.current>) => {
    setGuardando(true);

    let consulta = supabase
      .from('storyboards')
      .update({ name: datos.name, panels: datos.panels, locutions: datos.locutions })
      .eq('id', datos.id);

    // Solo actualiza si nadie más escribió desde que se abrió el storyboard.
    if (actualizadoEn.current) consulta = consulta.eq('updated_at', actualizadoEn.current);

    const { data, error } = await consulta.select('updated_at').maybeSingle();
    setGuardando(false);

    if (error) {
      notificarRef.current(`No pudimos guardar el storyboard: ${error.message}`, 'error');
      return false;
    }

    if (!data) {
      notificarRef.current(
        'Otro usuario guardó cambios en este storyboard. Recargamos la versión más reciente.',
        'error',
      );
      const { data: fresco } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', datos.id)
        .maybeSingle();
      if (fresco) {
        const fila = fresco as StoryboardRecord;
        actualizadoEn.current = fila.updated_at ?? null;
        setActivo(fila);
        setPanels(fila.panels ?? []);
        setLocutions(fila.locutions ?? []);
        setNombre(fila.name);
      }
      return false;
    }

    actualizadoEn.current = (data as { updated_at: string }).updated_at;
    return true;
  }, []);

  const persistir = useCallback(
    (datos: NonNullable<typeof pendiente.current>) => {
      const tarea = colaEscritura.current.then(() => escribir(datos));
      colaEscritura.current = tarea.catch(() => undefined);
      return tarea;
    },
    [escribir],
  );

  const vaciarPendiente = useCallback(async () => {
    if (temporizador.current) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    const datos = pendiente.current;
    pendiente.current = null;
    if (datos) await persistir(datos);
  }, [persistir]);

  const programarGuardado = useCallback(
    (
      nuevosPanels: StoryboardPanel[],
      nuevasLocutions: string[],
      opciones: { name?: string; id?: number } = {},
    ) => {
      const id = opciones.id ?? activo?.id;
      if (!id) return;

      pendiente.current = {
        id,
        name: opciones.name ?? nombre,
        panels: nuevosPanels,
        locutions: nuevasLocutions,
      };

      if (temporizador.current) window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => {
        temporizador.current = null;
        const datos = pendiente.current;
        pendiente.current = null;
        if (datos) void persistir(datos);
      }, DEBOUNCE_GUARDADO_MS);
    },
    [activo?.id, nombre, persistir],
  );

  // Al desmontar o cambiar de storyboard, no perder lo último escrito.
  useEffect(() => {
    return () => {
      void vaciarPendiente();
    };
  }, [vaciarPendiente]);

  const cargarProyecto = useCallback(
    async (projectId: number) => {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, campana, color_cliente, color_campana')
        .eq('id', projectId)
        .single();

      if (error) {
        setProjectInfo(null);
        return;
      }
      setProjectInfo(data as ProyectoStoryboard);
    },
    [],
  );

  /** Lista liviana: sin `panels` ni `locutions`, solo el conteo que calcula Postgres. */
  const cargarStoryboards = useCallback(async (projectId: number, mantenerActivo = false) => {
    setCargando(true);
    const { data, error } = await supabase
      .from('storyboards')
      .select('id, name, created_at, updated_at, panel_count')
      .eq('proyecto_id', projectId)
      .order('created_at', { ascending: false });
    setCargando(false);

    if (error) {
      notificarRef.current(`No pudimos cargar los storyboards: ${error.message}`, 'error');
      return;
    }

    setStoryboards((data ?? []) as StoryboardSummary[]);

    if (mantenerActivo) {
      const idActivo = activoRef.current?.id;
      if (!idActivo) return;

      const { data: fresco, error: errorFresco } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', idActivo)
        .maybeSingle();

      if (errorFresco || !fresco) return;
      const fila = fresco as StoryboardRecord;
      actualizadoEn.current = fila.updated_at ?? null;
      setActivo(fila);
      setPanels(fila.panels ?? []);
      setLocutions(fila.locutions ?? []);
      setNombre(fila.name);
    }
  }, []);

  // Proyecto seleccionado en el admin → storyboards del proyecto.
  useEffect(() => {
    void vaciarPendiente();
    setActivo(null);
    setPanels([]);
    setLocutions([]);
    setNombre('');
    setPresentando(false);

    if (!selectedProjectId) {
      setStoryboards([]);
      setProjectInfo(null);
      return;
    }

    void cargarProyecto(selectedProjectId);
    void cargarStoryboards(selectedProjectId);
  }, [selectedProjectId, cargarProyecto, cargarStoryboards, vaciarPendiente]);

  // Botón "Actualizar" del header del admin. Se salta el montaje para no
  // duplicar la carga inicial, y espera a que se escriba lo pendiente.
  const primeraActualizacion = useRef(true);
  useEffect(() => {
    if (primeraActualizacion.current) {
      primeraActualizacion.current = false;
      return;
    }
    if (!selectedProjectId) return;

    let cancelado = false;
    void (async () => {
      await vaciarPendiente();
      if (!cancelado) await cargarStoryboards(selectedProjectId, true);
    })();

    return () => {
      cancelado = true;
    };
  }, [refreshToken, selectedProjectId, cargarStoryboards, vaciarPendiente]);

  /** Trae el storyboard completo (la lista ya no incluye los JSONB). */
  const abrirStoryboard = async (resumen: Pick<StoryboardSummary, 'id' | 'name'>) => {
    await vaciarPendiente();

    const { data, error } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', resumen.id)
      .maybeSingle();

    if (error || !data) {
      notificarRef.current(
        `No pudimos abrir el storyboard: ${error?.message ?? 'no existe'}`,
        'error',
      );
      return;
    }

    const fila = data as StoryboardRecord;
    actualizadoEn.current = fila.updated_at ?? null;
    setActivo(fila);
    setNombre(fila.name);
    setPanels(fila.panels ?? []);
    setLocutions(fila.locutions ?? []);
  };

  const cerrarStoryboard = async () => {
    await vaciarPendiente();
    setActivo(null);
    setPanels([]);
    setLocutions([]);
    setNombre('');
    if (selectedProjectId) await cargarStoryboards(selectedProjectId);
  };

  const crearStoryboard = async () => {
    if (!selectedProjectId || !nuevoNombre.trim()) return;

    setGuardando(true);
    const { data, error } = await supabase
      .from('storyboards')
      .insert([{ proyecto_id: selectedProjectId, name: nuevoNombre.trim(), panels: [], locutions: [] }])
      .select()
      .single();
    setGuardando(false);

    if (error) {
      onNotify(`No pudimos crear el storyboard: ${error.message}`, 'error');
      return;
    }

    const creado = data as StoryboardRecord;
    setNuevoNombre('');
    setCreando(false);
    setStoryboards((prev) => [
      {
        id: creado.id,
        name: creado.name,
        created_at: creado.created_at,
        updated_at: creado.updated_at,
        panel_count: creado.panel_count ?? 0,
      },
      ...prev,
    ]);
    void abrirStoryboard(creado);
    onNotify('Storyboard creado.', 'success');
  };

  /* ───────────── Imágenes ───────────── */

  /**
   * Sube una imagen ya preparada.
   * Si se reemplaza un dibujo y el formato final cambió (p. ej. AVIF → JPEG),
   * se escribe en una ruta nueva con la extensión correcta y se borra la vieja.
   */
  const subirArchivo = async (storyboardId: number, file: File, rutaExistente?: string) => {
    const extensionActual = rutaExistente?.split('.').pop()?.toLowerCase() ?? null;
    const extensionNueva = file.name.split('.').pop()?.toLowerCase() ?? null;
    const reutilizar = Boolean(rutaExistente) && extensionActual === extensionNueva;

    const filePath = reutilizar
      ? (rutaExistente as string)
      : `${storyboardId}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: '3600', contentType: file.type, upsert: true });
    if (error) throw error;

    if (rutaExistente && !reutilizar) {
      await supabase.storage.from(BUCKET).remove([rutaExistente]);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return { filePath, publicUrl: data.publicUrl };
  };

  const cargarCarpeta = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (carpetaRef.current) carpetaRef.current.value = '';
    if (!activo || files.length === 0) return;

    const imagenes = files.filter((file) => file.type.startsWith('image/'));
    if (imagenes.length === 0) {
      onNotify('No se encontraron imágenes válidas.', 'error');
      return;
    }

    setSubiendo(true);
    try {
      let bytesOriginales = 0;
      let bytesFinales = 0;
      let reducidas = 0;

      const subidas = await Promise.all(
        imagenes.map(async (original) => {
          const preparada = await prepararImagen(original);
          bytesOriginales += preparada.original.bytes;
          bytesFinales += preparada.final.bytes;
          if (preparada.redimensionada) reducidas += 1;

          const { filePath, publicUrl } = await subirArchivo(activo.id, preparada.archivo);
          return {
            id: idAleatorio(),
            filename: nombreDeArchivo(original),
            image_path: filePath,
            image_url: publicUrl,
            description: '',
            version: Date.now(),
          } satisfies StoryboardPanel;
        }),
      );

      const ordenadas = [...panels, ...subidas].sort((a, b) =>
        comparadorNatural(a.filename, b.filename),
      );

      const nuevasLocutions = [...locutions];
      while (nuevasLocutions.length < ordenadas.length) nuevasLocutions.push('');

      setPanels(ordenadas);
      setLocutions(nuevasLocutions);
      await vaciarPendiente();
      await persistir({
        id: activo.id,
        name: nombre,
        panels: ordenadas,
        locutions: nuevasLocutions,
      });
      const ahorro =
        reducidas > 0 && bytesOriginales > bytesFinales
          ? ` ${reducidas} optimizada${reducidas === 1 ? '' : 's'}: ${formatearPeso(bytesOriginales)} → ${formatearPeso(bytesFinales)}.`
          : '';
      onNotify(
        `${subidas.length} viñeta${subidas.length === 1 ? '' : 's'} agregada${subidas.length === 1 ? '' : 's'}.${ahorro}`,
        'success',
      );
    } catch (error) {
      onNotify(`Error al subir dibujos: ${(error as Error).message}`, 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const reemplazarImagen = async (index: number, file: File) => {
    const actual = panels[index];
    if (!activo || !actual) return;

    setSubiendo(true);
    try {
      const preparada = await prepararImagen(file);
      const { filePath, publicUrl } = await subirArchivo(
        activo.id,
        preparada.archivo,
        actual.image_path || undefined,
      );

      const actualizados = [...panels];
      actualizados[index] = {
        ...actual,
        image_path: filePath,
        image_url: publicUrl,
        version: Date.now(),
      };

      setPanels(actualizados);
      await vaciarPendiente();
      await persistir({ id: activo.id, name: nombre, panels: actualizados, locutions });
      onNotify('Dibujo reemplazado.', 'success');
    } catch (error) {
      onNotify(`Error al reemplazar el dibujo: ${(error as Error).message}`, 'error');
    } finally {
      setSubiendo(false);
    }
  };

  const actualizarRevisados = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (revisionRef.current) revisionRef.current.value = '';
    if (!activo || files.length === 0) return;

    setSubiendo(true);
    const actualizados = [...panels];
    let cantidad = 0;
    const fallidos: string[] = [];

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const nombreArchivo = nombreDeArchivo(file);
        const index = panels.findIndex(
          (panel) => panel.filename.toLowerCase() === nombreArchivo.toLowerCase(),
        );
        if (index === -1) continue;

        try {
          const preparada = await prepararImagen(file);
          const { filePath, publicUrl } = await subirArchivo(
            activo.id,
            preparada.archivo,
            panels[index].image_path || undefined,
          );

          actualizados[index] = {
            ...panels[index],
            image_path: filePath,
            image_url: publicUrl,
            version: Date.now(),
          };
          cantidad += 1;
        } catch (error) {
          fallidos.push(`${file.name}: ${(error as Error).message}`);
        }
      }

      if (cantidad > 0) {
        setPanels(actualizados);
        await vaciarPendiente();
        await persistir({ id: activo.id, name: nombre, panels: actualizados, locutions });
      }

      if (cantidad > 0 && fallidos.length === 0) {
        onNotify(`Se actualizaron ${cantidad} dibujo${cantidad === 1 ? '' : 's'}.`, 'success');
      } else if (cantidad > 0) {
        onNotify(`Se actualizaron ${cantidad} dibujos; fallaron ${fallidos.length}.`, 'error');
      } else if (fallidos.length > 0) {
        onNotify(`No se pudo actualizar ningún dibujo. ${fallidos[0]}`, 'error');
      } else {
        onNotify('No hay viñetas con esos nombres: revisa el nombre de los archivos.', 'error');
      }
    } finally {
      setSubiendo(false);
    }
  };

  /* ───────────── Edición de la tabla ───────────── */

  const actualizarPanel = (index: number, panel: StoryboardPanel) => {
    const actualizados = [...panels];
    actualizados[index] = panel;
    setPanels(actualizados);
    programarGuardado(actualizados, locutions);
  };

  const actualizarLocucion = (index: number, value: string) => {
    const nuevas = [...locutions];
    nuevas[index] = value;
    setLocutions(nuevas);
    programarGuardado(panels, nuevas);
  };

  const moverPanel = (from: number, to: number) => {
    if (to < 0 || to >= panels.length || from === to) return;
    const actualizados = [...panels];
    const [movido] = actualizados.splice(from, 1);
    actualizados.splice(to, 0, movido);
    // Las locuciones quedan atadas a su índice y no se mueven.
    setPanels(actualizados);
    programarGuardado(actualizados, locutions);
  };

  const agregarPanel = (index: number) => {
    const nuevo: StoryboardPanel = {
      id: idAleatorio(),
      filename: `Nueva_${panels.length + 1}`,
      image_path: '',
      image_url: '',
      description: '',
      version: Date.now(),
    };

    const actualizados = [...panels];
    actualizados.splice(index, 0, nuevo);

    const nuevasLocutions = [...locutions];
    while (nuevasLocutions.length < actualizados.length) nuevasLocutions.push('');

    setPanels(actualizados);
    setLocutions(nuevasLocutions);
    programarGuardado(actualizados, nuevasLocutions);
  };

  const eliminarPanel = async (index: number) => {
    if (!activo) return;
    const panel = panels[index];

    if (panel.image_path) {
      const { error } = await supabase.storage.from(BUCKET).remove([panel.image_path]);
      if (error) console.warn('No se pudo borrar el archivo del storage:', error.message);
    }

    const actualizados = panels.filter((_, i) => i !== index);
    const nuevasLocutions = [...locutions];
    if (nuevasLocutions.length > actualizados.length) nuevasLocutions.pop();

    setPanels(actualizados);
    setLocutions(nuevasLocutions);
    await vaciarPendiente();
    await persistir({ id: activo.id, name: nombre, panels: actualizados, locutions: nuevasLocutions });
  };

  const importarCSV = (rows: CsvRow[]) => {
    const actualizados = panels.map((panel) => ({ ...panel }));
    const nuevasLocutions = [...locutions];

    rows.forEach((row, i) => {
      if (row.filename) {
        const index = actualizados.findIndex(
          (panel) => panel.filename.toLowerCase() === row.filename.toLowerCase(),
        );
        if (index !== -1) {
          if (row.description) actualizados[index].description = row.description;
          if (row.locution) nuevasLocutions[index] = row.locution;
        }
        return;
      }

      if (i < actualizados.length) {
        if (row.description) actualizados[i].description = row.description;
        if (row.locution) nuevasLocutions[i] = row.locution;
      } else {
        nuevasLocutions[i] = row.locution || '';
      }
    });

    setPanels(actualizados);
    setLocutions(nuevasLocutions);
    programarGuardado(actualizados, nuevasLocutions);
    onNotify(`Se importaron ${rows.length} fila${rows.length === 1 ? '' : 's'} del CSV.`, 'success');
  };

  /* ───────────── Borrado y exportación ───────────── */

  /** Se llama solo cuando el diálogo ya borró archivos y ficha. */
  const alEliminarStoryboard = async (resumen: { archivos: number; bytes: number }) => {
    const eliminado = aBorrar;
    setABorrar(null);
    if (!eliminado) return;

    // No debe quedar ningún guardado pendiente apuntando a una fila que ya no existe.
    if (temporizador.current) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
    pendiente.current = null;
    actualizadoEn.current = null;

    if (activo?.id === eliminado.id) {
      setPresentando(false);
      setActivo(null);
      setPanels([]);
      setLocutions([]);
      setNombre('');
    }

    setStoryboards((prev) => prev.filter((sb) => sb.id !== eliminado.id));

    const detalle =
      resumen.archivos > 0
        ? ` ${resumen.archivos} archivo${resumen.archivos === 1 ? '' : 's'} borrado${resumen.archivos === 1 ? '' : 's'}.`
        : '';
    onNotify(`Storyboard eliminado.${detalle}`, 'success');

    if (selectedProjectId) await cargarStoryboards(selectedProjectId);
  };

  const guardarNombre = async () => {
    if (!activo || !nombre.trim() || nombre.trim() === activo.name) return;
    const limpio = nombre.trim();
    setActivo({ ...activo, name: limpio });
    setStoryboards((prev) => prev.map((sb) => (sb.id === activo.id ? { ...sb, name: limpio } : sb)));
    await vaciarPendiente();
    await persistir({ id: activo.id, name: limpio, panels, locutions });
  };

  const exportarPDF = async () => {
    if (!activo) return;
    setExportando('pdf');
    try {
      const { generateStoryboardPDF } = await import('./utils/pdfGenerator');
      await generateStoryboardPDF(nombre, panels, locutions, pdfLayout);
    } catch (error) {
      onNotify(`Error generando PDF: ${(error as Error).message}`, 'error');
    } finally {
      setExportando(null);
    }
  };

  const exportarPPT = async () => {
    if (!activo) return;
    setExportando('ppt');
    try {
      const { generateStoryboardPPT } = await import('./utils/pptGenerator');
      await generateStoryboardPPT(
        nombre,
        panels,
        locutions,
        pdfLayout,
        projectInfo?.color_cliente || '#E8580C',
      );
    } catch (error) {
      onNotify(`Error generando PPT: ${(error as Error).message}`, 'error');
    } finally {
      setExportando(null);
    }
  };

  const colorCliente = projectInfo?.color_cliente || '#3ecf8e';
  const colorCampana = projectInfo?.color_campana || '#8f8f8f';
  const proyectoActual = useMemo(
    () => proyectos.find((p) => Number(p.id) === Number(selectedProjectId)) ?? null,
    [proyectos, selectedProjectId],
  );

  if (presentando && activo) {
    return (
      <PresenterMode
        storyboardName={nombre}
        panels={panels}
        locutions={locutions}
        storyboards={storyboards}
        activeStoryboardId={activo.id}
        projectColors={{ color_cliente: colorCliente, color_campana: colorCampana }}
        onSwitchStoryboard={abrirStoryboard}
        onClose={() => setPresentando(false)}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-canvas p-4 md:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-content">Storyboard</h1>
            <p className="mt-0.5 text-[12px] text-content-muted">
              Viñetas, descripciones y locuciones por proyecto.
            </p>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-content-muted">
            Proyecto
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => {
                const valor = e.target.value;
                onProjectChange(valor ? Number.parseInt(valor, 10) : null);
              }}
              className="max-w-64 cursor-pointer rounded-lg border border-hairline-strong bg-surface px-2.5 py-1.5 text-[12px] text-content focus:outline-hidden focus:ring-2 focus:ring-brand"
            >
              <option value="">— Sin proyecto —</option>
              {proyectos.map((proyecto) => (
                <option key={proyecto.id} value={proyecto.id}>
                  {proyecto.campana || `Proyecto #${proyecto.id}`}
                </option>
              ))}
            </select>
          </label>
        </header>

        {!selectedProjectId ? (
          <EstadoVacio
            Icono={Folder}
            titulo="Selecciona un proyecto"
            detalle="Elige un proyecto arriba para ver y editar sus storyboards."
          />
        ) : activo ? (
          <>
            {/* Cabecera del editor */}
            <section className="mb-4 rounded-xl border border-hairline bg-surface p-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void cerrarStoryboard()}
                  className="btn btn-sm btn-secondary btn-icon"
                  title="Volver a la lista de storyboards"
                  aria-label="Volver a la lista de storyboards"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    onBlur={() => void guardarNombre()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    aria-label="Nombre del storyboard"
                    placeholder="Nombre del storyboard"
                    className="w-full max-w-md rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[14px] font-semibold text-content transition-colors hover:border-hairline focus:border-hairline-strong focus:outline-hidden focus:ring-2 focus:ring-brand"
                  />
                  <p className="px-1.5 text-[10px] font-mono text-content-subtle">
                    {(proyectoActual?.campana || `Proyecto #${selectedProjectId}`)} · {panels.length}{' '}
                    {panels.length === 1 ? 'viñeta' : 'viñetas'}
                    {guardando ? ' · guardando…' : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void vaciarPendiente()}
                    disabled={guardando}
                    className="btn btn-sm btn-secondary"
                  >
                    {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Guardar
                  </button>

                  <button type="button" onClick={() => setPresentando(true)} className="btn btn-sm btn-primary">
                    <Eye className="h-3.5 w-3.5" />
                    Vista rodaje
                  </button>

                  <div className="flex items-center gap-1.5">
                    <select
                      value={pdfLayout}
                      onChange={(e) => setPdfLayout(Number.parseInt(e.target.value, 10) as LayoutPDF)}
                      aria-label="Viñetas por página para la exportación"
                      className="cursor-pointer rounded-lg border border-hairline-strong bg-surface px-2 py-1.5 text-[11px] text-content-secondary focus:outline-hidden focus:ring-2 focus:ring-brand"
                    >
                      <option value={1}>1 x pág</option>
                      <option value={4}>4 x pág</option>
                      <option value={6}>6 x pág</option>
                      <option value={20}>20 x pág</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => void exportarPDF()}
                      disabled={exportando !== null}
                      className="btn btn-sm btn-secondary"
                    >
                      {exportando === 'pdf' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportarPPT()}
                      disabled={exportando !== null}
                      className="btn btn-sm btn-secondary"
                    >
                      {exportando === 'ppt' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      PPT
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setABorrar({ id: activo.id, name: nombre, panel_count: panels.length, panels })}
                    className="btn btn-sm btn-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar storyboard
                  </button>
                </div>
              </div>
            </section>

            {panels.length === 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-hairline-strong bg-surface px-5 py-9 text-center transition-colors hover:border-brand-border">
                  <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle text-brand-content">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="text-[13px] font-semibold text-content">Cargar carpeta de dibujos</span>
                  <span className="mt-1 max-w-xs text-[11px] leading-relaxed text-content-muted">
                    Sube las imágenes numeradas (1.jpg, 2.jpg, 1A.jpg): se ordenan alfabéticamente de
                    forma automática.
                  </span>
                  <span className="btn btn-sm btn-primary mt-3">Seleccionar imágenes</span>
                  <input
                    ref={carpetaRef}
                    type="file"
                    multiple
                    // @ts-expect-error atributos no estándar que Chrome y Safari sí soportan
                    webkitdirectory=""
                    directory=""
                    onChange={(e) => void cargarCarpeta(e)}
                    className="hidden"
                  />
                </label>

                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-hairline-strong bg-surface px-5 py-9 text-center">
                  <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-subtle text-content-muted">
                    <FileText className="h-5 w-5" />
                  </span>
                  <p className="text-[13px] font-semibold text-content">Cargar guión (CSV)</p>
                  <p className="mb-3 mt-1 max-w-xs text-[11px] leading-relaxed text-content-muted">
                    Importa descripciones y locuciones desde un CSV de tres columnas.
                  </p>
                  <CSVImporter onImport={importarCSV} onError={(mensaje) => onNotify(mensaje, 'error')} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Barra de herramientas */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-content-muted">Actualizar dibujos:</span>
                    <button
                      type="button"
                      onClick={() => revisionRef.current?.click()}
                      className="btn btn-xs btn-secondary"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Subir cambiados
                    </button>
                    <input
                      ref={revisionRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => void actualizarRevisados(e)}
                      className="hidden"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <CSVImporter onImport={importarCSV} onError={(mensaje) => onNotify(mensaje, 'error')} />
                    <button
                      type="button"
                      onClick={() => carpetaRef.current?.click()}
                      className="btn btn-xs btn-secondary"
                    >
                      <PlusCircle className="h-3 w-3" />
                      Añadir dibujos
                    </button>
                    <input
                      ref={carpetaRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => void cargarCarpeta(e)}
                      className="hidden"
                    />
                  </div>
                </div>

                {subiendo && (
                  <div className="flex items-center gap-2 rounded-lg border border-info-border bg-info-subtle px-3 py-2 text-[11px] text-info-content">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Subiendo imágenes…
                  </div>
                )}

                <StoryboardTable
                  panels={panels}
                  locutions={locutions}
                  onUpdatePanel={actualizarPanel}
                  onUpdateLocution={actualizarLocucion}
                  onDeletePanel={(index) => setConfirmacion({ tipo: 'panel', index })}
                  onMovePanel={moverPanel}
                  onAddPanel={agregarPanel}
                  onReplaceImage={(index, file) => void reemplazarImagen(index, file)}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-content-muted">
                {cargando
                  ? 'Cargando storyboards…'
                  : `${storyboards.length} storyboard${storyboards.length === 1 ? '' : 's'} en ${proyectoActual?.campana || `el proyecto #${selectedProjectId}`}`}
              </p>

              <button type="button" onClick={() => setCreando(true)} className="btn btn-sm btn-primary">
                <Plus className="h-3.5 w-3.5" />
                Nuevo storyboard
              </button>
            </div>

            {cargando ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface py-14 text-[12px] text-content-muted">
                <Loader2 className="h-4 w-4 animate-spin text-brand-content" />
                Cargando storyboards…
              </div>
            ) : storyboards.length === 0 ? (
              <EstadoVacio
                Icono={FolderOpen}
                titulo="Este proyecto no tiene storyboards"
                detalle="Crea el primero para empezar a cargar viñetas, descripciones y locuciones."
                accion={
                  <button type="button" onClick={() => setCreando(true)} className="btn btn-sm btn-primary">
                    <Plus className="h-3.5 w-3.5" />
                    Nuevo storyboard
                  </button>
                }
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {storyboards.map((sb) => (
                  <li
                    key={sb.id}
                    className="group relative flex flex-col rounded-xl border border-hairline bg-surface transition-colors hover:border-brand-border hover:bg-hover"
                  >
                    <button
                      type="button"
                      onClick={() => void abrirStoryboard(sb)}
                      className="flex flex-1 flex-col justify-between gap-2 p-3 pr-10 text-left"
                    >
                      <p className="min-w-0 truncate text-[13px] font-semibold text-content group-hover:text-brand-content">
                        {sb.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-content-subtle">
                        <span>{sb.panel_count ?? 0} viñetas</span>
                        {sb.created_at && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{new Date(sb.created_at).toLocaleDateString('es-CL')}</span>
                          </>
                        )}
                      </div>
                    </button>

                    <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1">
                      <ChevronRight className="h-4 w-4 text-content-subtle transition-opacity group-hover:opacity-0" />
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setABorrar({
                          id: sb.id,
                          name: sb.name,
                          panel_count: sb.panel_count ?? null,
                        })
                      }
                      title={`Borrar «${sb.name}» y sus dibujos`}
                      aria-label={`Borrar storyboard ${sb.name}`}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-content-subtle opacity-0 transition-opacity hover:bg-danger-subtle hover:text-danger-content focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {creando && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setCreando(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-sm rounded-xl border border-hairline bg-surface p-4 shadow-2xl">
            <h2 className="text-sm font-semibold text-content">Nuevo storyboard</h2>
            <p className="mt-1 text-[11px] text-content-muted">
              Nombre de la pieza audiovisual, por ejemplo «Spot principal 30s».
            </p>

            <input
              type="text"
              autoFocus
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void crearStoryboard();
              }}
              placeholder="Nombre del storyboard"
              className="mt-3 w-full rounded-lg border border-hairline-strong bg-surface px-2.5 py-2 text-[13px] text-content placeholder-content-subtle focus:outline-hidden focus:ring-2 focus:ring-brand"
            />

            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setCreando(false)} className="btn btn-sm btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void crearStoryboard()}
                disabled={guardando || !nuevoNombre.trim()}
                className="btn btn-sm btn-primary"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {aBorrar && (
        <BorrarStoryboardDialog
          storyboard={aBorrar}
          onClose={() => setABorrar(null)}
          onDeleted={(resumen) => void alEliminarStoryboard(resumen)}
          onNotify={onNotify}
        />
      )}

      {confirmacion?.tipo === 'panel' && (
        <ConfirmDialog
          titulo="Eliminar viñeta"
          mensaje={`Se borrará la viñeta «${panels[confirmacion.index]?.filename || `#${confirmacion.index + 1}`}» y su dibujo del almacenamiento.`}
          onConfirm={() => {
            const index = confirmacion.index;
            setConfirmacion(null);
            void eliminarPanel(index);
          }}
          onCancel={() => setConfirmacion(null)}
        />
      )}
    </div>
  );
}

function EstadoVacio({
  Icono,
  titulo,
  detalle,
  accion,
}: {
  Icono: React.ElementType;
  titulo: string;
  detalle: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-5 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-content-subtle">
        <Icono className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-[14px] font-semibold text-content">{titulo}</h2>
      <p className="mx-auto mt-1 max-w-70 text-[12px] leading-relaxed text-content-muted">{detalle}</p>
      {accion && <div className="mt-3 flex justify-center">{accion}</div>}
    </div>
  );
}
