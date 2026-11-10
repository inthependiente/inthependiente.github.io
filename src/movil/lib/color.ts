/**
 * Devuelve un color de texto legible (#0b1f16 o #ffffff) para un fondo dado.
 * Los colores de campaña vienen del panel admin y pueden ser cualquier hex.
 */
export function inkSobre(color?: string | null): string {
  const hex = color?.trim();
  if (!hex) return 'var(--content)';

  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return 'var(--content)';

  const valor = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  const r = Number.parseInt(valor.slice(0, 2), 16);
  const g = Number.parseInt(valor.slice(2, 4), 16);
  const b = Number.parseInt(valor.slice(4, 6), 16);

  if ([r, g, b].some((n) => Number.isNaN(n))) return 'var(--content)';

  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.62 ? '#0b1f16' : '#ffffff';
}

export function colorSeguro(color?: string | null): string | undefined {
  if (!color) return undefined;
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim()) ? color.trim() : undefined;
}
