let categoriaAEliminar = null;
let productoAEliminar = null;

// Copia local de lo que hay en MySQL (se recarga después de cada cambio)
let categorias = [];
let productos = [];
let reservas = [];
let reservaAEliminar = null;

document.addEventListener('DOMContentLoaded', function () {
    // Doble verificación (la primera está en el <head> de admin.html)
    const sesion = JSON.parse(sessionStorage.getItem('cf_sesion_cliente') || 'null');
    if (!sesion || sesion.rol !== 'ADMIN' || sessionStorage.getItem('cf_rol_activo') !== 'ADMIN') {
        window.location.replace('/login');
        return;
    }
    recargar();

    document.getElementById('btnLogout').addEventListener('click', function () {
        sessionStorage.removeItem('cf_sesion_cliente');
        sessionStorage.removeItem('cf_rol_activo');
        window.location.replace('/'); // replace: la página del panel no queda en el historial
    });

    iniciarBarraLateral(sesion);

    // Filtros de productos: se re-dibuja la tabla sin volver a pedir datos al servidor
    document.getElementById('buscarProducto').addEventListener('input', renderTablaProductos);
    document.getElementById('filtroCategoria').addEventListener('change', renderTablaProductos);

    document.getElementById('btnNuevoProducto').addEventListener('click', () => abrirModalProducto());
    document.getElementById('btnNuevaCategoria').addEventListener('click', () => abrirModalCategoria());
    document.getElementById('formProducto').addEventListener('submit', guardarProducto);
    document.getElementById('formCategoria').addEventListener('submit', guardarCategoria);
    document.getElementById('btnConfirmarEliminar').addEventListener('click', confirmarEliminacion);
});

// Lee categorías y productos desde MySQL y vuelve a dibujar las dos tablas
async function recargar() {
    try {
        categorias = await cfApi('/api/categorias');
        productos = await cfApi('/api/productos');
        reservas = await cfApi('/api/reservas');
    } catch (e) {
        alert(cfTextoError(e));
    }
    cargarFiltroCategorias();
    renderTablaProductos();
    renderTablaCategorias();
    renderTablaReservas();
    renderResumen();
}

/* ================= BARRA LATERAL ================= */

const SECCIONES = {
    inicio:     { titulo: 'Inicio',     subtitulo: 'Resumen de Casa Forno' },
    productos:  { titulo: 'Productos',  subtitulo: 'Registrar, editar y organizar la carta' },
    categorias: { titulo: 'Categorías', subtitulo: 'Organiza la carta del local' },
    reservas:   { titulo: 'Reservas',   subtitulo: 'Gestiona las reservas de los clientes' }
};

function iniciarBarraLateral(sesion) {
    const nombre = (sesion.nombre || 'Administrador').trim();
    const primerNombre = nombre.split(/\s+/)[0];
    const inicial = nombre.charAt(0).toUpperCase();
    ['menuNombre', 'chipNombre'].forEach(id => document.getElementById(id).textContent = nombre);
    ['menuAvatar', 'chipAvatar'].forEach(id => document.getElementById(id).textContent = inicial);
    document.getElementById('bannerNombre').textContent = primerNombre;

    // Un clic en una pestaña muestra esa sección y oculta las demás
    document.querySelectorAll('[data-seccion]').forEach(btn =>
        btn.addEventListener('click', () => { mostrarSeccion(btn.dataset.seccion); cerrarMenu(); }));

    let guardada = null;
    try { guardada = sessionStorage.getItem('cf_admin_seccion'); } catch (e) { }
    mostrarSeccion(SECCIONES[guardada] ? guardada : 'inicio');
}

