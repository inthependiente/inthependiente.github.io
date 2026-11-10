/**
 * Detección de plataforma para elegir el mecanismo nativo de cada sistema.
 * iPadOS 13+ se identifica como MacIntel, por eso se mira también el táctil.
 */
export function esIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function esAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export type Plataforma = 'ios' | 'android' | 'escritorio';

export function plataformaActual(): Plataforma {
  if (esIOS()) return 'ios';
  if (esAndroid()) return 'android';
  return 'escritorio';
}

/**
 * En iOS todos los navegadores usan WebKit, pero solo Safari puede entregar un
 * archivo al sistema (Calendario, Contactos). Chrome, Brave, Firefox, Edge y
 * Opera lo descargan a su propio gestor. Cada uno se identifica en el UA;
 * Brave puede no hacerlo y entonces se comporta como Safari.
 */
export type NavegadorIOS = 'safari' | 'chrome' | 'firefox' | 'edge' | 'opera' | 'brave';

export function navegadorIOS(): NavegadorIOS | null {
  if (!esIOS()) return null;

  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome';
  if (/FxiOS/i.test(ua)) return 'firefox';
  if (/EdgiOS/i.test(ua)) return 'edge';
  if (/OPiOS/i.test(ua)) return 'opera';
  if (/Brave/i.test(ua)) return 'brave';
  return 'safari';
}

