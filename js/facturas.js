// Lógica del historial de facturas

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (sessionStorage.getItem('autenticado') !== 'true') {
    window.location.replace('index.html');
    return;
  }

  document.getElementById('btn-cerrar').addEventListener('click', () => {
    sessionStorage.removeItem('autenticado');
    window.location.replace('index.html');
  });

  const lista = document.getElementById('lista-facturas');
  const inputBusqueda = document.getElementById('busqueda');
  const inputDesde = document.getElementById('filtro-desde');
  const inputHasta = document.getElementById('filtro-hasta');
  const btnLimpiar = document.getElementById('btn-limpiar-filtros');
  const mensajeSinResultados = document.getElementById('sin-resultados');
  const btnDescargarExcel = document.getElementById('btn-descargar-excel');

  // Modal de eliminación
  const modalOverlay = document.getElementById('modal-overlay');
  const modalCancelar = document.getElementById('modal-cancelar');
  const modalConfirmar = document.getElementById('modal-confirmar');
  const toast = document.getElementById('toast');

  let todasLasFacturas = [];
  let facturasFiltradas = [];

  // Acción pendiente de confirmación: { factura, divElement }
  let pendienteEliminar = null;

  // --- Modal ---

  function abrirModal(factura, divElement) {
    pendienteEliminar = { factura, divElement };
    modalOverlay.hidden = false;
  }

  function cerrarModal() {
    pendienteEliminar = null;
    modalOverlay.hidden = true;
  }

  modalCancelar.addEventListener('click', cerrarModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) cerrarModal();
  });

  modalConfirmar.addEventListener('click', async () => {
    if (!pendienteEliminar) return;
    const { factura, divElement } = pendienteEliminar;
    cerrarModal();
    await eliminarFactura(factura, divElement);
  });

  // --- Eliminar factura ---

  async function eliminarFactura(factura, divElement) {
    // Bloquear visualmente la fila mientras se procesa
    divElement.style.opacity = '0.5';
    divElement.style.pointerEvents = 'none';

    try {
      // 1. Borrar archivos del bucket de Storage
      if (factura.imagenes_url && factura.imagenes_url.length > 0) {
        const rutas = factura.imagenes_url.map((url) => {
          // La URL pública tiene el formato: .../storage/v1/object/public/facturas-imagenes/RUTA
          const prefijo = '/storage/v1/object/public/facturas-imagenes/';
          return new URL(url).pathname.slice(prefijo.length);
        });
        await supabase.storage.from('facturas-imagenes').remove(rutas);
      }

      // 2. Borrar el registro de la tabla
      const { error } = await supabase.from('facturas').delete().eq('id', factura.id);
      if (error) throw new Error(error.message);

      // 3. Quitar la fila del DOM y del array en memoria
      divElement.remove();
      todasLasFacturas = todasLasFacturas.filter((f) => f.id !== factura.id);
      facturasFiltradas = facturasFiltradas.filter((f) => f.id !== factura.id);

      if (facturasFiltradas.length === 0) {
        mensajeSinResultados.style.display = 'block';
      }

      // 4. Mostrar toast de confirmación
      mostrarToast();
    } catch (err) {
      divElement.style.opacity = '';
      divElement.style.pointerEvents = '';
      alert(`No se pudo eliminar: ${err.message}`);
    }
  }

  // --- Toast ---

  let timerToast = null;

  function mostrarToast() {
    toast.hidden = false;
    toast.classList.add('toast-visible');
    clearTimeout(timerToast);
    timerToast = setTimeout(() => {
      toast.classList.remove('toast-visible');
      toast.hidden = true;
    }, 2500);
  }

  // --- Cargar facturas desde Supabase ---

  async function cargarFacturas() {
    lista.innerHTML = '<p class="cargando">Cargando facturas...</p>';

    const { data, error } = await supabase
      .from('facturas')
      .select('*')
      .order('fecha_emision', { ascending: false });

    if (error) {
      lista.innerHTML = `<p class="error-msg">Error al cargar: ${error.message}</p>`;
      return;
    }

    todasLasFacturas = data || [];
    aplicarFiltros();
  }

  // Aplicar todos los filtros activos (texto + rango de fechas) y renderizar
  function aplicarFiltros() {
    const termino = inputBusqueda.value.trim().toLowerCase();
    const desde = inputDesde.value;
    const hasta = inputHasta.value;

    const resultado = todasLasFacturas.filter((f) => {
      if (termino) {
        const matchTexto =
          (f.proveedor || '').toLowerCase().includes(termino) ||
          (f.numero_factura || '').toLowerCase().includes(termino);
        if (!matchTexto) return false;
      }
      if (desde && f.fecha_emision && f.fecha_emision < desde) return false;
      if (hasta && f.fecha_emision && f.fecha_emision > hasta) return false;
      return true;
    });

    renderizarLista(resultado);
  }

  // Renderizar la lista de facturas
  function renderizarLista(facturas) {
    facturasFiltradas = facturas;
    lista.innerHTML = '';

    if (facturas.length === 0) {
      mensajeSinResultados.style.display = 'block';
      return;
    }
    mensajeSinResultados.style.display = 'none';

    facturas.forEach((factura) => {
      lista.appendChild(crearItemFactura(factura));
    });
  }

  // Crear elemento HTML para una factura
  function crearItemFactura(factura) {
    const div = document.createElement('div');
    div.className = 'factura-item';

    const fechaFormateada = factura.fecha_emision
      ? new Date(factura.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })
      : '—';

    const importeFormateado = factura.importe_total != null
      ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(factura.importe_total)
      : '—';

    div.innerHTML = `
      <div class="factura-resumen" role="button" tabindex="0">
        <div class="factura-resumen-principal">
          <span class="factura-proveedor">${factura.proveedor || 'Sin proveedor'}</span>
          <span class="factura-importe">${importeFormateado}</span>
        </div>
        <div class="factura-resumen-secundario">
          <span class="factura-fecha">${fechaFormateada}</span>
          <span class="factura-numero">${factura.numero_factura ? `Nº ${factura.numero_factura}` : '—'}</span>
        </div>
        <span class="factura-chevron">›</span>
      </div>
      <div class="factura-detalle" hidden>
        <dl class="detalle-campos">
          <dt>Fecha de emisión</dt>
          <dd>${fechaFormateada}</dd>
          <dt>Número de factura</dt>
          <dd>${factura.numero_factura || '—'}</dd>
          <dt>Proveedor</dt>
          <dd>${factura.proveedor || '—'}</dd>
          <dt>CUIT Proveedor</dt>
          <dd>${factura.cuit_proveedor || '—'}</dd>
          <dt>Concepto</dt>
          <dd>${factura.concepto || '—'}</dd>
          <dt>Importe Total</dt>
          <dd>${importeFormateado}</dd>
          <dt>CUIT Destinatario</dt>
          <dd>${factura.cuit_destinatario || '—'}</dd>
        </dl>
        ${generarMiniaturas(factura.imagenes_url)}
      </div>
    `;

    // Botón eliminar (agregado por JS para poder bindear el evento correctamente)
    const detalle = div.querySelector('.factura-detalle');
    const btnEliminar = document.createElement('button');
    btnEliminar.className = 'btn-eliminar-factura';
    btnEliminar.textContent = 'Eliminar factura';
    btnEliminar.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModal(factura, div);
    });
    detalle.appendChild(btnEliminar);

    // Toggle expandir/colapsar
    const resumen = div.querySelector('.factura-resumen');
    const chevron = div.querySelector('.factura-chevron');

    function toggleDetalle() {
      const abierto = !detalle.hidden;
      detalle.hidden = abierto;
      div.classList.toggle('expandida', !abierto);
      chevron.style.transform = abierto ? '' : 'rotate(90deg)';
    }

    resumen.addEventListener('click', toggleDetalle);
    resumen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDetalle(); }
    });

    return div;
  }

  // Generar miniaturas de imágenes
  function generarMiniaturas(urls) {
    if (!urls || urls.length === 0) return '';

    const imgs = urls.map(url => `
      <a href="${url}" target="_blank" rel="noopener" class="miniatura-link">
        <img src="${url}" alt="Imagen de factura" class="miniatura" loading="lazy">
      </a>
    `).join('');

    return `<div class="miniaturas-contenedor">${imgs}</div>`;
  }

  // Descargar xlsx con SheetJS (respeta el filtro activo)
  btnDescargarExcel.addEventListener('click', () => {
    if (facturasFiltradas.length === 0) return;

    const encabezados = [
      'Fecha de emisión', 'Número de Factura', 'Proveedor',
      'CUIT Proveedor', 'Concepto', 'Importe Total', 'CUIT Destinatario',
    ];

    const filas = facturasFiltradas.map((f) => [
      f.fecha_emision ?? '', f.numero_factura ?? '', f.proveedor ?? '',
      f.cuit_proveedor ?? '', f.concepto ?? '', f.importe_total ?? '', f.cuit_destinatario ?? '',
    ]);

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Facturas');
    const hoy = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `facturas-galilea-${hoy}.xlsx`);
  });

  // Listeners de filtros
  inputBusqueda.addEventListener('input', aplicarFiltros);
  inputDesde.addEventListener('change', aplicarFiltros);
  inputHasta.addEventListener('change', aplicarFiltros);

  btnLimpiar.addEventListener('click', () => {
    inputBusqueda.value = '';
    inputDesde.value = '';
    inputHasta.value = '';
    aplicarFiltros();
  });

  await cargarFacturas();
});
