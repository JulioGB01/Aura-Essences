// Utilidades compartidas (app y reporte PDF)
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function num(x) { const n = parseFloat(x); return isNaN(n) ? 0 : n; }
function bs(x, dec) {
  const n = num(x);
  const d = dec ?? (Math.abs(n) >= 1000 ? 0 : 2);
  return "Bs " + n.toLocaleString("es-BO", {minimumFractionDigits: d, maximumFractionDigits: d});
}
function n0(x) { return num(x).toLocaleString("es-BO", {maximumFractionDigits: 0}); }
function n1(x) { return num(x).toLocaleString("es-BO", {maximumFractionDigits: 1}); }
function pct(x, d = 1) { if (x === null || x === undefined) return "—"; return (num(x) * 100).toLocaleString("es-BO", {minimumFractionDigits: d, maximumFractionDigits: d}) + "%"; }
function fecha(f) { if (!f) return ""; const [y, m, d] = f.slice(0, 10).split("-"); return `${d}/${m}/${y}`; }
function mesTxt(ym) { if (!ym) return ""; const [y, m] = ym.split("-"); return `${MESES[+m - 1]} ${y}`; }
function mesCorto(ym) { const [y, m] = ym.split("-"); return MESES[+m - 1].slice(0, 3) + " " + y.slice(2); }
function cls(v) { return num(v) < 0 ? "neg" : ""; }
function delta(a, b) {
  if (!num(b)) return "";
  const d = (num(a) - num(b)) / Math.abs(num(b));
  return `<span class="delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${pct(Math.abs(d), 0)}</span>`;
}

async function api(path, opts = {}) {
  const method = opts.method || "GET";
  const body = opts.body === undefined ? undefined : JSON.parse(JSON.stringify(opts.body));
  const r = Aura.request(method, path, body);
  if (method !== "GET") Sync.afterWrite();
  return JSON.parse(JSON.stringify(r));
}

// Gráfico de barras agrupadas (SVG). series: [{name, color, values:[]}]
function barChart(labels, series, opts = {}) {
  const W = opts.width || 760, H = opts.height || 260, pl = 64, pr = 12, pt = 16, pb = 34;
  const all = series.flatMap(s => s.values.map(num));
  let max = Math.max(0, ...all), min = Math.min(0, ...all);
  if (max === min) max = min + 1;
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1))); return Math.ceil(v / p) * p; };
  max = nice(max); if (min < 0) min = -nice(-min);
  const y = v => pt + (H - pt - pb) * (max - v) / (max - min);
  const gw = (W - pl - pr) / Math.max(labels.length, 1);
  const bw = Math.max(3, Math.min(26, (gw - 8) / series.length));
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, yy = y(v);
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" class="grid"/>`;
    svg += `<text x="${pl - 6}" y="${yy + 4}" text-anchor="end" class="axis">${Math.abs(v) >= 1000 ? n1(v / 1000) + "k" : n0(v)}</text>`;
  }
  svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" class="zero"/>`;
  labels.forEach((lab, i) => {
    const gx = pl + gw * i + (gw - bw * series.length) / 2;
    series.forEach((s, j) => {
      const v = num(s.values[i]);
      const y0 = y(Math.max(v, 0)), h = Math.abs(y(v) - y(0));
      svg += `<rect x="${gx + j * bw}" y="${y0}" width="${bw - 2}" height="${Math.max(h, 0.5)}" rx="2" fill="${v < 0 ? "var(--bad)" : s.color}"><title>${esc(s.name)} · ${esc(lab)}: ${bs(v)}</title></rect>`;
    });
    if (labels.length <= 14 || i % Math.ceil(labels.length / 14) === 0)
      svg += `<text x="${pl + gw * i + gw / 2}" y="${H - pb + 16}" text-anchor="middle" class="axis">${esc(lab)}</text>`;
  });
  svg += `</svg>`;
  const legend = `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  return legend + svg;
}

// Barras horizontales simples: items [{label, value}]
function hBars(items, color = "var(--accent)", fmt = bs) {
  const max = Math.max(...items.map(i => Math.abs(num(i.value))), 1);
  return `<div class="hbars">${items.map(i => `
    <div class="hbar"><span class="hl" title="${esc(i.label)}">${esc(i.label)}</span>
      <span class="ht"><span class="hf" style="width:${Math.abs(num(i.value)) / max * 100}%;background:${num(i.value) < 0 ? "var(--bad)" : color}"></span></span>
      <span class="hv ${cls(i.value)}">${fmt(i.value)}</span></div>`).join("")}</div>`;
}

function badgeNivel(n, txt) { return `<span class="badge b-${n}">${esc(txt)}</span>`; }
const NIVEL_ICON = {ok: "✅", warn: "⚠️", bad: "⛔"};

function waLink(wa, texto = "") { return wa ? `https://wa.me/${wa}${texto ? "?text=" + encodeURIComponent(texto) : ""}` : null; }
const SEG_COLOR = { "Frecuente": "ok", "Activo": "ok", "Nuevo": "n", "En riesgo": "warn", "Perdido": "bad", "Sin compras": "n" };
