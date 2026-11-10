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

---

## App móvil (`/movil/`)

Webapp para el crew del llamado. Vive en este mismo repo y se compila en la misma build
de Vite (`movil/index.html` → `dist/movil/index.html`), reutilizando los tokens del
design system y el mismo cliente de Supabase.

### Links

| Link | Formato | Uso |
|---|---|---|
| Personal | `/movil/?c=<codigo>` | Recomendado. Identifica a la persona, registra su primer acceso y ata la confirmación a su nombre |
| Personal (largo) | `/movil/?id=<llamado_id>&t=<uuid>` | Formato anterior, se sigue aceptando para links ya enviados |
| General | `/movil/?id=<llamado_id>` | Navegación libre; al confirmar se elige el nombre de la lista del crew |

El **código personal** son 6 caracteres (`crew_invitaciones.codigo`) generados con un
alfabeto sin caracteres ambiguos (`0/O/1/I/L`), único y en mayúsculas; se acepta en
minúsculas y con espacios por si alguien lo transcribe a mano. Comparado con el UUID de 36
caracteres, el link pasa de ~90 a ~55 caracteres, no expone el id del llamado ni el token,
y es legible para dictarlo o imprimirlo. Cuando el link trae `c` se ignora cualquier `id`
que venga en la URL, para que un enlace manipulado no muestre otro llamado.

El ruteo interno es por hash (`#/llamado`, `#/pdr`, `#/locaciones`, `#/gente`,
`#/gente/talento`, `#/gente/crew/12`, `#/gente/talento/7`), así el botón atrás de Android
funciona sin configuración de servidor. Las rutas antiguas `#/crew/:id` y `#/talento/:id`
se siguen resolviendo a la sección Gente.

### Panel de invitaciones (admin)

El admin tiene una entrada **Invitaciones** en la barra lateral (sección «Comunicación»),
disponible solo con sesión iniciada. Trabaja sobre el llamado activo seleccionado en la tabla
de Llamados y muestra:

- Resumen: confirmados, abrieron sin confirmar, sin abrir y sin link, con barra de progreso.
- **Generar links**: crea el token y el código personal de cada persona del llamado que aún
  no los tenga (idempotente; avisa cuántos se crearon y nunca cambia los ya existentes).
- Por persona: estado (`Confirmado` / `Abrió` / `Pendiente` / `Sin link`) con la fecha y hora
  de cada evento, botón **Link** para copiar al portapapeles y **WhatsApp** con un mensaje
  prellenado por `src/lib/invitaciones.ts`:

  ```
  Hola (nombre), este es tu llamado para "CAMPAÑA"
  *Fecha:* DD/MM/AAAA
  *Hora:* HH:MM
  *Confirma aquí:* (link)
  ```

  Cada dato va en su propia línea y `Fecha:`, `Hora:` y `Confirma aquí:` llevan negrita
  (`*texto*`, la sintaxis de WhatsApp). Si falta la hora, la campaña o el link, esa línea se
  omite en vez de quedar con un valor vacío.
- **Exportar CSV** con una fila por persona (estado, fechas y link), con BOM UTF-8 para que
  Excel respete acentos y ñ.
- Campo editable con la **dirección de la app móvil** que se usa para armar los links
  (se guarda en `localStorage`), útil cuando el panel corre en local y los links deben apuntar
  al sitio publicado.

Todo pasa por las RPC `admin_generar_invitaciones(llamado)` y `admin_panel_invitaciones(llamado)`,
que exigen rol `authenticated`: la anon key no puede leer tokens ni respuestas.

> Importante: el link personal es la credencial de esa persona. No lo reenvíes a terceros.
> Si un link se filtra, borra su fila en `crew_invitaciones` y vuelve a generarlo.

### Geolocalización de locaciones

- Los links de Google Maps (`locaciones.url_loc`, `proyectos.map_productora`) se resuelven en
  la Edge Function **`resolver-mapa`** (`supabase/functions/resolver-mapa`), porque el navegador
  no puede seguir esos redirects por CORS. La función lee el header `Location` del 302
  (`!3d…!4d…`), cae a geocodificación por dirección (Nominatim) si el link no trae coordenadas y
  guarda el resultado en `locaciones.lat/lng` y `proyectos.lat/lng` (`coord_fuente`, `coord_actualizado_en`),
  así que se resuelve una sola vez por punto.
