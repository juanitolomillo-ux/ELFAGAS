// =====================================================
// ELFAGAS INSTALACIONES — Órdenes de Servicio
// Diseño por domicilio · PDF informe · Reportes
// =====================================================

// ---- EMPRESA FIJA (aparece en PDF, no se edita en la UI) ----
const EMPRESA = {
  nombre: 'ELFAGAS INSTALACIONES SPA',
  rut: '76.958.735-7',
  giro: 'Obras menores, calefacción, gasfitería y aire acondicionado',
  rubro: 'Gasfitería · Calefacción · Aire acondicionado'
};

// ---- SUPABASE (misma lógica; cambia URL/key si usas otro proyecto) ----
const SUPABASE_URL = 'https://kwgwsixsmppxibayxzor.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Z3dzaXhzbXBweGliYXl4em9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTE0NTYsImV4cCI6MjEwNTE2NzQ1Nn0.GMCXMDpvqBfycI9FXBeri-ixUae4U8h9MqqPXkcqKZg';

const STORAGE_KEY = 'elfagas_ordenes';
const TABLA = 'ordenes_elfagas'; // tabla distinta al taller

let supabaseClient = null;
let useSupabase = false;
let ordenActualId = null;
let ultimoReporte = null;
let fotoAntesBase64 = null;
let fotoDespuesBase64 = null;

// ---------- UTILS ----------
function formatCLP(n) {
  return new Intl.NumberFormat('es-CL').format(Math.round(n || 0));
}
function parseNumber(val) {
  const n = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 40) + 'px';
}

// ---------- SUPABASE ----------
function initSupabase() {
  if (!window.supabase) return false;
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useSupabase = true;
    console.log('✅ Supabase OK (ELFAGAS)');
    return true;
  } catch (e) {
    console.warn(e);
    useSupabase = false;
    return false;
  }
}

async function getOrdenes() {
  if (useSupabase && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from(TABLA)
        .select('*')
        .order('fecha_guardado', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => {
        const d = row.datos || {};
        return {
          ...d,
          id: row.id,
          ordenNumero: row.orden_numero || d.ordenNumero,
          clienteNombre: row.cliente_nombre || d.clienteNombre,
          direccion: row.direccion || d.direccion,
          comuna: row.comuna || d.comuna,
          fechaGuardado: row.fecha_guardado || d.fechaGuardado
        };
      });
    } catch (e) {
      console.error(e);
      useSupabase = false;
    }
  }
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

async function saveOrdenToDB(datos) {
  if (useSupabase && supabaseClient) {
    try {
      const row = {
        id: datos.id,
        orden_numero: datos.ordenNumero,
        cliente_nombre: datos.clienteNombre,
        direccion: datos.direccion,
        comuna: datos.comuna,
        fecha_guardado: new Date().toISOString(),
        datos
      };
      const { error } = await supabaseClient.from(TABLA).upsert(row, { onConflict: 'id' });
      if (error) throw error;
      return { ok: true, donde: 'Supabase (nube)' };
    } catch (e) {
      console.error(e);
      alert('Error Supabase:\n' + (e.message || e) + '\n\nSe guarda en este navegador.');
      useSupabase = false;
    }
  }
  const ordenes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const idx = ordenes.findIndex(o => o.id === datos.id);
  if (idx >= 0) ordenes[idx] = datos;
  else ordenes.push(datos);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ordenes));
  return { ok: true, donde: 'almacenamiento local' };
}

function generateOrderNumber(ordenes) {
  let max = 0;
  (ordenes || []).forEach(o => {
    const n = parseInt(String(o.ordenNumero || '').replace(/\D/g, '') || '0', 10);
    if (n > max) max = n;
  });
  return String(max + 1).padStart(6, '0');
}


function leerFoto(input, previewId, setter) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const data = ev.target.result;
    setter(data);
    const prev = document.getElementById(previewId);
    if (prev) prev.innerHTML = `<img src="${data}" alt="foto">`;
  };
  reader.readAsDataURL(file);
}

// ---------- TRABAJOS ----------
function addTrabajo(texto = '') {
  const list = document.getElementById('trabajosList');
  const div = document.createElement('div');
  div.className = 'trabajo-item';
  div.innerHTML = `
    <textarea class="trabajo-texto" rows="1" placeholder="Ej. Detección con gas trazador y reparación filtración">${texto.replace(/</g, '&lt;')}</textarea>
    <button type="button" class="btn-remove" title="Eliminar">×</button>
  `;
  const ta = div.querySelector('.trabajo-texto');
  ta.addEventListener('input', () => autoResize(ta));
  div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
  list.appendChild(div);
  if (texto) setTimeout(() => autoResize(ta), 0);
}

function getTrabajos() {
  return Array.from(document.querySelectorAll('.trabajo-texto'))
    .map(i => i.value.trim())
    .filter(Boolean);
}

// ---------- MATERIALES ----------
function ivaActivo() {
  return !!document.getElementById('aplicarIva')?.checked;
}

