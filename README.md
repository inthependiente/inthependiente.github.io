<div align="center">

</div>

# LlamadoAPP v1

Una app para generar hojas de llamado ajustada a mis necesidades específicas. 

## Design system

La UI sigue el estilo de Supabase: un único acento de marca, escala neutra, bordes de 1px
(*hairline*), radios compactos y tipografía Inter + Source Code Pro.

- **Acento**: verde emerald de Supabase `#3ECF8E` (`--brand`), con tinta oscura
  `--on-brand` para el texto sobre rellenos verdes.

- **Tokens** en `src/index.css`: `--canvas`, `--surface`, `--elevated`, `--subtle`,
  `--content*`, `--hairline*`, `--brand*`, `--success/warning/danger/info*`.
  Cada uno se expone como utilidad de Tailwind (`bg-surface`, `text-content-muted`,
  `border-hairline`, `bg-brand`, …).
- **Tema claro/oscuro**: se define con la clase `.dark` en `<html>`. La lógica de
  persistencia vive en `src/theme.ts` y el switch en `src/components/ThemeToggle.tsx`.
  `index.html` aplica el tema antes del primer paint para evitar parpadeo.
- **Regla**: usar siempre tokens semánticos en vez de colores de la paleta cruda
  (`bg-neutral-*`, `text-orange-*`, …) para que la UI funcione en ambos temas.

### Botones

Los botones usan clases de componente definidas en `src/index.css` (`@layer components`),
en vez de repetir cadenas de utilidades. Base: `.btn` (28px de alto, 13px, peso 500,
radio 8px, borde 1px). Los botones con borde NO llevan sombra: el borde 1px
(`--control-border`, alpha 0.135) es el único trazo. Solo el primario y el
destructivo llevan una sombra suave de una sola capa, y usan borde transparente. Tamaños: `.btn-xs` (22px), `.btn-sm` (28px), `.btn-lg` (36px),
`.btn-icon` y `.btn-block`.

| Clase | Uso |
|---|---|
| `.btn-primary` | acción principal de la vista (una sola por pantalla) |
| `.btn-secondary` | acción neutra con borde (por defecto) |
| `.btn-ghost` | acción terciaria o de icono |
| `.btn-danger` | acción destructiva atenuada (borde + tinte rojo al hover) |
| `.btn-warning` | acción de mantenimiento (reset de IDs) |
| `.btn-destructive` | confirmación destructiva con relleno sólido |

Ejemplo: `className="btn btn-sm btn-danger"`.
