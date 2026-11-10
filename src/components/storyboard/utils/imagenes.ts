/**
 * Preparación de imágenes antes de subirlas: limita el lado mayor y recomprime
 * para no acumular PNG de varios megas en el bucket.
 */

/** Lado mayor permitido; por encima se reduce con canvas. */
export const MAX_LADO_PX = 1600;
/** Los archivos que ya pesan menos que esto y caben en el límite se suben tal cual. */
const PESO_SIN_TOCAR_BYTES = 1_500_000;
const CALIDAD = 0.85;

const TIPOS_SOPORTADOS = ['image/png', 'image/jpeg', 'image/webp'];

export interface ImagenPreparada {
  /** Archivo listo para subir (puede ser el original). */
  archivo: File;
  /** Dimensiones originales. */
  original: { ancho: number; alto: number; bytes: number };
  /** Dimensiones y peso finales. */
  final: { ancho: number; alto: number; bytes: number };
  redimensionada: boolean;
}

/** Revisa si la imagen usa transparencia real (muestreando en pequeño). */
function tieneTransparencia(fuente: CanvasImageSource, ancho: number, alto: number): boolean {
  const muestra = 64;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.min(muestra, ancho));
  canvas.height = Math.max(1, Math.min(muestra, alto));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

function extensionDe(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/** Reemplaza la extensión del nombre por la del formato final. */
function conExtension(nombre: string, mime: string): string {
  const base = nombre.includes('.') ? nombre.slice(0, nombre.lastIndexOf('.')) : nombre;
  return `${base}.${extensionDe(mime)}`;
}

async function medir(file: File): Promise<{ bitmap: ImageBitmap | HTMLImageElement; ancho: number; alto: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { bitmap, ancho: bitmap.width, alto: bitmap.height };
  }

  const url = URL.createObjectURL(file);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No pudimos leer la imagen.'));
      el.src = url;
    });
    return { bitmap: imagen, ancho: imagen.naturalWidth, alto: imagen.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Reduce la imagen si supera `MAX_LADO_PX` o si pesa demasiado.
 *
 * Conserva PNG/JPEG/WEBP (para no perder transparencias ni cambiar la extensión
 * del archivo); cualquier otro formato se convierte a JPEG.
 */
export async function prepararImagen(file: File): Promise<ImagenPreparada> {
  const sinCambios: ImagenPreparada = {
    archivo: file,
    original: { ancho: 0, alto: 0, bytes: file.size },
    final: { ancho: 0, alto: 0, bytes: file.size },
    redimensionada: false,
  };

  if (!file.type.startsWith('image/')) return sinCambios;

  let medido: Awaited<ReturnType<typeof medir>>;
  try {
    medido = await medir(file);
  } catch {
    return sinCambios;
  }

  const { bitmap, ancho, alto } = medido;
  const base = {
    original: { ancho, alto, bytes: file.size },
    final: { ancho, alto, bytes: file.size },
    redimensionada: false,
  };

  const ladoMayor = Math.max(ancho, alto);
  const necesitaRedimension = ladoMayor > MAX_LADO_PX;
  const necesitaComprimir = file.size > PESO_SIN_TOCAR_BYTES;
  const formatoSoportado = TIPOS_SOPORTADOS.includes(file.type);

  if (!necesitaRedimension && !necesitaComprimir && formatoSoportado) {
    if ('close' in bitmap) bitmap.close();
    return { archivo: file, ...base };
  }

  const escala = necesitaRedimension ? MAX_LADO_PX / ladoMayor : 1;
  const destinoAncho = Math.max(1, Math.round(ancho * escala));
  const destinoAlto = Math.max(1, Math.round(alto * escala));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = destinoAncho;
    canvas.height = destinoAlto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { archivo: file, ...base };

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, destinoAncho, destinoAlto);

    // Las fotos y escaneos sin transparencia se guardan como JPEG (pesan mucho
    // menos); un PNG con alfa se mantiene PNG para no ennegrecer el fondo.
    const conservarPng =
      (file.type === 'image/png' || file.type === 'image/webp') &&
      tieneTransparencia(bitmap, destinoAncho, destinoAlto);
    const mimeSalida = conservarPng ? file.type : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeSalida, CALIDAD),
    );

    // Si el resultado no mejora (por ejemplo, un PNG ya optimizado), se sube el original.
    if (!blob || blob.size >= file.size) return { archivo: file, ...base };

    const archivo = new File([blob], conExtension(file.name, mimeSalida), {
      type: mimeSalida,
      lastModified: Date.now(),
    });

    return {
      archivo,
      original: base.original,
      final: { ancho: destinoAncho, alto: destinoAlto, bytes: blob.size },
      redimensionada: true,
    };
  } catch {
    return { archivo: file, ...base };
  } finally {
    if ('close' in bitmap) bitmap.close();
  }
}

/** "24,9 MB" — para el aviso de ahorro al subir. */
export function formatearPeso(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${bytes} B`;
}
