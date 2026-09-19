/**
 * API reporte mensual ELFAGAS — Vercel Cron
 * Día 1 de cada mes → envía resumen del MES ANTERIOR solo a ADMIN_EMAIL
 *
 * En Vercel → Settings → Environment Variables:
 *   RESEND_API_KEY = re_xxxx
 */

// ============================================================
//  >>>  MODIFICA AQUÍ TU GMAIL (no aparece en la web)
// ============================================================
const ADMIN_EMAIL = 'tu-correo@gmail.com';
// Ejemplo: const ADMIN_EMAIL = 'elfagas.admin@gmail.com';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kwgwsixsmppxibayxzor.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Z3dzaXhzbXBweGliYXl4em9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1OTE0NTYsImV4cCI6MjEwNTE2NzQ1Nn0.GMCXMDpvqBfycI9FXBeri-ixUae4U8h9MqqPXkcqKZg';

const TABLA = 'ordenes_elfagas';

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatCLP(n) {
  return new Intl.NumberFormat('es-CL').format(Math.round(n || 0));
}

function periodoAnterior() {
  const now = new Date();
  let mes = now.getUTCMonth(); // 0-11 → mes anterior
  let anio = now.getUTCFullYear();
  if (mes === 0) {
    mes = 12;
    anio -= 1;
  }
  return { mes, anio };
}

async function fetchOrdenes() {
  const url = `${SUPABASE_URL}/rest/v1/${TABLA}?select=*&order=fecha_guardado.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) throw new Error('Supabase: ' + res.status + ' ' + (await res.text()));
  const rows = await res.json();
  return (rows || []).map((row) => {
    const d = row.datos || {};
    return {
      ...d,
      id: row.id,
      ordenNumero: row.orden_numero || d.ordenNumero,
      clienteNombre: row.cliente_nombre || d.clienteNombre,
      direccion: row.direccion || d.direccion,
      comuna: row.comuna || d.comuna,
      fechaGuardado: row.fecha_guardado || d.fechaGuardado,
      fechaServicio: d.fechaServicio,
      total: d.total,
      aplicarIva: d.aplicarIva,
      estado: d.estado,
      tipoServicio: d.tipoServicio
    };
  });
}

function filtrarMes(ordenes, mes, anio) {
  return ordenes.filter((o) => {
    const raw = o.fechaServicio || o.fechaGuardado || '';
    if (!raw) return false;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return false;
    return d.getMonth() + 1 === mes && d.getFullYear() === anio;
  });
}

function armarReporte(ordenes, mes, anio) {
  const ventas = ordenes.filter((o) => (o.estado || '') !== 'CANCELADO');
  const canceladas = ordenes.filter((o) => (o.estado || '') === 'CANCELADO');
  const totalIngresos = ventas.reduce((s, o) => s + (Number(o.total) || 0), 0);
  return {
    mes,
    anio,
    mesNombre: MESES[mes],
    cantidad: ventas.length,
    canceladas: canceladas.length,
    totalIngresos,
    ventas
  };
}

function htmlEmail(r) {
  const filas = r.ventas
    .map((o) => {
      const f = o.fechaServicio
        ? new Date(o.fechaServicio + 'T12:00:00').toLocaleDateString('es-CL')
        : '—';
      return `<tr>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${o.ordenNumero || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${f}</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${o.clienteNombre || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;">${o.direccion || ''}</td>
        <td style="padding:6px;border-bottom:1px solid #e2e8f0;text-align:right;">$${formatCLP(o.total)}</td>
      </tr>`;
    })
    .join('');

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <div style="background:#0f172a;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <h2 style="margin:0;font-size:18px;">ELFAGAS — Reporte de ventas</h2>
      <p style="margin:6px 0 0;opacity:0.85;">${r.mesNombre} ${r.anio}</p>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
      <p style="font-size:15px;">
        Órdenes: <strong>${r.cantidad}</strong><br/>
        Ingresos: <strong>$${formatCLP(r.totalIngresos)}</strong><br/>
        Canceladas: <strong>${r.canceladas}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
        <thead>
          <tr style="background:#0f172a;color:#fff;">
            <th style="padding:8px;text-align:left;">Nº</th>
            <th style="padding:8px;text-align:left;">Fecha</th>
            <th style="padding:8px;text-align:left;">Cliente</th>
            <th style="padding:8px;text-align:left;">Dirección</th>
            <th style="padding:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${filas || '<tr><td colspan="5" style="padding:10px;">Sin órdenes</td></tr>'}</tbody>
      </table>
      <p style="font-size:11px;color:#94a3b8;margin-top:20px;">Uso interno · Enviado automáticamente</p>
    </div>
  </div>`;
}

async function enviarConResend(asunto, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Falta RESEND_API_KEY en Vercel');
  if (!ADMIN_EMAIL || ADMIN_EMAIL === 'tu-correo@gmail.com') {
    throw new Error('Configura ADMIN_EMAIL en api/reporte-mensual.js');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'ELFAGAS <onboarding@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: asunto,
      html
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || JSON.stringify(data) || 'Error Resend');
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let mes, anio;
    if (req.method === 'POST' && req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.mes && body.anio) {
        mes = Number(body.mes);
        anio = Number(body.anio);
      }
    }
    if (!mes || !anio) {
      const p = periodoAnterior();
      mes = p.mes;
      anio = p.anio;
    }

    const todas = await fetchOrdenes();
    const delMes = filtrarMes(todas, mes, anio);
    const reporte = armarReporte(delMes, mes, anio);
    const asunto = `Reporte ELFAGAS ${reporte.mesNombre} ${reporte.anio}`;
    const envio = await enviarConResend(asunto, htmlEmail(reporte));

    return res.status(200).json({
      ok: true,
      periodo: `${reporte.mesNombre} ${reporte.anio}`,
      ordenes: reporte.cantidad,
      ingresos: reporte.totalIngresos,
      enviadoA: ADMIN_EMAIL,
      resend: envio
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
