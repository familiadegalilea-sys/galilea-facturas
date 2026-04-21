// Serverless function (Vercel) – Proxy hacia la API de Anthropic
// Recibe imágenes (base64) y/o texto extraído de PDFs, devuelve datos de la factura en JSON

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { contenidos } = req.body;

  if (!contenidos || !Array.isArray(contenidos) || contenidos.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos una imagen o PDF' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key de Anthropic no configurada' });
  }

  // Construir los bloques del mensaje según el tipo de cada contenido
  const bloques = contenidos.map((item) => {
    if (item.tipo === 'imagen') {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: item.mime_type,
          data: item.base64,
        },
      };
    } else {
      // tipo === 'texto' (PDF con texto extraído)
      return {
        type: 'text',
        text: `Texto extraído del PDF:\n\n${item.contenido}`,
      };
    }
  });

  // Instrucción final
  bloques.push({
    type: 'text',
    text: 'Extraé los datos de esta factura en el formato JSON indicado.',
  });

  const cuerpoSolicitud = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system:
      "Sos un asistente especializado en leer facturas argentinas. Se te pueden enviar una o varias imágenes que corresponden a partes de la misma factura, o texto extraído de un PDF. Analizalos en conjunto y extraé SOLO estos campos en formato JSON: { fecha_emision: 'YYYY-MM-DD o null', numero_factura: 'string o null', proveedor: 'string o null', cuit_proveedor: 'string o null', concepto: 'string o null', importe_total: número o null, cuit_destinatario: 'string o null' }. Respondé ÚNICAMENTE con el JSON, sin texto adicional ni backticks.",
    messages: [
      {
        role: 'user',
        content: bloques,
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

    let datosFact;
    try {
      datosFact = JSON.parse(textoRespuesta);
    } catch {
      const match = textoRespuesta.match(/\{[\s\S]*\}/);
      datosFact = match ? JSON.parse(match[0]) : {};
    }

    return res.status(200).json(datosFact);
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
}
