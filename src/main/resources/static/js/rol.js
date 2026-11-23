/* Paso 2 (solo ADMIN): elegir con qué rol se ingresa */
document.addEventListener('DOMContentLoaded', function () {
  const sesion = cfGetSesionCliente();
  if (!sesion || sesion.rol !== 'ADMIN') return;   // la guarda del <head> ya redirige

  document.getElementById('rolNombre').textContent = sesion.nombre;

  const opciones = document.querySelectorAll('.rol-opcion');
  const btnContinuar = document.getElementById('btnContinuarRol');
  let elegido = null;

  opciones.forEach(function (op) {
    op.addEventListener('click', function () {
      elegido = op.dataset.rol;
      opciones.forEach(function (o) {
        const activo = o === op;
        o.classList.toggle('activo', activo);
        o.setAttribute('aria-checked', activo);
      });
      btnContinuar.disabled = false;
    });
  });

  btnContinuar.addEventListener('click', function () {
    if (!elegido) return;
    cfSetRolActivo(elegido);
    window.location.href = elegido === 'ADMIN' ? '/admin' : '/index';
  });

  document.getElementById('btnSalirRol').addEventListener('click', function (e) {
    e.preventDefault();
    cfCerrarSesion();
    window.location.replace('/login');
  });
});