// Lógica para cargar, extraer y guardar una nueva factura

// Worker de PDF.js (misma versión que el CDN cargado en el HTML)
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  if (sessionStorage.getItem('autenticado') !== 'true') {
    window.location.replace('index.html');
    return;
  }

  // Configurar worker de PDF.js
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
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
  // Imagen: { file, tipo: 'imagen', dataUrl, base64, mime_type }
  // PDF:    { file, tipo: 'texto', contenido, nombre }
  let archivos = [];

  // --- Agregar archivos ---

  btnSubirArchivo.addEventListener('click', () => inputArchivo.click());
  btnTomarFoto.addEventListener('click', () => inputCamara.click());

  inputArchivo.addEventListener('change', (e) => procesarArchivos(e.target.files));
  inputCamara.addEventListener('change', (e) => procesarArchivos(e.target.files));

  async function procesarArchivos(files) {
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        await agregarPDF(file);
      } else {
        await agregarImagen(file);
      }
    }
    inputArchivo.value = '';
    inputCamara.value = '';
  }

  function agregarImagen(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const partes = dataUrl.split(',');
        const base64 = partes[1];
        const mime_type = partes[0].replace('data:', '').replace(';base64', '');

        archivos.push({ file, tipo: 'imagen', dataUrl, base64, mime_type });
        renderizarMiniaturas();
        actualizarBotonExtraer();
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  async function agregarPDF(file) {
    ocultarError();

    const arrayBuffer = await file.arrayBuffer();
    let texto = '';

    try {
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const pagina = await pdfDoc.getPage(i);
        const contenido = await pagina.getTextContent();
        const textoPagina = contenido.items.map((item) => item.str).join(' ');
        texto += textoPagina + '\n';
      }
    } catch (err) {
      mostrarError(`No se pudo leer el PDF: ${err.message}`);
      return;
    }

    // PDF sin texto seleccionable (escaneado)
    if (!texto.trim()) {
      mostrarError('Este PDF no tiene texto extraíble. Sacá una foto o captura de pantalla.');
      return;
    }

    archivos.push({ file, tipo: 'texto', contenido: texto.trim(), nombre: file.name });
    renderizarMiniaturas();
    actualizarBotonExtraer();
  }

  function renderizarMiniaturas() {
    filasMiniaturas.innerHTML = '';
    archivos.forEach((entrada, indice) => {
      const contenedor = document.createElement('div');
      contenedor.className = 'miniatura-previa';

      if (entrada.tipo === 'imagen') {
        const img = document.createElement('img');
        img.src = entrada.dataUrl;
        img.alt = `Imagen ${indice + 1}`;
        contenedor.appendChild(img);
      } else {
        // Ícono de PDF
        const icono = document.createElement('div');
        icono.className = 'miniatura-pdf';
        icono.innerHTML = '📄';
        const etiqueta = document.createElement('span');
        etiqueta.className = 'miniatura-pdf-nombre';
        etiqueta.textContent = entrada.nombre;
        icono.appendChild(etiqueta);
        contenedor.appendChild(icono);
      }

      const btnEliminar = document.createElement('button');
      btnEliminar.className = 'btn-eliminar-miniatura';
      btnEliminar.textContent = '✕';
      btnEliminar.title = 'Eliminar';
      btnEliminar.addEventListener('click', () => {
        archivos.splice(indice, 1);
        renderizarMiniaturas();
        actualizarBotonExtraer();
      });

      contenedor.appendChild(btnEliminar);
      filasMiniaturas.appendChild(contenedor);
    });
  }

  function actualizarBotonExtraer() {
    btnExtraer.style.display = archivos.length > 0 ? 'block' : 'none';
  }

  // --- Extraer datos con Claude ---

  btnExtraer.addEventListener('click', async () => {
    if (archivos.length === 0) return;

    ocultarError();
    mostrarSpinner(true);
    seccionFormulario.style.display = 'none';

    try {
      const payload = {
        contenidos: archivos.map((entrada) => {
          if (entrada.tipo === 'imagen') {
            return { tipo: 'imagen', base64: entrada.base64, mime_type: entrada.mime_type };
          } else {
            return { tipo: 'texto', contenido: entrada.contenido };
          }
        }),
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
      const urlsArchivos = await subirArchivos();

      const { error } = await supabase.from('facturas').insert({
        fecha_emision: campoFecha.value || null,
        numero_factura: campoNumero.value || null,
        proveedor: campoProveedor.value || null,
        cuit_proveedor: campoCuitProveedor.value || null,
        concepto: campoConcepto.value || null,
        importe_total: campoImporte.value ? parseFloat(campoImporte.value) : null,
        cuit_destinatario: campoCuitDestinatario.value || null,
        imagenes_url: urlsArchivos,
      });

      if (error) throw new Error(error.message);

      window.location.replace('facturas.html');
    } catch (err) {
      mostrarError(`No se pudo guardar: ${err.message}`);
      btnGuardar.disabled = false;
      btnGuardar.textContent = '💾 Guardar factura';
    }
  });

  async function subirArchivos() {
    const urls = [];

    for (const entrada of archivos) {
      const extension = entrada.file.name.split('.').pop() || 'bin';
      const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const ruta = `facturas/${nombreArchivo}`;

      const { error } = await supabase.storage
        .from('facturas-imagenes')
        .upload(ruta, entrada.file, { contentType: entrada.file.type });

      if (error) throw new Error(`Error al subir archivo: ${error.message}`);

      const { data: urlData } = supabase.storage
        .from('facturas-imagenes')
        .getPublicUrl(ruta);

      urls.push(urlData.publicUrl);
    }

    return urls;
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
