/* ============================================================
   Sesión del usuario (sessionStorage)
   - cf_sesion_cliente : { id, nombre, correo, rol }  rol real: ADMIN | CLIENTE
   - cf_rol_activo     : con qué rol está navegando ahora (ADMIN | CLIENTE)
   ============================================================ */
function cfGetSesionCliente() {
  return JSON.parse(sessionStorage.getItem('cf_sesion_cliente') || 'null');
}

function cfEsAdmin() {
  const s = cfGetSesionCliente();
  return !!s && s.rol === 'ADMIN';
}

function cfGetRolActivo() {
  return sessionStorage.getItem('cf_rol_activo');
}

function cfSetRolActivo(rol) {
  sessionStorage.setItem('cf_rol_activo', rol);
}

function cfCerrarSesion() {
  sessionStorage.removeItem('cf_sesion_cliente');
  sessionStorage.removeItem('cf_rol_activo');
}

// "Hola, <primer nombre>" en la portada (index.html). Sin sesión: "Hola, bienvenido".
function cfActualizarSaludo() {
  const el = document.getElementById('heroSaludoNombre');
  if (!el) return;
  const sesion = cfGetSesionCliente();
  const primerNombre = sesion && sesion.nombre ? sesion.nombre.trim().split(/\s+/)[0] : '';
  el.textContent = primerNombre || 'bienvenido';
}

function cfActualizarSidebarAuth() {
  const sesion = cfGetSesionCliente();
  const loggedOut = document.getElementById('sidebarAuthLoggedOut');
  const loggedIn = document.getElementById('sidebarAuthLoggedIn');
  const nombreEl = document.getElementById('sidebarUserNombre');
  const adminLinks = document.getElementById('sidebarAdminLinks');

  cfActualizarSaludo();
  if (!loggedOut || !loggedIn) return;

  if (sesion) {
    loggedOut.classList.add('d-none');
    loggedIn.classList.remove('d-none');
    if (nombreEl) nombreEl.textContent = sesion.nombre;
    // Solo el administrador ve "Cambiar de rol" y "Panel de administración"
    if (adminLinks) adminLinks.classList.toggle('d-none', sesion.rol !== 'ADMIN');
  } else {
    loggedOut.classList.remove('d-none');
    loggedIn.classList.add('d-none');
    if (adminLinks) adminLinks.classList.add('d-none');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  cfActualizarSidebarAuth();

  const btnCerrarSesion = document.getElementById('btnCerrarSesionCliente');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', function () {
      cfCerrarSesion();
      cfActualizarSidebarAuth();
      // Si la página tiene la sección de reservas (index.html), la sincroniza
      // para que vuelva a pedir inicio de sesión.
      if (typeof cfActualizarAccesoReservas === 'function') {
        cfActualizarAccesoReservas();
      }
    });
  }
});