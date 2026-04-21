// Lógica para cargar, extraer y guardar una nueva factura

document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  if (sessionStorage.getItem('autenticado') !== 'true') {
    window.location.replace('index.html');
    return;
  }

  // --- Referencias al DOM ---
  const inputArchivo = document.getElementById('input-archivo');
  const inputCamara = document.getElementById('input-camara');
  const btnSubirArchivo = document.getElementById('btn-subir-archivo');
  const btnTomarFoto = document.getElementById('btn-tomar-foto');
  const filasMiniaturas = document.getElementById('filas-miniaturas');
  const btnExtraer = document.getElementById('btn-extraer');
  const seccionFormulario = document.getElementById('seccion-formulario');
  const spinner = document.getElementById('spinner');
  const btnGuardar = document.getElementById('btn-guardar');
  const mensajeError = document.getElementById('mensaje-error');

  // Campos del formulario
  const campoFecha = document.getElementById('fecha_emision');
  const campoNumero = document.getElementById('numero_factura');
  const campoProveedor = document.getElementById('proveedor');
  const campoCuitProveedor = document.getElementById('cuit_proveedor');
  const campoConcepto = document.getElementById('concepto');
  const campoImporte = document.getElementById('importe_total');
  const campoCuitDestinatario = document.getElementById('cuit_destinatario');

  // --- Estado interno ---
  // Cada entrada: { file: File, dataUrl: string, base64: string, mime_type: string }
  let imagenes = [];

  // --- Agregar imágenes ---

  btnSubirArchivo.addEventListener('click', () => inputArchivo.click());
  btnTomarFoto.addEventListener('click', () => inputCamara.click());

  inputArchivo.addEventListener('change', (e) => agregarArchivos(e.target.files));
  inputCamara.addEventListener('change', (e) => agregarArchivos(e.target.files));

  function agregarArchivos(files) {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        // dataUrl = "data:image/jpeg;base64,AAAA..."
        const partes = dataUrl.split(',');
        const meta = partes[0]; // "data:image/jpeg;base64"
        const base64 = partes[1];
        const mime_type = meta.replace('data:', '').replace(';base64', '');

        const entrada = { file, dataUrl, base64, mime_type };
        imagenes.push(entrada);
        renderizarMiniaturas();
        actualizarBotonExtraer();
      };
      reader.readAsDataURL(file);
    });
    // Resetear el input para permitir seleccionar el mismo archivo nuevamente
    inputArchivo.value = '';
    inputCamara.value = '';
  }

  function renderizarMiniaturas() {
    filasMiniaturas.innerHTML = '';
    imagenes.forEach((entrada, indice) => {
      const contenedor = document.createElement('div');
      contenedor.className = 'miniatura-previa';

      const img = document.createElement('img');
      img.src = entrada.dataUrl;
      img.alt = `Imagen ${indice + 1}`;

      const btnEliminar = document.createElement('button');
      btnEliminar.className = 'btn-eliminar-miniatura';
      btnEliminar.textContent = '✕';
      btnEliminar.title = 'Eliminar imagen';
      btnEliminar.addEventListener('click', () => {
        imagenes.splice(indice, 1);
        renderizarMiniaturas();
        actualizarBotonExtraer();
      });

      contenedor.appendChild(img);
      contenedor.appendChild(btnEliminar);
      filasMiniaturas.appendChild(contenedor);
    });
  }

  function actualizarBotonExtraer() {
    btnExtraer.style.display = imagenes.length > 0 ? 'block' : 'none';
  }

  // --- Extraer datos con Claude ---

  btnExtraer.addEventListener('click', async () => {
    if (imagenes.length === 0) return;

    ocultarError();
    mostrarSpinner(true);
    seccionFormulario.style.display = 'none';

    try {
      const payload = {
        imagenes: imagenes.map((img) => ({
          base64: img.base64,
          mime_type: img.mime_type,
        })),
      };

      const respuesta = await fetch('/api/extraer-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!respuesta.ok) {
        const textoError = await respuesta.text();
        throw new Error(`Error del servidor: ${textoError}`);
      }

      const datos = await respuesta.json();
      rellenarFormulario(datos);
      seccionFormulario.style.display = 'block';
    } catch (err) {
      mostrarError(`No se pudo extraer los datos: ${err.message}`);
    } finally {
      mostrarSpinner(false);
    }
  });

  function rellenarFormulario(datos) {
    if (datos.fecha_emision) campoFecha.value = datos.fecha_emision;
    if (datos.numero_factura) campoNumero.value = datos.numero_factura;
    if (datos.proveedor) campoProveedor.value = datos.proveedor;
    if (datos.cuit_proveedor) campoCuitProveedor.value = datos.cuit_proveedor;
    if (datos.concepto) campoConcepto.value = datos.concepto;
    if (datos.importe_total != null) campoImporte.value = datos.importe_total;
    if (datos.cuit_destinatario) campoCuitDestinatario.value = datos.cuit_destinatario;
  }

  // --- Guardar factura ---

  btnGuardar.addEventListener('click', async () => {
    ocultarError();
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
      // 1. Subir todas las imágenes al bucket de Supabase Storage
      const urlsImagenes = await subirImagenes();

      // 2. Guardar el registro en la tabla facturas
      const { error } = await supabase.from('facturas').insert({
        fecha_emision: campoFecha.value || null,
        numero_factura: campoNumero.value || null,
        proveedor: campoProveedor.value || null,
        cuit_proveedor: campoCuitProveedor.value || null,
        concepto: campoConcepto.value || null,
        importe_total: campoImporte.value ? parseFloat(campoImporte.value) : null,
        cuit_destinatario: campoCuitDestinatario.value || null,
        imagenes_url: urlsImagenes,
      });

      if (error) throw new Error(error.message);

      window.location.replace('facturas.html');
    } catch (err) {
      mostrarError(`No se pudo guardar: ${err.message}`);
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar';
    }
  });

  async function subirImagenes() {
    const urls = [];

    for (const entrada of imagenes) {
      const extension = entrada.mime_type.split('/')[1] || 'jpg';
      const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const ruta = `facturas/${nombreArchivo}`;

      // Convertir base64 a Blob para subir
      const blob = base64ABlob(entrada.base64, entrada.mime_type);

      const { error } = await supabase.storage
        .from('facturas-imagenes')
        .upload(ruta, blob, { contentType: entrada.mime_type });

      if (error) throw new Error(`Error al subir imagen: ${error.message}`);

      const { data: urlData } = supabase.storage
        .from('facturas-imagenes')
        .getPublicUrl(ruta);

      urls.push(urlData.publicUrl);
    }

    return urls;
  }

  function base64ABlob(base64, mimeType) {
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      buffer[i] = bytes.charCodeAt(i);
    }
    return new Blob([buffer], { type: mimeType });
  }

  // --- Utilidades de UI ---

  function mostrarSpinner(visible) {
    spinner.style.display = visible ? 'flex' : 'none';
  }

  function mostrarError(texto) {
    mensajeError.textContent = texto;
    mensajeError.style.display = 'block';
  }

  function ocultarError() {
    mensajeError.style.display = 'none';
  }
});
