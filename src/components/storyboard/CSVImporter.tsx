import { useRef } from 'react';
import Papa from 'papaparse';
import { FileSpreadsheet } from 'lucide-react';
import type { CsvRow } from './types';
import { parseCsvRows } from './utils/csvParser';

interface Props {
  onImport: (rows: CsvRow[]) => void;
  onError: (mensaje: string) => void;
}

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

        const importadas = parseCsvRows(rows);

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
