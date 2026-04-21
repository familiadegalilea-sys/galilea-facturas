// Google Drive – subida de archivos de facturas
// Autenticación vía refresh token fijo (sin interacción del usuario).

const DRIVE_FOLDER_ID = '1igLVpGMsW4AdSD8o7Xo37T1_ZwaM1xBl';

let _accessToken = null;
let _tokenExpiry = 0;   // timestamp ms

/**
 * Obtiene (o reutiliza) un access token de Drive
 * llamando al proxy serverless /api/drive-token.
 */
async function driveGetToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) {
    return _accessToken;
  }

  const res  = await fetch('/api/drive-token', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${PALABRA_CLAVE}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error obteniendo token de Drive (${res.status})`);

  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

/**
 * Sube un archivo a Drive directamente en la carpeta de facturas.
 *
 * @param {File}   archivo
 * @param {string} nombreEnDrive  Nombre con el que se guardará en Drive
 */
async function driveSubirArchivoFactura(archivo, nombreEnDrive) {
  const token = await driveGetToken();

  const metadata = JSON.stringify({ name: nombreEnDrive, parents: [DRIVE_FOLDER_ID] });
  const form = new FormData();
  form.append('metadata', new Blob([metadata], { type: 'application/json' }));
  form.append('file', archivo);

  const res  = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Error subiendo archivo a Drive');

  return `https://drive.google.com/file/d/${data.id}/view`;
}

/**
 * Construye el nombre del archivo en Drive según las reglas del negocio:
 * [fecha_emision] - [proveedor] - [primeras 4 palabras del concepto].[ext]
 */
function driveConstruirNombre(archivo, fecha, proveedor, concepto) {
  const extension = archivo.name.split('.').pop() || 'bin';
  const primeras4 = concepto.trim()
    ? concepto.trim().split(/\s+/).slice(0, 4).join(' ')
    : '';
  const partes = [fecha, proveedor, primeras4].filter(p => p && p.trim());
  const base   = partes.length > 0 ? partes.join(' - ') : archivo.name;
  return `${base}.${extension}`;
}