function addMaterial(cant = 1, desc = '', neto = 0) {
  const tbody = document.getElementById('materialesBody');
  const tr = document.createElement('tr');
  const factor = ivaActivo() ? 1.19 : 1;
  const totalLinea = Math.round(neto * factor);
  tr.innerHTML = `
    <td><input type="number" class="mat-cant" min="1" step="1" value="${cant}"></td>
    <td><textarea class="mat-desc" rows="1" placeholder="Producto o servicio">${desc.replace(/</g, '&lt;')}</textarea></td>
    <td><input type="number" class="mat-neto" min="0" step="100" value="${neto}"></td>
    <td><input type="number" class="mat-total" readonly value="${totalLinea}"></td>
    <td><button type="button" class="btn-remove">×</button></td>
  `;
  const cantI = tr.querySelector('.mat-cant');
  const netoI = tr.querySelector('.mat-neto');
  const totalI = tr.querySelector('.mat-total');
  const descTa = tr.querySelector('.mat-desc');

  function recalc() {
    const c = parseNumber(cantI.value) || 0;
    const n = parseNumber(netoI.value) || 0;
    const f = ivaActivo() ? 1.19 : 1;
    totalI.value = Math.round(c * n * f);
    calcularTotales();
  }
  cantI.addEventListener('input', recalc);
  netoI.addEventListener('input', recalc);
  descTa.addEventListener('input', () => autoResize(descTa));
  tr.querySelector('.btn-remove').addEventListener('click', () => {
    tr.remove();
    calcularTotales();
  });
  tbody.appendChild(tr);
  if (desc) setTimeout(() => autoResize(descTa), 0);
  calcularTotales();
}

function getMateriales() {
  const conIva = ivaActivo();
  return Array.from(document.querySelectorAll('#materialesBody tr')).map(tr => {
    const cant = parseNumber(tr.querySelector('.mat-cant').value) || 0;
    const desc = tr.querySelector('.mat-desc').value.trim();
    const netoUnit = parseNumber(tr.querySelector('.mat-neto').value) || 0;
    const netoLinea = cant * netoUnit;
    const totalLinea = Math.round(netoLinea * (conIva ? 1.19 : 1));
    return { cantidad: cant, descripcion: desc, precioNeto: netoUnit, netoLinea, totalLinea };
  }).filter(m => m.descripcion);
}

function calcularTotales() {
  const mats = getMateriales();
  const conIva = ivaActivo();
  const subtotal = mats.reduce((s, m) => s + m.netoLinea, 0);
  const iva = conIva ? Math.round(subtotal * 0.19) : 0;
  const total = subtotal + iva;

  document.getElementById('resumenSubtotal').textContent = '$ ' + formatCLP(subtotal);
  document.getElementById('resumenIva').textContent = '$ ' + formatCLP(iva);
  document.getElementById('resumenTotal').textContent = '$ ' + formatCLP(total);

  const lineaIva = document.getElementById('lineaIva');
  const note = document.getElementById('resumenNote');
  const hint = document.getElementById('ivaHint');
  const thPrecio = document.getElementById('thPrecio');
  const thTotal = document.getElementById('thTotalLinea');

  if (lineaIva) lineaIva.style.display = conIva ? 'flex' : 'none';
  if (note) note.textContent = conIva ? 'IVA incluido (cliente empresa)' : 'Sin IVA (cliente particular / casa)';
  if (hint) hint.textContent = conIva ? 'Cliente empresa — se cobra IVA 19%' : 'Cliente particular (casa) — sin IVA';
  if (thPrecio) thPrecio.textContent = conIva ? 'Precio neto' : 'Precio';
  if (thTotal) thTotal.textContent = conIva ? 'Total c/IVA' : 'Total';

  // Recalcular totales de cada fila de materiales
  document.querySelectorAll('#materialesBody tr').forEach(tr => {
    const cant = parseNumber(tr.querySelector('.mat-cant')?.value) || 0;
    const n = parseNumber(tr.querySelector('.mat-neto')?.value) || 0;
    const tot = tr.querySelector('.mat-total');
    if (tot) tot.value = Math.round(cant * n * (conIva ? 1.19 : 1));
  });

  return { subtotal, iva, total, conIva };
}

