# Galilea Facturas

PWA para capturar facturas con foto o archivo, extraer datos automáticamente con la API de Claude, y guardarlos en Supabase.

## Stack

- **Frontend:** HTML/CSS/JS vanilla, sin frameworks
- **Base de datos e imágenes:** Supabase (tabla `facturas`, bucket `facturas-imagenes`)
- **IA:** API de Anthropic (Claude) vía proxy serverless en Vercel
- **Deploy:** Vercel (conectado al repositorio GitHub)

## Estructura de archivos

```
galilea-facturas/
├── index.html           → Login (clave única)
├── facturas.html        → Historial de facturas
├── nueva-factura.html   → Carga y extracción de nueva factura
├── css/estilos.css      → Estilos globales
├── js/config.js         → Credenciales de Supabase + clave de acceso
├── js/login.js          → Lógica de autenticación
├── js/facturas.js       → Listado, búsqueda y expansión de facturas
├── js/nueva-factura.js  → Flujo de imágenes → extracción → guardado
├── api/extraer-factura.js → Serverless function: proxy a Anthropic API
├── manifest.json        → Configuración PWA
├── sw.js                → Service Worker (cache offline)
└── CLAUDE.md            → Este archivo
```

## Variables de entorno

### En Vercel (panel de configuración del proyecto)

| Variable             | Descripción                          |
|----------------------|--------------------------------------|
| `ANTHROPIC_API_KEY`  | API key de Anthropic para Claude     |

### En `js/config.js` (hardcodeadas, no son secretos del servidor)

| Variable           | Descripción                           |
|--------------------|---------------------------------------|
| `SUPABASE_URL`     | URL del proyecto Supabase             |
| `SUPABASE_ANON_KEY`| Clave pública (anon) de Supabase      |
| `PALABRA_CLAVE`    | Clave de acceso a la app              |

## Base de datos (Supabase)

### Tabla `facturas`

| Campo               | Tipo          | Descripción                        |
|---------------------|---------------|------------------------------------|
| `id`                | uuid PK       | Identificador único                |
| `fecha_emision`     | date          | Fecha de la factura                |
| `numero_factura`    | text          | Número de comprobante              |
| `proveedor`         | text          | Nombre o razón social              |
| `cuit_proveedor`    | text          | CUIT del emisor                    |
| `concepto`          | text          | Descripción del servicio/producto  |
| `importe_total`     | numeric       | Importe total de la factura        |
| `cuit_destinatario` | text          | CUIT del receptor                  |
| `imagenes_url`      | text[]        | Array de URLs públicas de imágenes |
| `created_at`        | timestamptz   | Fecha de carga (automático)        |

### Storage

- Bucket: `facturas-imagenes` (público)
- Ruta de archivos: `facturas/{timestamp}-{random}.{ext}`

## Flujo de trabajo

### Después de cada cambio

1. Hacer commit con mensaje descriptivo en español:
   ```
   git add -p
   git commit -m "descripción del cambio"
   git push origin main
   ```
2. Verificar que el deploy en Vercel se completó sin errores usando el conector de Vercel.
3. Si hay errores de build, revisar los logs con el conector antes de continuar.

### Primera puesta en marcha

1. Crear proyecto en Vercel apuntando a este repositorio.
2. Agregar `ANTHROPIC_API_KEY` en las variables de entorno de Vercel.
3. Cambiar `PALABRA_CLAVE` en `js/config.js` por la clave real.
4. Verificar que el bucket `facturas-imagenes` en Supabase es público.
5. Verificar que la tabla `facturas` existe con el esquema indicado arriba.

## Notas importantes

- Todo el código y los comentarios están en español.
- La autenticación es simple (palabra clave en sessionStorage). No usar para datos sensibles sin reforzar la seguridad.
- El modelo de Claude usado es `claude-sonnet-4-20250514` (configurable en `api/extraer-factura.js`).
- Los PDFs se envían como base64 al igual que las imágenes; Claude los procesa igual.
