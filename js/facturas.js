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

  let todasLasFacturas = [];
  let facturasFiltradas = [];

  // Cargar facturas desde Supabase
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
    const desde = inputDesde.value;   // 'YYYY-MM-DD' o ''
    const hasta = inputHasta.value;   // 'YYYY-MM-DD' o ''

    const resultado = todasLasFacturas.filter((f) => {
      // Filtro de texto
      if (termino) {
        const matchTexto =
          (f.proveedor || '').toLowerCase().includes(termino) ||
          (f.numero_factura || '').toLowerCase().includes(termino);
        if (!matchTexto) return false;
      }

      // Filtro de fecha mínima
      if (desde && f.fecha_emision) {
        if (f.fecha_emision < desde) return false;
      }

      // Filtro de fecha máxima
      if (hasta && f.fecha_emision) {
        if (f.fecha_emision > hasta) return false;
      }

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
      const item = crearItemFactura(factura);
      lista.appendChild(item);
    });
  }

  // Crear elemento HTML para una factura
  function crearItemFactura(factura) {
    const div = document.createElement('div');
    div.className = 'factura-item';

    const fechaFormateada = factura.fecha_emision
      ? new Date(factura.fecha_emision + 'T12:00:00').toLocaleDateString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric'
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

    // Toggle expandir/colapsar
    const resumen = div.querySelector('.factura-resumen');
    const detalle = div.querySelector('.factura-detalle');
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
      'Fecha de emisión',
      'Número de Factura',
      'Proveedor',
      'CUIT Proveedor',
      'Concepto',
      'Importe Total',
      'CUIT Destinatario',
    ];

    const filas = facturasFiltradas.map((f) => [
      f.fecha_emision ?? '',
      f.numero_factura ?? '',
      f.proveedor ?? '',
      f.cuit_proveedor ?? '',
      f.concepto ?? '',
      f.importe_total ?? '',
      f.cuit_destinatario ?? '',
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