// ---------- FORM ----------
async function limpiarFormulario() {
  ordenActualId = null;
  const ordenes = await getOrdenes();
  document.getElementById('ordenNumero').value = generateOrderNumber(ordenes);
  document.getElementById('fechaServicio').value = todayISO();
  document.getElementById('estado').value = 'FINALIZADO';
  document.getElementById('clienteNombre').value = '';
  document.getElementById('clienteRut').value = '';
  document.getElementById('clienteTel').value = '';
  document.getElementById('clienteEmail').value = '';
  document.getElementById('direccion').value = '';
  document.getElementById('comuna').value = '';
  document.querySelector('input[name="tipoInmueble"][value="Casa"]').checked = true;
  document.getElementById('tecnico').value = '';
  document.getElementById('tipoServicio').value = 'Urgencia';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.chip-urgencia')?.classList.add('active');
  document.getElementById('descripcionServicio').value = '';
  document.getElementById('trabajosList').innerHTML = '';
  document.getElementById('materialesBody').innerHTML = '';
  document.getElementById('observaciones').value = '';
  document.getElementById('textoAntes').value = '';
  document.getElementById('textoDespues').value = '';
  fotoAntesBase64 = null;
  fotoDespuesBase64 = null;
  const pa = document.getElementById('previewAntes');
  const pd = document.getElementById('previewDespues');
  if (pa) pa.innerHTML = '';
  if (pd) pd.innerHTML = '';
  const fa = document.getElementById('fotoAntes');
  const fd = document.getElementById('fotoDespues');
  if (fa) fa.value = '';
  if (fd) fd.value = '';
  document.getElementById('historialLista').innerHTML = '<p class="hint-inline" id="historialVacio">Escribe una dirección para ver visitas anteriores en este domicilio.</p>';
  document.getElementById('historialCount').textContent = '';
  const ivaCb = document.getElementById('aplicarIva');
  if (ivaCb) ivaCb.checked = false;
  addTrabajo();
  addMaterial();
  calcularTotales();
}