// En celular el menú es un desplegable: se cierra al elegir una sección
function cerrarMenu() {
    const menu = document.getElementById('adminMenu');
    if (menu.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(menu).hide();
}

function mostrarSeccion(nombre) {
    Object.keys(SECCIONES).forEach(clave => {
        document.getElementById('seccion-' + clave).classList.toggle('d-none', clave !== nombre);
    });
    document.querySelectorAll('[data-seccion]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.seccion === nombre));
    document.getElementById('seccionTitulo').textContent = SECCIONES[nombre].titulo;
    document.getElementById('seccionSubtitulo').textContent = SECCIONES[nombre].subtitulo;
    try { sessionStorage.setItem('cf_admin_seccion', nombre); } catch (e) { }
}

// Quita tildes y mayúsculas: "Pizza" encuentra "pizzá", "PIZZA", etc.
function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Llena el <select> de categorías conservando la elección actual si todavía existe
function cargarFiltroCategorias() {
    const select = document.getElementById('filtroCategoria');
    const actual = select.value;
    select.innerHTML = '<option value="">Todas las categorías</option>' +
        categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    select.value = categorias.some(c => String(c.id) === actual) ? actual : '';
}

function productosFiltrados() {
    const texto = normalizar(document.getElementById('buscarProducto').value);
    const idCategoria = document.getElementById('filtroCategoria').value;
    return productos.filter(p => {
        const coincideCategoria = !idCategoria || (p.categoria && String(p.categoria.id) === idCategoria);
        const coincideTexto = !texto || normalizar(p.nombre + ' ' + (p.descripcion || '')).includes(texto);
        return coincideCategoria && coincideTexto;
    });
}

// Tarjetas de la sección "Inicio" (datos reales de MySQL)
function renderResumen() {
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.getElementById('bannerFecha').textContent =
        d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('statProductos').textContent = productos.length;
    document.getElementById('statCategorias').textContent = categorias.length;
    document.getElementById('statReservasHoy').textContent =
        reservas.filter(r => r.fecha === hoy && r.estado !== 'CANCELADA').length;
    document.getElementById('statReservasPendientes').textContent =
        reservas.filter(r => r.estado === 'PENDIENTE').length;
}

/* ================= PRODUCTOS ================= */

function renderTablaProductos() {
    const tbody = document.getElementById('tablaProductos');

    const lista = productosFiltrados();
    document.getElementById('contadorProductos').textContent = `${lista.length} de ${productos.length} productos`;

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">${
            productos.length ? 'Ningún producto coincide con la búsqueda o el filtro.' : 'No hay productos aún.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const oculto = p.visible === false;

        return `
      <tr class="${oculto ? 'fila-oculta' : ''}">
        <td><img src="${p.imagen || 'https://placehold.co/80x80'}" class="admin-img-mini" alt=""></td>
        <td>
          <p class="mb-0 fw-semibold">${p.nombre} ${oculto ? '<span class="badge-oculto">Oculto</span>' : ''}</p>
          <p class="mb-0 small text-muted">${p.descripcion || ''}</p>
        </td>
        <td>${p.categoria ? p.categoria.nombre : '—'}</td>
        <td class="text-nowrap">S/ ${Number(p.precio).toFixed(2)}</td>
        <td class="text-end text-nowrap">
          <button class="btn btn-sm btn-outline-secondary" data-ocultar-producto="${p.id}" title="${oculto ? 'Mostrar' : 'Ocultar'}"><i class="bi ${oculto ? 'bi-eye' : 'bi-eye-slash'}"></i></button>
          <button class="btn btn-sm btn-outline-secondary" data-editar-producto="${p.id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-eliminar-producto="${p.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
    }).join('');

    tbody.querySelectorAll('[data-editar-producto]').forEach(b => b.addEventListener('click', () => abrirModalProducto(b.dataset.editarProducto)));
    tbody.querySelectorAll('[data-eliminar-producto]').forEach(b => b.addEventListener('click', () => pedirConfirmacionProducto(b.dataset.eliminarProducto)));
    tbody.querySelectorAll('[data-ocultar-producto]').forEach(b => b.addEventListener('click', async () => {
        try {
            await cfApi(`/api/productos/${b.dataset.ocultarProducto}/visible`, { method: 'PATCH' });
            await recargar();
        } catch (e) {
            alert(cfTextoError(e));
        }
    }));
}

function abrirModalProducto(id) {
    const select = document.getElementById('productoCategoria');
    select.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    const form = document.getElementById('formProducto');
    form.reset();

    if (id) {
        const producto = productos.find(p => p.id === Number(id));
        document.getElementById('modalProductoTitulo').textContent = 'Editar producto';
        document.getElementById('productoId').value = producto.id;
        document.getElementById('productoCategoria').value = producto.categoria.id;
        document.getElementById('productoNombre').value = producto.nombre;
        document.getElementById('productoDescripcion').value = producto.descripcion || '';
        document.getElementById('productoPrecio').value = producto.precio;
        document.getElementById('productoImagen').value = producto.imagen || '';
    } else {
        document.getElementById('modalProductoTitulo').textContent = 'Nuevo producto';
        document.getElementById('productoId').value = '';
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProducto')).show();
}

async function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById('productoId').value;
    const datos = {
        nombre: document.getElementById('productoNombre').value.trim(),
        descripcion: document.getElementById('productoDescripcion').value.trim(),
        precio: Math.round(parseFloat(document.getElementById('productoPrecio').value) * 100) / 100,
        //precio: parseFloat(document.getElementById('productoPrecio').value),
        imagen: document.getElementById('productoImagen').value.trim() || 'https://placehold.co/600x400?text=Casa+Forno',
        categoria: { id: Number(document.getElementById('productoCategoria').value) },
    };

    try {
        if (id) {
            // Se conserva el estado actual (visible/oculto) al editar
            datos.visible = productos.find(p => p.id === Number(id)).visible;
            await cfApi(`/api/productos/${id}`, { method: 'PUT', body: datos });
        } else {
            await cfApi('/api/productos', { method: 'POST', body: datos });
        }
        bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
        await recargar();
    } catch (err) {
        alert(cfTextoError(err));
    }
}

function pedirConfirmacionProducto(id) {
    productoAEliminar = Number(id);
    categoriaAEliminar = null;
    reservaAEliminar = null;
    const producto = productos.find(p => p.id === productoAEliminar);
    document.getElementById('confirmarMensaje').textContent = `¿Eliminar el producto "${producto.nombre}"? Esta acción no se puede deshacer.`;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmar')).show();
}

/* ================= CATEGORÍAS ================= */

function renderTablaCategorias() {
    const tbody = document.getElementById('tablaCategorias');

    if (!categorias.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No hay categorías aún.</td></tr>`;
        return;
    }

    tbody.innerHTML = categorias.map(c => {
        const oculto = c.visible === false;
        return `
    <tr class="${oculto ? 'fila-oculta' : ''}">
      <td><i class="bi ${c.icono} fs-5"></i></td>
      <td class="fw-semibold">${c.nombre} ${oculto ? '<span class="badge-oculto">Oculto</span>' : ''}</td>
      <td><code>${c.slug}</code></td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-ocultar-categoria="${c.id}" title="${oculto ? 'Mostrar' : 'Ocultar'}"><i class="bi ${oculto ? 'bi-eye' : 'bi-eye-slash'}"></i></button>
        <button class="btn btn-sm btn-outline-secondary" data-editar-categoria="${c.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-eliminar-categoria="${c.id}"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `;
    }).join('');

    tbody.querySelectorAll('[data-editar-categoria]').forEach(b => b.addEventListener('click', () => abrirModalCategoria(b.dataset.editarCategoria)));
    tbody.querySelectorAll('[data-eliminar-categoria]').forEach(b => b.addEventListener('click', () => pedirConfirmacionCategoria(b.dataset.eliminarCategoria)));
    tbody.querySelectorAll('[data-ocultar-categoria]').forEach(b => b.addEventListener('click', async () => {
        try {
            await cfApi(`/api/categorias/${b.dataset.ocultarCategoria}/visible`, { method: 'PATCH' });
            await recargar();
        } catch (e) {
            alert(cfTextoError(e));
        }
    }));
}

// El campo "categoriaId" del formulario guarda el slug (identificador legible);
// "categoriaIdOriginal" guarda el id numérico de la BD cuando se está editando.
function abrirModalCategoria(id) {
    const form = document.getElementById('formCategoria');
    form.reset();
    const campoSlug = document.getElementById('categoriaId');

    if (id) {
        const categoria = categorias.find(c => c.id === Number(id));
        document.getElementById('modalCategoriaTitulo').textContent = 'Editar categoría';
        document.getElementById('categoriaIdOriginal').value = categoria.id;
        campoSlug.value = categoria.slug;
        campoSlug.disabled = true; // no se cambia el slug de una categoría existente
        document.getElementById('categoriaNombre').value = categoria.nombre;
        document.getElementById('categoriaIcono').value = categoria.icono;
        document.getElementById('categoriaImagen').value = categoria.imagen || '';
        document.getElementById('categoriaDescripcion').value = categoria.descripcion || '';
    } else {
        document.getElementById('modalCategoriaTitulo').textContent = 'Nueva categoría';
        document.getElementById('categoriaIdOriginal').value = '';
        campoSlug.disabled = false;
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCategoria')).show();
}

async function guardarCategoria(e) {
    e.preventDefault();
    const idOriginal = document.getElementById('categoriaIdOriginal').value;
    const datos = {
        slug: document.getElementById('categoriaId').value.trim().toLowerCase(),
        nombre: document.getElementById('categoriaNombre').value.trim(),
        icono: document.getElementById('categoriaIcono').value.trim(),
        imagen: document.getElementById('categoriaImagen').value.trim() || null,
        descripcion: document.getElementById('categoriaDescripcion').value.trim() || null,
    };

    try {
        if (idOriginal) {
            // Se conserva el estado actual (visible/oculto) al editar
            datos.visible = categorias.find(c => c.id === Number(idOriginal)).visible;
            await cfApi(`/api/categorias/${idOriginal}`, { method: 'PUT', body: datos });
        } else {
            await cfApi('/api/categorias', { method: 'POST', body: datos });
        }
        bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide();
        await recargar();
    } catch (err) {
        alert(cfTextoError(err));   // aquí aparece, por ejemplo, el 409 de slug duplicado
    }
}

function pedirConfirmacionCategoria(id) {
    categoriaAEliminar = Number(id);
    productoAEliminar = null;
    reservaAEliminar = null;
    const categoria = categorias.find(c => c.id === categoriaAEliminar);
    const nProductos = productos.filter(p => p.categoria && p.categoria.id === categoriaAEliminar).length;
    document.getElementById('confirmarMensaje').textContent =
        `¿Eliminar la categoría "${categoria.nombre}"?` +
        (nProductos ? ` Se eliminarán también sus ${nProductos} producto(s).` : '');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmar')).show();
}

/* ================= RESERVAS ================= */

function renderTablaReservas() {
    const tbody = document.getElementById('tablaReservas');

    if (!reservas.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay reservas aún.</td></tr>`;
        return;
    }

    const ordenadas = [...reservas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const estados = ['PENDIENTE', 'CONFIRMADA', 'CANCELADA'];

    tbody.innerHTML = ordenadas.map(r => `
      <tr>
        <td>${r.fecha}</td>
        <td>${String(r.hora).substring(0, 5)}</td>
        <td>
          <p class="mb-0 fw-semibold">${r.usuario ? r.usuario.nombre : '—'}</p>
          <p class="mb-0 small text-muted">${r.usuario ? r.usuario.correo : ''}</p>
        </td>
        <td>${r.telefono}</td>
        <td>${r.personas}</td>
        <td>${r.nota || ''}</td>
        <td>
          <select class="form-select form-select-sm" data-estado-reserva="${r.id}">
            ${estados.map(e => `<option value="${e}" ${e === r.estado ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" data-eliminar-reserva="${r.id}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-estado-reserva]').forEach(sel => sel.addEventListener('change', async () => {
        try {
            await cfApi(`/api/reservas/${sel.dataset.estadoReserva}/estado?estado=${sel.value}`, { method: 'PATCH' });
            await recargar();
        } catch (e) {
            alert(cfTextoError(e));
        }
    }));
    tbody.querySelectorAll('[data-eliminar-reserva]').forEach(b => b.addEventListener('click', () => {
        reservaAEliminar = Number(b.dataset.eliminarReserva);
        productoAEliminar = null;
        categoriaAEliminar = null;
        document.getElementById('confirmarMensaje').textContent = '¿Eliminar esta reserva? Esta acción no se puede deshacer.';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalConfirmar')).show();
    }));
}

/* ================= ELIMINACIÓN (compartida) ================= */

async function confirmarEliminacion() {
    try {
        if (productoAEliminar) {
            await cfApi(`/api/productos/${productoAEliminar}`, { method: 'DELETE' });
            productoAEliminar = null;
        } else if (categoriaAEliminar) {
            await cfApi(`/api/categorias/${categoriaAEliminar}`, { method: 'DELETE' });
            categoriaAEliminar = null;
        } else if (reservaAEliminar) {
            await cfApi(`/api/reservas/${reservaAEliminar}`, { method: 'DELETE' });
            reservaAEliminar = null;
        }
        await recargar();
    } catch (e) {
        alert(cfTextoError(e));
    }
    bootstrap.Modal.getInstance(document.getElementById('modalConfirmar')).hide();
}


/* ================= Lógica Panel de Íconos ================= */

document.addEventListener('DOMContentLoaded', () => {
  const inputIcono = document.getElementById('categoriaIcono');
  const previewIcono = document.getElementById('iconoPreview');
  const offcanvasEl = document.getElementById('panelIconos');
  const offcanvasInstance = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
  const buscador = document.getElementById('buscadorIconos');
  const items = document.querySelectorAll('.item-icono');

  // Seleccionar ícono al hacer clic
  document.querySelectorAll('.btn-icono').forEach(btn => {
    btn.addEventListener('click', () => {
      const iconoClase = btn.getAttribute('data-icon');
      
      inputIcono.value = iconoClase;
      if (previewIcono) {
        previewIcono.className = `bi ${iconoClase}`;
      }
      
      // Cierra únicamente el panel lateral sin alterar el modal
      offcanvasInstance.hide();
    });
  });

  // Filtrar íconos con el buscador
  buscador.addEventListener('input', (e) => {
    const texto = e.target.value.toLowerCase().trim();
    items.forEach(item => {
      const palabrasClave = item.getAttribute('data-name');
      item.style.display = palabrasClave.includes(texto) ? 'block' : 'none';
    });
  });

  // Actualizar preview si se escribe manualmente
  if (inputIcono && previewIcono) {
    inputIcono.addEventListener('input', (e) => {
      previewIcono.className = `bi ${e.target.value.trim()}`;
    });
  }
});