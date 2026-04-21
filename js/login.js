// Lógica de la pantalla de login

document.addEventListener('DOMContentLoaded', () => {
  // Si ya está autenticado, ir directo al historial
  if (sessionStorage.getItem('autenticado') === 'true') {
    window.location.replace('facturas.html');
    return;
  }

  const form = document.getElementById('form-login');
  const inputClave = document.getElementById('clave');
  const mensajeError = document.getElementById('mensaje-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const valor = inputClave.value.trim();

    if (valor === PALABRA_CLAVE) {
      sessionStorage.setItem('autenticado', 'true');
      window.location.replace('facturas.html');
    } else {
      mensajeError.textContent = 'Clave incorrecta. Intentá de nuevo.';
      mensajeError.style.display = 'block';
      inputClave.value = '';
      inputClave.focus();
    }
  });
});