- La app invoca la función solo cuando faltan coordenadas. Si un punto queda sin ubicar, la
  lista lo marca como «Sin ubicación en el mapa» y el detalle ofrece el link original de Google Maps.
- Corrección manual: los formularios de **Proyectos** y **Locaciones** del panel tienen campos
  *Latitud* / *Longitud*; editarlos sobrescribe el valor resuelto.
- Desplegar con `supabase functions deploy resolver-mapa` (requiere JWT: la app la llama con la
  anon key). Rutas con **OSRM** público, cacheadas 10 minutos; si OSRM no responde se dibuja la
  línea recta punteada marcada como «estimado» y siempre queda el botón *Abrir ruta*, que abre
  Apple Maps en iOS y Google Maps en Android con el origen ya cargado.

### Base de datos

Aplicar `supabase/migrations/20261109120000_movil_llamados.sql`,
`supabase/migrations/20261109150000_locaciones_coordenadas.sql`,
`supabase/migrations/20261109170000_admin_panel_invitaciones.sql`,
`supabase/migrations/20261109171000_admin_panel_fix_orden.sql` y
`supabase/migrations/20261109190000_codigo_corto_invitaciones.sql`
(`supabase db push` o pegando los archivos en el SQL Editor del proyecto). Crea:

- `crew_invitaciones`: un token `uuid` y un `codigo` de 6 caracteres por persona y llamado
  (el código es la credencial corta que se usa en los links; única, con check de formato).
- RPC del panel: `admin_generar_invitaciones(llamado)` y `admin_panel_invitaciones(llamado)`,
  que parten de `crew_llamado` (no de las invitaciones) para no ocultar a quien aún no tiene token.
- `llamado_respuestas`: eventos `acceso` y `confirmacion` con fecha/hora, user-agent y
  plataforma (no se guarda IP). Índices únicos parciales: **un acceso histórico** y
  **una confirmación** por persona.
- RPC `movil_registrar_evento(evento, token, codigo)` y `movil_confirmar_por_nombre(llamado, crew)`
  para la app (ejecutables por `anon`), y `admin_generar_invitaciones(llamado)` /
  `admin_resumen_confirmaciones(llamado)` para el panel autenticado. `movil_registrar_evento`
  acepta `p_token` o `p_codigo` (el código tiene prioridad).

La migración de locaciones agrega `lat`, `lng`, `coord_fuente` y `coord_actualizado_en` a
`locaciones` y `proyectos` (nullable, con rango validado).

Las tablas quedan cerradas a `anon`: toda escritura pasa por las funciones
`SECURITY DEFINER`, que validan el token. Sin la migración aplicada la app funciona en
modo lectura y el botón Confirmar avisa que la confirmación aún no está habilitada.

### Secciones

- **Llamado**: cabecera con logos y colores de campaña, `lugar_llamado`, hora grande, fecha/D de D,
  clima de Open-Meteo, comidas, notas y la barra de confirmación.
- **Plan de rodaje**: cronograma calculado sumando `pdr.duracion_min` desde la hora de llamado
  (misma lógica que el PDF). Cada plano es una tarjeta con la hora, los distintivos `ESC` y
  `PLANO` (mismo estilo ambos), la descripción y, en una fila inferior a dos columnas, locación,
  cast con nombres y roles y notas a la izquierda (≈70 %) y la miniatura de la referencia a la
  derecha (≈30 %, sin título), que se amplía en un visor con zoom y swipe. La duración no se
  muestra por fila: la jornada va en el encabezado. Los planos `ES`/`ED` (desayuno, armado,
  almuerzo, company move, cierre) se muestran como franjas a ancho completo. El encabezado
  resume inicio, término, jornada y cantidad de planos y locaciones del día.
