// Proxy serverless – Access token para Google Drive
// Intercambia el refresh token fijo por un access token efímero.
// Valida el bearer token contra la variable de entorno FACTURAS_ACCESS_TOKEN.
// Variables de entorno necesarias en Vercel:
//   FACTURAS_ACCESS_TOKEN, DRIVE_REFRESH_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = authHeader.slice(7);

  const secretEsperado = process.env.FACTURAS_ACCESS_TOKEN;
  if (!secretEsperado || token !== secretEsperado) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const refreshToken = process.env.DRIVE_REFRESH_TOKEN;
  if (!refreshToken) return res.status(500).json({ error: 'DRIVE_REFRESH_TOKEN no configurado' });

  try {
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    });

    const oauthRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });
    const data = await oauthRes.json().catch(() => ({}));
    if (!oauthRes.ok) {
      throw new Error(`OAuth error ${oauthRes.status}: ${data.error} – ${data.error_description}`);
    }
    if (!data.access_token) throw new Error('OAuth: no se recibió access_token');

    return res.status(200).json({
      access_token: data.access_token,
      expires_in:   data.expires_in || 3600,
    });

  } catch (err) {
    console.error('[drive-token] ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
