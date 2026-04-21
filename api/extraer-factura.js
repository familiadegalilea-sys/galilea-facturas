// Serverless function (Vercel) – Proxy hacia la API de Anthropic
// Recibe las imágenes en base64 y devuelve los datos de la factura en JSON

export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { imagenes } = req.body;

  if (!imagenes || !Array.isArray(imagenes) || imagenes.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una imagen' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key de Anthropic no configurada' });
  }

  // Construir los bloques de imagen para el mensaje de Claude
  const bloquesImagenes = imagenes.map(({ base64, mime_type }) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: mime_type,
      data: base64,
    },
  }));

  // Añadir el texto de instrucción al final
  const contenidoMensaje = [
    ...bloquesImagenes,
    {
      type: 'text',
      text: 'Extraé los datos de esta factura en el formato JSON indicado.',
    },
  ];

  const cuerpoSolicitud = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:
      "Sos un asistente especializado en leer facturas argentinas. Se te pueden enviar una o varias imágenes que corresponden a partes de la misma factura. Analizalas en conjunto y extraé SOLO estos campos en formato JSON: { fecha_emision: 'YYYY-MM-DD o null', numero_factura: 'string o null', proveedor: 'string o null', cuit_proveedor: 'string o null', concepto: 'string o null', importe_total: número o null, cuit_destinatario: 'string o null' }. Respondé ÚNICAMENTE con el JSON, sin texto adicional ni backticks.",
    messages: [
      {
        role: 'user',
        content: contenidoMensaje,
      },
    ],
  };

  try {
    const respuestaAnthropic = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(cuerpoSolicitud),
    });

    if (!respuestaAnthropic.ok) {
      const textoError = await respuestaAnthropic.text();
      return res.status(502).json({ error: `Error de Anthropic: ${textoError}` });
    }

    const respuestaJson = await respuestaAnthropic.json();
    const textoRespuesta = respuestaJson.content?.[0]?.text || '{}';

    // Parsear el JSON que devuelve Claude
    let datosFact;
    try {
      datosFact = JSON.parse(textoRespuesta);
    } catch {
      // Si Claude devuelve texto con backticks u otro formato, intentar limpiar
      const match = textoRespuesta.match(/\{[\s\S]*\}/);
      datosFact = match ? JSON.parse(match[0]) : {};
    }

    return res.status(200).json(datosFact);
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
}