- **Locaciones**: mapa Leaflet + OpenStreetMap con los puntos del día (la productora marcada
  como `P` y las locaciones numeradas en orden de escenas) y lista con dirección, hora y centro
  médico cercano. Foto del comportamiento:
  - **Ruta**: solo desde el GPS del dispositivo, sin origen alternativo y sin botón para pedir
    la ubicación: se usa si el permiso ya estaba concedido. Sin ubicación se muestra el punto
    solo, el mapa hace zoom a su zona y no se dibuja ninguna ruta.
  - **Abrir ruta**: en iOS abre una hoja dentro de la app para elegir **Google Maps** o
    **Apple Maps**; en Android y escritorio va directo a Google Maps.
    - Google Maps usa una **Maps URL https** (`google.com/maps/dir/?api=1&…`), que iOS resuelve
      como Universal Link: abre la app si está instalada y si no, la versión web. El enlace se
      renderiza como `<a>`, porque Safari solo intercepta el Universal Link en un toque real del
      usuario, no en una navegación desde JavaScript.
    - Apple Maps usa `maps://`, el esquema de la app del sistema, que siempre está instalada y
      por eso nunca falla ni muestra diálogo.
    - **Por qué no hay fallback automático**: la web no tiene forma de saber si una app está
      instalada (`canOpenURL` es nativo). Probar un esquema propio como `comgooglemaps://` hace
      que iOS muestre su diálogo de error cuando la app falta, y ese diálogo no se puede
      suprimir ni detectar; cualquier respaldo posterior añade un segundo diálogo. Por eso se
      elige en la app, sin diálogos del sistema. Sin botón «Mapa» aparte: el punto ya está
      visible en el mapa.
  - **Al seleccionar**: el mapa crece de 42 % a 62 % de la altura y la lista se achica, para
    leer mejor la ruta. El detalle incluye siempre el centro médico más cercano con su enlace.
  - **Tamaño del mapa**: la única forma de alternar es el botón del detalle, que muestra
    `Maximize2` cuando la lista está a la vista y `Minimize2` cuando el mapa ocupa la pantalla.
    En modo grande, la **X** del detalle vuelve a la lista con el mapa pequeño.
- **Gente**: une Crew y Talento en una sección con dos pestañas en la parte superior (con el
  conteo de cada una) y usa el ícono de Crew. La pestaña activa vive en el hash, así el botón
  atrás vuelve a la pestaña correcta.
  - **Crew**: lista completa agrupada por departamento (orden canónico del llamado, tolerando
    diferencias de mayúsculas entre «Luces / grip» y «Luces / Grip»), con buscador por nombre o
    cargo y la hora de llamado a la derecha. Al abrir una persona se ven sus datos, su cargo y
    su departamento, y —si tiene teléfono— los botones **Llamar** (`tel:`), **WhatsApp**
    (`wa.me` con mensaje precargado) y **Guardar contacto** (vCard individual).
  - **Talento**: misma estructura en una sola lista en orden de personaje, con rol, locación,
    hora en set y estado (`w_status`). No muestra teléfono ni acciones de contacto, tal como se
    definió.
- **En vivo**: pestaña de la barra inferior visible pero deshabilitada (ícono y texto atenuados,
  `aria-disabled`, sin `href`), reservada para una fase posterior.

### Contactos

- Los teléfonos del crew vienen escritos a mano y traen espacios, guiones y marcas invisibles
  (`U+202C`). `src/movil/lib/contacto.ts` conserva solo los dígitos, acepta `+591…`, `591…`,
  `00591…` y el `0` inicial, y arma el formato internacional `+591XXXXXXXX`. Si tras normalizar
  no quedan 8 dígitos, la ficha avisa y **no** ofrece Llamar/WhatsApp en vez de marcar mal.
- La vCard usa `VERSION:3.0` con `N`, `FN`, `TITLE`, `CATEGORIES` y `TEL`, y
  pliega las líneas a 75 **octetos** (no caracteres), por lo que los acentos no rompen el
  archivo. No incluye la productora ni las notas del llamado (ni la hora de llamado que se
  guardaba en `NOTE`). El teléfono va con un único `TYPE=CELL`: repetir el parámetro
  (`TYPE=CELL;TYPE=VOICE`) es sintaxis de vCard 4.0 y en iOS produce una línea de teléfono
  extra vacía.
