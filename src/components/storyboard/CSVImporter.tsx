import { useRef } from 'react';
import Papa from 'papaparse';
import { FileSpreadsheet } from 'lucide-react';
import type { CsvRow } from './types';

interface Props {
  onImport: (rows: CsvRow[]) => void;
  onError: (mensaje: string) => void;
}

/** Lee un CSV de tres columnas (viñeta, descripción, locución) o de una sola columna. */
export default function CSVImporter({ onImport, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data;
        if (!rows || rows.length === 0) {
          onError('No se encontraron datos válidos en el archivo CSV.');
          return;
        }

        const primera = rows[0] ?? [];
        const esEncabezado = primera.some((cell) => {
          const texto = String(cell).toLowerCase();
          return (
            texto.includes('descripcion') ||
            texto.includes('descripción') ||
            texto.includes('locucion') ||
            texto.includes('locución') ||
            texto.includes('viñeta') ||
            texto.includes('audio') ||
            texto.includes('id') ||
            texto.includes('nombre')
          );
        });

        const importadas: CsvRow[] = [];

        for (let i = esEncabezado ? 1 : 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

          let filename = '';
          let description = '';
          let locution = '';

          if (row.length >= 3) {
            filename = String(row[0]).trim();
            description = String(row[1]).trim();
            locution = String(row[2]).trim();
          } else if (row.length === 2) {
            description = String(row[0]).trim();
            locution = String(row[1]).trim();
          } else {
            description = String(row[0]).trim();
          }

          if (filename || description || locution) {
            importadas.push({ filename, description, locution });
          }
        }

        if (importadas.length === 0) {
          onError('No se encontraron datos válidos en el archivo CSV.');
          return;
        }

        onImport(importadas);
      },
      error: (error) => onError(`No pudimos leer el CSV: ${error.message}`),
    });

    // Permite volver a cargar el mismo archivo.
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input type="file" ref={inputRef} onChange={handleFile} accept=".csv" className="hidden" />
      <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-sm btn-secondary">
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
        Importar texto (CSV)
      </button>
    </div>
  );
}
