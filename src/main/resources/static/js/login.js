/* ============================================================
   LOGIN (un solo formulario para todos)
   Paso 1: iniciar sesión  -> POST /api/auth/login
   Paso 2: si el usuario es ADMIN -> /rol (elige cómo ingresar)
           si es CLIENTE          -> /index (solo vista cliente + reservar)
   ============================================================ */
function cfSetSesionCliente(usuario) {
  sessionStorage.setItem('cf_sesion_cliente', JSON.stringify(usuario));
}

// Guarda la sesión y decide a dónde ir según el rol REAL del usuario (viene de MySQL)
function cfEntrarSegunRol(usuario) {
  cfSetSesionCliente({ id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol });
  sessionStorage.removeItem('cf_rol_activo');

  if (usuario.rol === 'ADMIN') {
    window.location.href = '/rol';                       // paso 2: elegir rol
  } else {
    sessionStorage.setItem('cf_rol_activo', 'CLIENTE');  // cliente: sin elección
    window.location.href = '/index';
  }
}

document.addEventListener('DOMContentLoaded', function () {

  const panelLogin = document.getElementById('panelLogin');
  const panelRegistro = document.getElementById('panelRegistro');
  const subtitulo = document.getElementById('authSubtitulo');

  const loginForm = document.getElementById('loginForm');
  const registroClienteForm = document.getElementById('registroClienteForm');
  const registroClave = document.getElementById('registroClave');
  const registroClave2 = document.getElementById('registroClave2');

  // ---------- Alternar login / registro ----------
  document.getElementById('irARegistro').addEventListener('click', function (e) {
    e.preventDefault();
    panelLogin.classList.add('d-none');
    panelRegistro.classList.remove('d-none');
    subtitulo.textContent = 'Crea tu cuenta';
  });

  document.getElementById('irALogin').addEventListener('click', function (e) {
    e.preventDefault();
    panelRegistro.classList.add('d-none');
    panelLogin.classList.remove('d-none');
    subtitulo.textContent = 'Ingresa a tu cuenta';
  });

  // ---------- Confirmar contraseña: se integra a la validación de Bootstrap ----------
  function validarClavesCoinciden() {
    if (registroClave2.value && registroClave2.value !== registroClave.value) {
      registroClave2.setCustomValidity('Las contraseñas no coinciden.');
    } else {
      registroClave2.setCustomValidity('');
    }
  }
  registroClave.addEventListener('input', validarClavesCoinciden);
  registroClave2.addEventListener('input', validarClavesCoinciden);

  // ---------- Iniciar sesión (POST /api/auth/login) ----------
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const errorEl = document.getElementById('loginError');
    errorEl.classList.add('d-none');

    if (!loginForm.checkValidity()) {
      loginForm.classList.add('was-validated');
      return;
    }
    loginForm.classList.add('was-validated');

    const correo = document.getElementById('loginEmail').value.trim().toLowerCase();
    const clave = document.getElementById('loginClave').value;

    try {
      const usuario = await cfApi('/api/auth/login', { method: 'POST', body: { correo, clave } });
      cfEntrarSegunRol(usuario);
    } catch (err) {
      errorEl.textContent = err.status === 401 ? 'Correo o contraseña incorrectos.' : cfTextoError(err);
      errorEl.classList.remove('d-none');
    }
  });

  // ---------- Registrarme (POST /api/usuarios) -> siempre es CLIENTE ----------
  registroClienteForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    e.stopPropagation();

    const errorEl = document.getElementById('registroClienteError');
    errorEl.classList.add('d-none');

    validarClavesCoinciden();

    if (!registroClienteForm.checkValidity()) {
      registroClienteForm.classList.add('was-validated');
      return;
    }
    registroClienteForm.classList.add('was-validated');

    const nombre = document.getElementById('registroNombre').value.trim();
    const correo = document.getElementById('registroEmail').value.trim().toLowerCase();
    const clave = document.getElementById('registroClave').value;

    try {
      const usuario = await cfApi('/api/usuarios', { method: 'POST', body: { nombre, correo, clave } });
      cfEntrarSegunRol(usuario);
    } catch (err) {
      errorEl.textContent = cfTextoError(err);
      errorEl.classList.remove('d-none');
    }
  });

});