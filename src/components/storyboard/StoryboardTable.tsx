import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, PlusCircle, RefreshCw, Trash2 } from 'lucide-react';
import type { StoryboardPanel } from './types';

interface Props {
  panels: StoryboardPanel[];
  locutions: string[];
  onUpdatePanel: (index: number, panel: StoryboardPanel) => void;
  onUpdateLocution: (index: number, value: string) => void;
  onDeletePanel: (index: number) => void;
  onMovePanel: (from: number, to: number) => void;
  onAddPanel: (index: number) => void;
  onReplaceImage: (index: number, file: File) => void;
}

export default function StoryboardTable({
  panels,
  locutions,
  onUpdatePanel,
  onUpdateLocution,
  onDeletePanel,
  onMovePanel,
  onAddPanel,
  onReplaceImage,
}: Props) {
  const [insertPos, setInsertPos] = useState(0);
  const selectorRef = useRef<HTMLSelectElement>(null);
  const imagenesRef = useRef<HTMLInputElement>(null);
  const indiceReemplazo = useRef<number | null>(null);

  // La posición de inserción por defecto es el final de la lista.
  useEffect(() => {
    setInsertPos(panels.length);
  }, [panels.length]);

  const pedirReemplazo = (index: number) => {
    indiceReemplazo.current = index;
    imagenesRef.current?.click();
  };

  const alElegirImagen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const index = indiceReemplazo.current;
    if (file && index !== null) onReplaceImage(index, file);
    indiceReemplazo.current = null;
    if (imagenesRef.current) imagenesRef.current.value = '';
  };

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <input
        ref={imagenesRef}
        type="file"
        accept="image/*"
        onChange={alElegirImagen}
        className="hidden"
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline bg-thead text-[10px] font-semibold uppercase tracking-[0.12em] text-thead-content">
              <th className="w-14 px-3 py-2.5 text-center">#</th>
              <th className="w-44 px-3 py-2.5">Viñeta</th>
              <th className="px-3 py-2.5">Locución / audio</th>
              <th className="w-40 px-3 py-2.5 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {panels.map((panel, index) => (
              <tr key={panel.id || index} className="align-top transition-colors hover:bg-hover">
                <td className="px-3 py-3 text-center font-mono text-[11px] text-content-subtle">
                  {index + 1}
                </td>

                <td className="px-3 py-3">
                  <div className="flex flex-col gap-2">
                    <div className="group relative flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-subtle">
                      {panel.image_url ? (
                        <img
                          src={`${panel.image_url}?v=${panel.version ?? 0}`}
                          alt={panel.filename}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] italic text-content-subtle">Sin dibujo</span>
                      )}

                      <button
                        type="button"
                        onClick={() => pedirReemplazo(index)}
                        className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reemplazar
                      </button>
                    </div>

                    <input
                      type="text"
                      value={panel.filename || ''}
                      onChange={(e) => onUpdatePanel(index, { ...panel, filename: e.target.value })}
                      placeholder="Nombre plano"
                      aria-label={`Nombre de la viñeta ${index + 1}`}
                      className="w-32 rounded-md border border-hairline-strong bg-surface px-2 py-1 text-center font-mono text-[11px] font-semibold text-content placeholder-content-subtle focus:outline-hidden focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </td>

                <td className="px-3 py-3">
                  <textarea
                    value={locutions[index] || ''}
                    onChange={(e) => onUpdateLocution(index, e.target.value)}
                    placeholder="Diálogo, locución o efectos…"
                    aria-label={`Locución de la viñeta ${index + 1}`}
                    className="h-20 w-full min-w-52 resize-y rounded-lg border border-hairline-strong bg-surface p-2.5 text-[12px] leading-relaxed text-content placeholder-content-subtle transition-colors focus:outline-hidden focus:ring-2 focus:ring-brand"
                  />
                </td>

                <td className="px-3 py-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onMovePanel(index, index - 1)}
                        title="Subir viñeta"
                        aria-label={`Subir viñeta ${index + 1}`}
                        className="btn btn-xs btn-secondary"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === panels.length - 1}
                        onClick={() => onMovePanel(index, index + 1)}
                        title="Bajar viñeta"
                        aria-label={`Bajar viñeta ${index + 1}`}
                        className="btn btn-xs btn-secondary"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex w-full items-center gap-1 rounded-md border border-hairline-strong bg-surface px-1.5 py-0.5">
                      <ArrowUpDown className="h-3 w-3 shrink-0 text-content-subtle" />
                      <select
                        value={index}
                        onChange={(e) => onMovePanel(index, Number.parseInt(e.target.value, 10))}
                        aria-label={`Mover viñeta ${index + 1} a otra posición`}
                        className="w-full cursor-pointer border-none bg-transparent py-0.5 text-[11px] text-content-secondary outline-none"
                      >
                        {panels.map((_, posicion) => (
                          <option key={posicion} value={posicion}>
                            Posición {posicion + 1}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeletePanel(index)}
                      title="Eliminar viñeta"
                      aria-label={`Eliminar viñeta ${index + 1}`}
                      className="btn btn-xs btn-danger w-full"
                    >
                      <Trash2 className="h-3 w-3" />
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {panels.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center">
                  <p className="text-[13px] font-medium text-content">No hay viñetas en este storyboard.</p>
                  <p className="mt-1 text-[12px] text-content-muted">
                    Sube imágenes o importa un CSV para comenzar.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {panels.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-subtle px-3 py-2.5">
          <p className="text-[11px] text-content-muted">
            Total de viñetas: <span className="font-mono font-semibold text-content">{panels.length}</span>
          </p>

          <div className="flex items-center gap-2">
            <select
              ref={selectorRef}
              value={insertPos}
              onChange={(e) => setInsertPos(Number.parseInt(e.target.value, 10))}
              aria-label="Posición de la nueva viñeta"
              className="cursor-pointer rounded-md border border-hairline-strong bg-surface px-2 py-1 text-[11px] text-content-secondary focus:outline-hidden focus:ring-2 focus:ring-brand"
            >
              {Array.from({ length: panels.length + 1 }, (_, i) => (
                <option key={i} value={i}>
                  Posición {i + 1}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onAddPanel(insertPos)}
              className="btn btn-xs btn-primary"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Añadir aquí
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