function cargarOrden(orden) {
  ordenActualId = orden.id;
  document.getElementById('ordenNumero').value = orden.ordenNumero || '';
  document.getElementById('fechaServicio').value = (orden.fechaServicio || '').slice(0, 10);
  document.getElementById('estado').value = orden.estado || 'FINALIZADO';
  document.getElementById('clienteNombre').value = orden.clienteNombre || '';
  document.getElementById('clienteRut').value = orden.clienteRut || '';
  document.getElementById('clienteTel').value = orden.clienteTel || '';
  document.getElementById('clienteEmail').value = orden.clienteEmail || '';
  document.getElementById('direccion').value = orden.direccion || '';
  document.getElementById('comuna').value = orden.comuna || '';
  const ti = orden.tipoInmueble || 'Casa';
  const radio = document.querySelector(`input[name="tipoInmueble"][value="${ti}"]`);
  if (radio) radio.checked = true;
  document.getElementById('tecnico').value = orden.tecnico || '';
  document.getElementById('tipoServicio').value = orden.tipoServicio || 'Urgencia';
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.tipo === orden.tipoServicio);
  });
  document.getElementById('descripcionServicio').value = orden.descripcionServicio || '';
  document.getElementById('trabajosList').innerHTML = '';
  (orden.trabajos || []).forEach(t => addTrabajo(t));
  if (!(orden.trabajos || []).length) addTrabajo();
  document.getElementById('materialesBody').innerHTML = '';
  (orden.materiales || []).forEach(m => addMaterial(m.cantidad, m.descripcion, m.precioNeto));
  if (!(orden.materiales || []).length) addMaterial();
  document.getElementById('observaciones').value = orden.observaciones || '';
  document.getElementById('textoAntes').value = orden.textoAntes || '';
  document.getElementById('textoDespues').value = orden.textoDespues || '';
  fotoAntesBase64 = orden.fotoAntes || null;
  fotoDespuesBase64 = orden.fotoDespues || null;
  const pa = document.getElementById('previewAntes');
  const pd = document.getElementById('previewDespues');
  if (pa) pa.innerHTML = fotoAntesBase64 ? `<img src="${fotoAntesBase64}" alt="antes">` : '';
  if (pd) pd.innerHTML = fotoDespuesBase64 ? `<img src="${fotoDespuesBase64}" alt="despues">` : '';
  const ivaCb = document.getElementById('aplicarIva');
  if (ivaCb) ivaCb.checked = !!orden.aplicarIva;
  calcularTotales();
  cargarHistorialDomicilio(orden.direccion, orden.comuna, orden.id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function recolectarDatos() {
  const { subtotal, iva, total } = calcularTotales();
  return {
    id: ordenActualId || uuid(),
    ordenNumero: document.getElementById('ordenNumero').value,
    fechaServicio: document.getElementById('fechaServicio').value,
    estado: document.getElementById('estado').value,
    clienteNombre: document.getElementById('clienteNombre').value.trim(),
    clienteRut: document.getElementById('clienteRut').value.trim(),
    clienteTel: document.getElementById('clienteTel').value.trim(),
    clienteEmail: document.getElementById('clienteEmail').value.trim(),
    direccion: document.getElementById('direccion').value.trim(),
    comuna: document.getElementById('comuna').value.trim(),
    tipoInmueble: document.querySelector('input[name="tipoInmueble"]:checked')?.value || 'Casa',
    tecnico: document.getElementById('tecnico').value.trim(),
    tipoServicio: document.getElementById('tipoServicio').value,
    descripcionServicio: document.getElementById('descripcionServicio').value.trim(),
    trabajos: getTrabajos(),
    materiales: getMateriales(),
    aplicarIva: ivaActivo(),
    subtotal, iva, total,
    observaciones: document.getElementById('observaciones').value.trim(),
    textoAntes: document.getElementById('textoAntes').value.trim(),
    textoDespues: document.getElementById('textoDespues').value.trim(),
    fotoAntes: fotoAntesBase64,
    fotoDespues: fotoDespuesBase64,
    empresa: EMPRESA,
    fechaGuardado: new Date().toISOString()
  };
}

async function guardarOrden() {
  const datos = recolectarDatos();
  if (!datos.clienteNombre || !datos.clienteTel || !datos.direccion || !datos.comuna) {
    alert('Completa al menos: Cliente, Teléfono, Dirección y Comuna.');
    return;
  }
  const res = await saveOrdenToDB(datos);
  if (res.ok) {
    ordenActualId = datos.id;
    alert('✅ Orden guardada en ' + res.donde + '\nNº ' + datos.ordenNumero);
    cargarHistorialDomicilio(datos.direccion, datos.comuna, datos.id);
  }
}

// ---------- HISTORIAL DOMICILIO ----------
async function cargarHistorialDomicilio(direccion, comuna, excludeId) {
  const lista = document.getElementById('historialLista');
  const countEl = document.getElementById('historialCount');
  if (!direccion) {
    lista.innerHTML = '<p class="hint-inline">Escribe una dirección para ver visitas anteriores en este domicilio.</p>';
    if (countEl) countEl.textContent = '';
    return;
  }
  const dirNorm = direccion.toLowerCase().trim();
  const comNorm = (comuna || '').toLowerCase().trim();
  const ordenes = await getOrdenes();
  const prev = ordenes.filter(o => {
    if (o.id === excludeId) return false;
    const d = (o.direccion || '').toLowerCase().trim();
    const c = (o.comuna || '').toLowerCase().trim();
    return d.includes(dirNorm) || dirNorm.includes(d) || (d === dirNorm && (!comNorm || c === comNorm));
  }).filter(o => {
    const d = (o.direccion || '').toLowerCase().trim();
    return d === dirNorm || d.includes(dirNorm) || dirNorm.includes(d);
  }).sort((a, b) => (b.fechaServicio || b.fechaGuardado || '').localeCompare(a.fechaServicio || a.fechaGuardado || ''));

  if (!prev.length) {
    lista.innerHTML = '<p class="hint-inline">No hay visitas anteriores registradas en este domicilio.</p>';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = prev.length + (prev.length === 1 ? ' visita' : ' visitas');
  lista.innerHTML = prev.slice(0, 10).map(o => {
    const f = o.fechaServicio || (o.fechaGuardado || '').slice(0, 10);
    return `<div class="hist-item">
      <div class="hist-fecha">${f || '—'}</div>
      <div>
        <strong>${o.tipoServicio || 'Servicio'}</strong> · Orden #${o.ordenNumero || ''} · ${o.estado || ''}
        <div class="hist-meta">${(o.trabajos || []).slice(0, 2).join(' · ') || (o.descripcionServicio || '').slice(0, 80) || ''} · $${formatCLP(o.total)}</div>
      </div>
    </div>`;
  }).join('');
}

// ---------- BUSCADOR ----------
function abrirBuscador() {
  document.getElementById('modalBuscar').classList.remove('hidden');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '<p class="hint">Busca por dirección, cliente o teléfono.</p>';
  document.getElementById('searchInput').focus();
}
function cerrarBuscador() {
  document.getElementById('modalBuscar').classList.add('hidden');
}

async function realizarBusqueda() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const box = document.getElementById('searchResults');
  if (!q) {
    box.innerHTML = '<p class="hint">Escribe algo para buscar.</p>';
    return;
  }
  box.innerHTML = '<p class="hint">Buscando...</p>';
  const ordenes = await getOrdenes();
  const fil = ordenes.filter(o =>
    (o.direccion || '').toLowerCase().includes(q) ||
    (o.comuna || '').toLowerCase().includes(q) ||
    (o.clienteNombre || '').toLowerCase().includes(q) ||
    (o.clienteRut || '').toLowerCase().includes(q) ||
    (o.clienteTel || '').toLowerCase().includes(q) ||
    (o.ordenNumero || '').toLowerCase().includes(q)
  ).sort((a, b) => (b.fechaGuardado || '').localeCompare(a.fechaGuardado || ''));

  if (!fil.length) {
    box.innerHTML = '<p class="hint">Sin resultados.</p>';
    return;
  }
  box.innerHTML = fil.map(o => `
    <div class="orden-item" data-id="${o.id}">
      <div><span class="orden-num">Nº ${o.ordenNumero}</span> · ${o.estado || ''} · ${o.tipoServicio || ''}</div>
      <div class="meta"><strong>${o.clienteNombre || ''}</strong> · ${o.clienteTel || ''}</div>
      <div class="meta">📍 ${o.direccion || ''} ${o.comuna ? ', ' + o.comuna : ''} · $${formatCLP(o.total)}</div>
    </div>
  `).join('');
  box.querySelectorAll('.orden-item').forEach(el => {
    el.addEventListener('click', () => {
      const o = fil.find(x => x.id === el.dataset.id);
      if (o) { cargarOrden(o); cerrarBuscador(); }
    });
  });
}

// ---------- PDF ----------
function generarPDF() {
  const datos = recolectarDatos();
  if (!datos.clienteNombre || !datos.direccion) {
    alert('Completa cliente y dirección antes de generar el PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 15;
  let y = 0;

  const navy = [15, 23, 42];
  const blue = [37, 99, 235];
  const soft = [241, 245, 249];
  const muted = [100, 116, 139];
  const dark = [30, 41, 59];
  const conIva = !!datos.aplicarIva;

  // ===== HEADER EMPRESA =====
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageW, 32, 'F');
  // accent line
  doc.setFillColor(...blue);
  doc.rect(0, 32, pageW, 2.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(EMPRESA.nombre, m, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(186, 200, 220);
  doc.text('RUT ' + EMPRESA.rut, m, 19);
  doc.text(EMPRESA.giro, m, 24);

  // Fecha + Nº a la derecha
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Nº ' + datos.ordenNumero, pageW - m, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(186, 200, 220);
  const fStr = datos.fechaServicio
    ? new Date(datos.fechaServicio + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  doc.text(fStr, pageW - m, 19, { align: 'right' });
  doc.text(datos.estado || '', pageW - m, 24, { align: 'right' });

  y = 42;

  // ===== BADGE TIPO SERVICIO =====
  const tipo = (datos.tipoServicio || 'Servicio').toUpperCase();
  const badgeW = Math.max(28, tipo.length * 2.8 + 8);
  doc.setFillColor(...blue);
  doc.roundedRect(m, y, badgeW, 7, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(tipo, m + badgeW / 2, y + 4.8, { align: 'center' });

  // IVA badge
  if (conIva) {
    doc.setFillColor(22, 163, 74);
    doc.roundedRect(m + badgeW + 4, y, 28, 7, 2, 2, 'F');
    doc.text('CON IVA', m + badgeW + 18, y + 4.8, { align: 'center' });
  } else {
    doc.setFillColor(100, 116, 139);
    doc.roundedRect(m + badgeW + 4, y, 28, 7, 2, 2, 'F');
    doc.text('SIN IVA', m + badgeW + 18, y + 4.8, { align: 'center' });
  }
  y += 14;

  // ===== DESCRIPCIÓN =====
  if (datos.descripcionServicio) {
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(datos.descripcionServicio, pageW - m * 2);
    doc.text(descLines, m, y);
    y += descLines.length * 4.5 + 6;
  }

  // ===== CLIENTE + DOMICILIO (dos columnas) =====
  const colW = (pageW - m * 2 - 5) / 2;
  const boxH = 32;

  // Cliente
  doc.setFillColor(...soft);
  doc.roundedRect(m, y, colW, boxH, 2.5, 2.5, 'F');
  doc.setFillColor(...blue);
  doc.rect(m, y, 2.2, boxH, 'F');
  doc.setTextColor(...blue);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CLIENTE', m + 6, y + 7);
  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(datos.clienteNombre || '—', m + 6, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('Tel: ' + (datos.clienteTel || '—'), m + 6, y + 20);
  doc.text('RUT: ' + (datos.clienteRut || '—'), m + 6, y + 25);
  if (datos.clienteEmail) doc.text(datos.clienteEmail, m + 6, y + 29.5);

  // Domicilio
  const sx = m + colW + 5;
  doc.setFillColor(...soft);
  doc.roundedRect(sx, y, colW, boxH, 2.5, 2.5, 'F');
  doc.setFillColor(...blue);
  doc.rect(sx, y, 2.2, boxH, 'F');
  doc.setTextColor(...blue);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DOMICILIO', sx + 6, y + 7);
  doc.setTextColor(...dark);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const dirLines = doc.splitTextToSize(datos.direccion || '—', colW - 12);
  doc.text(dirLines, sx + 6, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  let dy = y + 14 + dirLines.length * 4;
  doc.text((datos.comuna || '') + '  ·  ' + (datos.tipoInmueble || ''), sx + 6, dy);
  if (datos.tecnico) doc.text('Técnico: ' + datos.tecnico, sx + 6, dy + 5);

  y += boxH + 10;

  // ===== TRABAJOS =====
  if (datos.trabajos && datos.trabajos.length) {
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TRABAJOS REALIZADOS', m, y);
    y += 2;
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.6);
    doc.line(m, y + 1, m + 42, y + 1);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...dark);
    datos.trabajos.forEach((t, i) => {
      doc.setFillColor(...blue);
      doc.circle(m + 1.5, y - 1.2, 1.1, 'F');
      const lines = doc.splitTextToSize(t, pageW - m * 2 - 8);
      doc.text(lines, m + 6, y);
      y += lines.length * 4.3 + 2.5;
      if (y > 250) { doc.addPage(); y = 20; }
    });
    y += 3;
  }

  // ===== MATERIALES =====
  if (datos.materiales && datos.materiales.length) {
    if (y > 210) { doc.addPage(); y = 20; }
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('MATERIALES Y SERVICIOS', m, y);
    y += 2;
    doc.setDrawColor(...blue);
    doc.line(m, y + 1, m + 48, y + 1);
    y += 6;

    const headCols = conIva
      ? [['Cant.', 'Producto / Servicio', 'Precio neto', 'Total c/IVA']]
      : [['Cant.', 'Producto / Servicio', 'Precio', 'Total']];

    doc.autoTable({
      startY: y,
      head: headCols,
      body: datos.materiales.map(r => [
        String(r.cantidad),
        r.descripcion,
        '$ ' + formatCLP(r.precioNeto),
        '$ ' + formatCLP(r.totalLinea)
      ]),
      margin: { left: m, right: m },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: dark,
        lineColor: [226, 232, 240],
        lineWidth: 0.3
      },
      headStyles: {
        fillColor: navy,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3.5
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 34, halign: 'right' },
        3: { cellWidth: 34, halign: 'right', fontStyle: 'bold' }
      },
      theme: 'grid'
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ===== TOTALES =====
  if (y > 240) { doc.addPage(); y = 20; }
  const boxW = 78;
  const boxX = pageW - m - boxW;
  const boxH2 = conIva ? 36 : 28;

  doc.setFillColor(...soft);
  doc.roundedRect(boxX, y, boxW, boxH2, 3, 3, 'F');
  doc.setFillColor(...blue);
  doc.rect(boxX, y, 2.5, boxH2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let ry = y + 8;
  doc.setTextColor(...muted);
  doc.text(conIva ? 'Subtotal neto' : 'Subtotal', boxX + 7, ry);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text('$ ' + formatCLP(datos.subtotal), boxX + boxW - 5, ry, { align: 'right' });

  if (conIva) {
    ry += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.text('IVA 19%', boxX + 7, ry);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'bold');
    doc.text('$ ' + formatCLP(datos.iva), boxX + boxW - 5, ry, { align: 'right' });
  }

  // Total bar
  const totY = y + boxH2 - 12;
  doc.setFillColor(...navy);
  doc.roundedRect(boxX, totY, boxW, 12, 0, 0, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL', boxX + 7, totY + 8);
  doc.setFontSize(12);
  doc.text('$ ' + formatCLP(datos.total), boxX + boxW - 5, totY + 8, { align: 'right' });

  // Nota IVA
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text(conIva ? 'Documento con IVA (cliente empresa)' : 'Documento sin IVA (cliente particular)', m, y + 8);

  y = Math.max(y + boxH2 + 10, totY + 18);

  // ===== ANTES / DESPUÉS =====
  if (datos.textoAntes || datos.textoDespues || datos.fotoAntes || datos.fotoDespues) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ANTES Y DESPUÉS', m, y);
    y += 2;
    doc.setDrawColor(...blue);
    doc.line(m, y + 1, m + 40, y + 1);
    y += 7;

    const half = (pageW - m * 2 - 6) / 2;
    // Antes box
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(m, y, half, 28, 2, 2, 'F');
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ANTES', m + 4, y + 6);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (datos.textoAntes) {
      const al = doc.splitTextToSize(datos.textoAntes, half - 8);
      doc.text(al.slice(0, 4), m + 4, y + 12);
    }
    // Después box
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(m + half + 6, y, half, 28, 2, 2, 'F');
    doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DESPUÉS', m + half + 10, y + 6);
    doc.setTextColor(...dark);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (datos.textoDespues) {
      const dl = doc.splitTextToSize(datos.textoDespues, half - 8);
      doc.text(dl.slice(0, 4), m + half + 10, y + 12);
    }
    y += 34;

    // Fotos si caben (pequeñas)
    try {
      if (datos.fotoAntes) {
        doc.addImage(datos.fotoAntes, 'JPEG', m, y, 40, 30);
      }
      if (datos.fotoDespues) {
        doc.addImage(datos.fotoDespues, 'JPEG', m + half + 6, y, 40, 30);
      }
      if (datos.fotoAntes || datos.fotoDespues) y += 34;
    } catch (e) {
      console.warn('No se pudieron incrustar fotos en PDF', e);
    }
  }

  // ===== OBSERVACIONES =====
  if (datos.observaciones) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OBSERVACIONES', m, y);
    y += 2;
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.5);
    doc.line(m, y + 1, m + 36, y + 1);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...dark);
    const ol = doc.splitTextToSize(datos.observaciones, pageW - m * 2);
    doc.text(ol, m, y);
    y += ol.length * 4.2 + 6;
  }

  // ===== PIE =====
  doc.setFillColor(...navy);
  doc.rect(0, pageH - 12, pageW, 12, 'F');
  doc.setTextColor(160, 175, 195);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    EMPRESA.nombre + '  ·  RUT ' + EMPRESA.rut + '  ·  Gracias por confiar en nosotros',
    pageW / 2, pageH - 5, { align: 'center' }
  );

  const name = `Orden_${datos.ordenNumero}_${(datos.comuna || 'elfagas').replace(/\s/g, '')}.pdf`;
  doc.save(name);
}

// ---------- REPORTE ----------
const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function abrirReporte() {
  const now = new Date();
  document.getElementById('reporteMes').value = String(now.getMonth() + 1);
  document.getElementById('reporteAnio').value = now.getFullYear();
  document.getElementById('reporteResumen').innerHTML = '<p class="hint">Elige mes y año.</p>';
  document.getElementById('btnPdfReporte').disabled = true;
  ultimoReporte = null;
  document.getElementById('modalReporte').classList.remove('hidden');
}
function cerrarReporte() {
  document.getElementById('modalReporte').classList.add('hidden');
}

async function generarReporteMensual() {
  const mes = parseInt(document.getElementById('reporteMes').value, 10);
  const anio = parseInt(document.getElementById('reporteAnio').value, 10);
  const box = document.getElementById('reporteResumen');
  box.innerHTML = '<p class="hint">Cargando...</p>';
  const ordenes = await getOrdenes();
  const fil = ordenes.filter(o => {
    const raw = o.fechaServicio || o.fechaGuardado || '';
    if (!raw) return false;
    const d = new Date(raw);
    return !isNaN(d) && d.getMonth() + 1 === mes && d.getFullYear() === anio;
  });
  const ventas = fil.filter(o => o.estado !== 'CANCELADO');
  const total = ventas.reduce((s, o) => s + (parseNumber(o.total) || 0), 0);
  ultimoReporte = { mes, anio, mesNombre: MESES[mes], ventas, total, cantidad: ventas.length };

  if (!fil.length) {
    box.innerHTML = `<p class="hint">Sin órdenes en ${MESES[mes]} ${anio}.</p>`;
    document.getElementById('btnPdfReporte').disabled = true;
    return;
  }
  box.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
      <div style="background:#eff6ff;padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:0.75rem;color:#64748b;">Órdenes</div>
        <div style="font-size:1.4rem;font-weight:700;">${ventas.length}</div>
      </div>
      <div style="background:#ecfdf5;padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:0.75rem;color:#64748b;">Ingresos</div>
        <div style="font-size:1.4rem;font-weight:700;color:#15803d;">$${formatCLP(total)}</div>
      </div>
    </div>
    <table class="table"><thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Dirección</th><th>Total</th></tr></thead>
    <tbody>${ventas.map(o => `<tr>
      <td>${o.ordenNumero}</td>
      <td>${(o.fechaServicio || '').slice(0, 10)}</td>
      <td>${o.clienteNombre || ''}</td>
      <td>${o.direccion || ''}</td>
      <td>$${formatCLP(o.total)}</td>
    </tr>`).join('')}</tbody></table>`;
  document.getElementById('btnPdfReporte').disabled = false;
}

function generarPdfReporte() {
  if (!ultimoReporte) return;
  const r = ultimoReporte;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const m = 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(EMPRESA.nombre, m, 16);
  doc.setFontSize(11);
  doc.text(`Reporte de ventas — ${r.mesNombre} ${r.anio}`, m, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Órdenes: ${r.cantidad}   ·   Ingresos: $ ${formatCLP(r.total)}`, m, 32);
  doc.autoTable({
    startY: 38,
    head: [['Nº', 'Fecha', 'Cliente', 'Dirección', 'Total']],
    body: r.ventas.map(o => [
      o.ordenNumero || '',
      (o.fechaServicio || '').slice(0, 10),
      o.clienteNombre || '',
      o.direccion || '',
      '$ ' + formatCLP(o.total)
    ]),
    margin: { left: m, right: m },
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] }
  });
  doc.save(`Reporte_ELFAGAS_${r.mesNombre}_${r.anio}.pdf`);
}