- **Guardar contacto siempre descarga el `.vcf`**, en todas las plataformas, con el atributo
  `download`: Safari en iOS **bloquea** la navegación de nivel superior a `data:`, así que un
  `data:text/vcard` falla en silencio. El archivo queda en Descargas y al abrirlo se importa a
  Contactos. Después de descargar, la ficha muestra un aviso con la instrucción para continuar
  («ábrelo desde la notificación de descarga» en Android, «desde tus descargas» en el resto).
- **Por qué no se abre el editor de Contactos directamente**: no es posible desde una página
  web. Chrome para Android inyecta `android.intent.category.BROWSABLE` en todo intent que abre
  un enlace (`ExternalNavigationHandler.sanitizeQueryIntentActivitiesIntent`, que además limpia
  `component` y `selector`), y el editor de Contactos declara solo `DEFAULT` para
  `ACTION_INSERT`; como las categorías del intent deben ser subconjunto de las del filtro, el
  intent nunca resuelve. Tampoco sirve `navigator.share` con el `.vcf` (Contacts no declara
  `ACTION_SEND`) ni la Contact Picker API (es de solo lectura). Solo un shell nativo
  (Capacitor/WebView) podría interceptar el intent y llamar `startActivity` sin esa inyección.

### Comportamiento

- **Acceso**: se registra la primera vez que se abre el link personal; las visitas
  siguientes no duplican el registro.
- **Confirmación**: idempotente. Sin señal queda en cola en `localStorage` y se envía
  automáticamente al recuperar conexión o al volver a abrir la app. La caché local se separa
  por token, para que en un mismo teléfono la confirmación de una persona no aparezca al abrir
  el link de otra.
- **Calendario**: `.ics` generado en el cliente (hora local, sin zona). El botón actúa directo,
  sin preguntar, y elige el camino según el navegador (`destinoCalendario()` en
  `src/movil/lib/calendar.ts`):
  - **iPhone/iPad, en cualquier navegador** → descarga el `.ics` (`download` sobre un blob).
    Safari lo entrega a Calendario y abre el evento; Chrome, Brave, Firefox, Edge y Opera lo
    guardan en su gestor de descargas y el usuario lo abre desde ahí. En iOS el botón nunca
    abre Google Calendar, a propósito.
  - **Android** → App Link de Google Calendar, que abre la app si está instalada y si no su
    versión web. Ahí el aviso ofrece además **Descargar .ics**, porque ese camino necesita
    cuenta de Google.
  - **Escritorio** → descarga el `.ics`.

  Motivo: iOS solo deja que **Safari** entregue un archivo al sistema. Los demás navegadores
  de iOS usan WKWebView y guardan el `.ics` en su propio gestor de descargas, sin forma de
  abrir Calendario desde código (`calshow:` abre la app pero no añade el evento, y `webcal:`
  requeriría un `.ics` alojado y crea una suscripción, no un evento). El aviso en pantalla
  cambia de texto según el navegador para explicar dónde quedó el archivo.

  Si el llamado no tiene fecha u hora el botón queda deshabilitado. El evento va desde la hora
  de llamado hasta el **cierre del Plan de Rodaje** (`timeline.cierre` en `src/movil/lib/pdr.ts`:
  fin de la última fila de cierre —«Cierre del Día», «Cierre de Claqueta», «Wrap»…— o, si no hay
  fila de cierre, el fin del plan). Solo si el plan está vacío o su cierre no es posterior al
  llamado se cae a la cena y, en último caso, a 12 h. El link que se comparte no incluye el token.
- **Caché**: la última copia del llamado (incluido crew y talento) se guarda en el dispositivo
  y se muestra si no hay red, con aviso visual.
- **Tema**: claro/oscuro según el sistema, con interruptor que recuerda la elección.

### Estructura

```
movil/index.html               entrada HTML (Vite multi-page)
src/movil/App.tsx              shell + ruteo por hash + bottom nav
src/movil/screens/             una pantalla por sección
src/movil/data/                carga del llamado, clima y confirmación
src/movil/lib/                 formato, ICS, params, almacenamiento, PDR, geo/rutas, contactos
```

Todas las secciones del menú están implementadas, junto con el panel de invitaciones del admin.