// ---------- AGENDA DEL DÍA ----------
function abrirAgenda() {
  document.getElementById('agendaFecha').value = todayISO();
  document.getElementById('modalAgenda').classList.remove('hidden');
  cargarAgenda();
}
function cerrarAgenda() {
  document.getElementById('modalAgenda').classList.add('hidden');
}

async function cargarAgenda() {
  const fecha = document.getElementById('agendaFecha').value;
  const lista = document.getElementById('agendaLista');
  const stats = document.getElementById('agendaResumen');
  if (!fecha) {
    lista.innerHTML = '<p class="hint">Elige una fecha.</p>';
    return;
  }
  lista.innerHTML = '<p class="hint">Cargando...</p>';
  const ordenes = await getOrdenes();
  const delDia = ordenes.filter(o => {
    const f = (o.fechaServicio || o.fechaGuardado || '').slice(0, 10);
    return f === fecha;
  }).sort((a, b) => (a.ordenNumero || '').localeCompare(b.ordenNumero || ''));

  const pendientes = delDia.filter(o => o.estado === 'PENDIENTE' || o.estado === 'EN CAMINO').length;
  const finalizados = delDia.filter(o => o.estado === 'FINALIZADO').length;
  const total = delDia.reduce((s, o) => s + (parseNumber(o.total) || 0), 0);

  stats.innerHTML = `
    <div class="agenda-stat"><div class="num">${delDia.length}</div><div class="lbl">Órdenes</div></div>
    <div class="agenda-stat"><div class="num">${pendientes}</div><div class="lbl">Pendientes / en camino</div></div>
    <div class="agenda-stat"><div class="num">$${formatCLP(total)}</div><div class="lbl">Total del día</div></div>
  `;

  if (!delDia.length) {
    lista.innerHTML = '<p class="hint">No hay órdenes para esta fecha.</p>';
    return;
  }

  lista.innerHTML = delDia.map(o => {
    const est = (o.estado || 'PENDIENTE').replace(/ /g, '\\ ');
    return `<div class="agenda-item" data-id="${o.id}">
      <span class="agenda-estado est-${(o.estado || 'PENDIENTE').replace(/ /g, '-')}">${o.estado || ''}</span>
      <div style="flex:1;">
        <div><strong>Nº ${o.ordenNumero}</strong> · ${o.tipoServicio || ''} · $${formatCLP(o.total)}</div>
        <div class="meta" style="font-size:0.85rem;color:#64748b;margin-top:2px;">
          ${o.clienteNombre || ''} · ${o.clienteTel || ''}<br>
          📍 ${o.direccion || ''}${o.comuna ? ', ' + o.comuna : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  lista.querySelectorAll('.agenda-item').forEach(el => {
    el.addEventListener('click', () => {
      const o = delDia.find(x => x.id === el.dataset.id);
      if (o) { cargarOrden(o); cerrarAgenda(); }
    });
  });
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.supabase) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = () => initSupabase();
    document.head.appendChild(s);
  } else {
    initSupabase();
  }

  await limpiarFormulario();

  // Chips tipo servicio
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('tipoServicio').value = chip.dataset.tipo;
    });
  });

  document.getElementById('btnAddTrabajo').addEventListener('click', () => addTrabajo());
  document.getElementById('btnAddMaterial').addEventListener('click', () => addMaterial());
  document.getElementById('aplicarIva')?.addEventListener('change', () => calcularTotales());
  document.getElementById('btnGuardar').addEventListener('click', guardarOrden);
  document.getElementById('btnGenerarPdf').addEventListener('click', generarPDF);
  document.getElementById('btnNueva').addEventListener('click', async () => {
    if (confirm('¿Nueva orden? Se perderán datos no guardados.')) await limpiarFormulario();
  });
  document.getElementById('btnBuscar').addEventListener('click', abrirBuscador);
  document.getElementById('cerrarModal').addEventListener('click', cerrarBuscador);
  document.getElementById('btnDoSearch').addEventListener('click', realizarBusqueda);
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') realizarBusqueda();
  });
  document.getElementById('btnAgenda').addEventListener('click', abrirAgenda);
  document.getElementById('cerrarModalAgenda').addEventListener('click', cerrarAgenda);
  document.getElementById('btnCargarAgenda').addEventListener('click', cargarAgenda);
  document.getElementById('modalAgenda').addEventListener('click', e => {
    if (e.target.id === 'modalAgenda') cerrarAgenda();
  });
  document.getElementById('fotoAntes')?.addEventListener('change', e => {
    leerFoto(e.target, 'previewAntes', d => { fotoAntesBase64 = d; });
  });
  document.getElementById('fotoDespues')?.addEventListener('change', e => {
    leerFoto(e.target, 'previewDespues', d => { fotoDespuesBase64 = d; });
  });
  document.getElementById('btnReporte').addEventListener('click', abrirReporte);
  document.getElementById('cerrarModalReporte').addEventListener('click', cerrarReporte);
  document.getElementById('btnGenerarReporte').addEventListener('click', generarReporteMensual);
  document.getElementById('btnPdfReporte').addEventListener('click', generarPdfReporte);

  document.getElementById('modalBuscar').addEventListener('click', e => {
    if (e.target.id === 'modalBuscar') cerrarBuscador();
  });
  document.getElementById('modalReporte').addEventListener('click', e => {
    if (e.target.id === 'modalReporte') cerrarReporte();
  });

  // Al cambiar dirección, intentar cargar historial
  let histTimer;
  ['direccion', 'comuna'].forEach(id => {
    document.getElementById(id).addEventListener('blur', () => {
      clearTimeout(histTimer);
      histTimer = setTimeout(() => {
        const dir = document.getElementById('direccion').value.trim();
        const com = document.getElementById('comuna').value.trim();
        if (dir) cargarHistorialDomicilio(dir, com, ordenActualId);
      }, 300);
    });
  });
});
