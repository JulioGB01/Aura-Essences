// Aura Essences — interfaz
const S = { boot: null, cart: null };
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const MAIN = () => $("#main");

const NAV = [
  ["inicio", "🏠", "Inicio"],
  ["vender", "🛒", "Vender"],
  ["ventas", "🧾", "Ventas"],
  ["productos", "🧴", "Productos"],
  ["compras", "📦", "Compras"],
  ["clientes", "👥", "Clientes"],
  ["gastos", "💸", "Gastos"],
  "-",
  ["salud", "📈", "Salud del negocio"],
  ["ajustes", "⚙️", "Ajustes"],
];

// ================================================================== base
function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (err ? " err" : "");
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = ""), err ? 4500 : 2600);
}
async function safe(fn) { try { return await fn(); } catch (e) { toast(e.message, true); throw e; } }
async function reloadBoot() {
  S.boot = await api("bootstrap");
  $("#dl-perfumes").innerHTML = S.boot.perfumes.filter(p => p.activo).map(p => `<option value="${esc(perfLabel(p))}">`).join("");
  $("#dl-clientes").innerHTML = S.boot.clientes.map(c => `<option value="${esc(c.nombre)}">`).join("");
  $("#dl-proveedores").innerHTML = S.boot.proveedores.map(c => `<option value="${esc(c.nombre)}">`).join("");
  $("#dl-categorias").innerHTML = S.boot.categorias_gasto.map(c => `<option value="${esc(c)}">`).join("");
}
const perfLabel = p => p.marca ? `${p.nombre} — ${p.marca}` : p.nombre;
function perfByLabel(txt) {
  const t = (txt || "").trim().toLowerCase();
  if (!t) return null;
  return S.boot.perfumes.find(p => perfLabel(p).toLowerCase() === t) || S.boot.perfumes.find(p => p.nombre.toLowerCase() === t) || null;
}
const perfById = id => S.boot.perfumes.find(p => p.id === +id);
const hoy = () => S.boot?.hoy || new Date().toISOString().slice(0, 10);
const mesActual = () => hoy().slice(0, 7);
function lastMonths(n) {
  const out = []; let [y, m] = mesActual().split("-").map(Number);
  for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, "0")}`); m--; if (!m) { m = 12; y--; } }
  return out;
}
// Barra inferior del celular: lo de todos los días a un toque; el resto en "Más".
const TABS = [["inicio", "🏠", "Inicio"], ["productos", "🧴", "Stock"], ["vender", "🛒", "Vender"], ["clientes", "👥", "Clientes"]];
function renderTabbar(page) {
  const tb = $("#tabbar");
  if (!tb) return;
  const enMas = !TABS.some(t => t[0] === page);
  tb.innerHTML = TABS.map(t => `<a href="#${t[0]}" class="${t[0] === page ? "active" : ""} ${t[0] === "vender" ? "main" : ""}" aria-current="${t[0] === page ? "page" : "false"}">
      <span class="ico" aria-hidden="true">${t[1]}</span><span>${t[2]}</span></a>`).join("") +
    `<button type="button" class="${enMas ? "active" : ""}" onclick="abrirMas()"><span class="ico" aria-hidden="true">☰</span><span>Más</span></button>`;
}
function abrirMas() {
  const items = [["ventas", "🧾", "Ventas", "Historial, corregir o anular"], ["compras", "📦", "Compras", "Lo que entra al stock"],
    ["gastos", "💸", "Gastos", "Envíos, publicidad, retiros"], ["salud", "📈", "Salud del negocio", "Ganancia, márgenes, consejos"],
    ["ajustes", "⚙️", "Ajustes", "Sincronizar, conexión, reglas"]];
  modal("Más opciones", `<div class="mas">${items.map(i => `<a href="#${i[0]}" onclick="closeModals()"><span class="ico" aria-hidden="true">${i[1]}</span>
    <span><b>${i[2]}</b><small>${i[3]}</small></span></a>`).join("")}</div>`, null);
}
function renderNav(page) {
  renderTabbar(page);
  $("#nav").innerHTML = `<div class="brand">${esc(S.boot?.config?.negocio || "Aura Essences")}<small>Perfumería · decants</small></div>` +
    NAV.map(n => n === "-" ? `<div class="sep"></div>` :
      `<a href="#${n[0]}" class="${n[0] === page ? "active" : ""}"><span class="ico">${n[1]}</span>${n[2]}</a>`).join("");
}
async function route() {
  const [page, arg] = (location.hash.slice(1) || "inicio").split("/");
  const fn = PAGES[page] || PAGES.inicio;
  renderNav(PAGES[page] ? page : "inicio");
  const el = MAIN();
  el.innerHTML = `<div class="empty">Cargando…</div>`;
  try { await fn(el, arg ? decodeURIComponent(arg) : undefined); }
  catch (e) { el.innerHTML = `<div class="card"><b>Ocurrió un problema:</b> ${esc(e.message)}</div>`; console.error(e); }
}
const refresh = async () => { await reloadBoot(); route(); };

// ================================================================== formularios
function F(label, name, value = "", type = "text", extra = "") {
  return `<label class="f">${label}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${type === "number" ? 'step="any"' : ""} ${extra}></label>`;
}
function Sel(label, name, options, value, extra = "") {
  return `<label class="f">${label}<select name="${name}" ${extra}>${options.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(value ?? "") ? "selected" : ""}>${esc(t)}</option>`;
  }).join("")}</select></label>`;
}
function Chk(label, name, checked = true) { return `<label class="chk"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</label>`; }
function readForm(el) {
  const o = {};
  $$("[name]", el).forEach(i => {
    if (i.type === "checkbox") o[i.name] = i.checked;
    else if (i.type === "number") o[i.name] = i.value === "" ? "" : num(i.value);
    else o[i.name] = i.value.trim();
  });
  return o;
}
function modal(title, body, onSave, saveLabel = "Guardar", opts = {}) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" style="${opts.wide ? "width:min(900px,100%)" : ""}"><h2>${title}</h2><div class="mb">${body}</div>
    <div class="actions">${opts.extraBtn || ""}<button data-x>${onSave ? "Cancelar" : "Cerrar"}</button>${onSave ? `<button class="primary" data-ok>${saveLabel}</button>` : ""}</div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  bg._close = close;
  bg.addEventListener("mousedown", e => { if (e.target === bg) close(); });
  $("[data-x]", bg).onclick = close;
  if (onSave) $("[data-ok]", bg).onclick = async () => {
    const btn = $("[data-ok]", bg); btn.disabled = true;
    try { const r = await onSave(readForm($(".mb", bg)), bg); if (r !== false) close(); }
    catch (e) { toast(e.message, true); }
    finally { btn.disabled = false; }
  };
  const first = $(".mb input:not([type=checkbox]),.mb select", bg); if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
  return bg;
}
const closeModals = () => $$(".modal-bg").forEach(m => m.remove());
const confirmar = msg => window.confirm(msg);
function stockCell(p) {
  const parts = [];
  if (p.frascos > 0) parts.push(`<b>${n0(p.frascos)}</b> cerrado${p.frascos === 1 ? "" : "s"}`);
  if (p.ml > 0.5) parts.push(`${n0(p.ml)} ml abiertos`);
  if (p.ml < -0.5 || p.frascos < 0) parts.push(`<span class="neg">${n0(p.ml)} ml / ${n0(p.frascos)} fr. (revisar)</span>`);
  return parts.join(" · ") || `<span class="hint">sin stock</span>`;
}
function stockBar(p) {
  if (p.ml <= 0.5) return "";
  const c = p.ml < num(S.boot.config.stock_bajo_ml) ? "#e67e22" : "var(--ok)";
  return `<div class="bar" title="${n1(p.ml)} de ${n0(p.vol_ml)} ml"><span style="width:${Math.min(1, Math.max(0, p.pct)) * 100}%;background:${c}"></span></div>`;
}
function estadoBadge(p) {
  if (p.ml < -0.5 || p.frascos < 0) return badgeNivel("bad", "Revisar");
  if (p.estado === "agotado") return badgeNivel("n", "Sin stock");
  if (p.estado === "bajo") return badgeNivel("warn", "Se acaba");
  if (p.quieto) return `<span class="badge b-mid">Quieto</span>`;
  return badgeNivel("ok", "OK");
}
const waBtn = (wa, texto, label = "WhatsApp") => wa ? `<a class="wa" target="_blank" href="${waLink(wa, texto)}">💬 ${label}</a>` : "";

// ================================================================== INICIO
async function pgInicio(el) {
  const D = await api("inicio");
  const P = D.pendientes, cfg = S.boot.config;
  const ventas = await api("ventas?limit=5");
  const top = (arr, n = 3) => arr.slice(0, n);
  const fila = (txt, extra = "") => `<div class="item"><span class="grow">${txt}</span>${extra}</div>`;
  const wa = (w, msg, id) => waBtn(w, msg, "WhatsApp") || `<a href="#clientes/${id}" class="hint">+ teléfono</a>`;
  const grupos = [];
  if (P.reponer.length) grupos.push(["🔁", "Reponer", P.reponer.length, top(P.reponer).map(p => fila(`<b>${esc(p.nombre)}</b> <span class="hint">${stockCell(p)}</span>`)).join("")]);
  if (P.ofrecer.length) grupos.push(["🎯", "Ofrecer el frasco", P.ofrecer.length, top(P.ofrecer).map(o => fila(`<b>${esc(o.cliente)}</b> <span class="hint">probó ${esc(o.perfume)}</span>`,
    wa(o.wa, `Hola ${o.cliente}! ¿Qué tal te fue con el ${o.perfume}? Tengo el frasco completo${o.precio ? " a Bs " + n0(o.precio) : ""}. ¿Te lo separo?`, o.cliente_id))).join("")]);
  if (P.escribir.length) grupos.push(["💬", "Clientes que no vuelven", P.escribir.length, top(P.escribir).map(c => fila(`<b>${esc(c.nombre)}</b> <span class="hint">hace ${c.dias} días</span>`,
    wa(c.wa, `Hola ${c.nombre}! Te escribo de ${cfg.negocio}. Llegaron novedades que te pueden gustar 😊`, c.id))).join("")]);
  const avisos = [];
  if (P.negativos.length) avisos.push(`Stock negativo en ${P.negativos.length} perfume(s): usa <b>Contar</b> en Stock.`);
  if (P.insumos_bajos.length) avisos.push(`Comprar insumos: ${P.insumos_bajos.map(i => esc(i.nombre)).join(", ")}.`);
  if (P.frascos_viejos.length) avisos.push(`${P.frascos_viejos.length} frascos abiertos hace mucho: conviene moverlos.`);
  if (P.quietos.length) avisos.push(`${P.quietos.length} perfumes sin venderse hace más de ${cfg.dias_sin_venta} días. <a href="#productos/quietos">Ver</a>`);
  if (avisos.length) grupos.push(["⚠️", "Avisos", avisos.length, avisos.map(t => fila(t)).join("")]);
  const vsMes = D.mes_ant.ventas ? delta(D.mes.ventas, D.mes_ant.ventas) : "";
  el.innerHTML = `
    <p class="sub hoy">${fecha(hoy())}</p>
    <button class="primary big vender" onclick="location.hash='vender'">🛒 Nueva venta</button>
    <div class="quick3">
      <button onclick="nuevaCompra()">📦<span>Compra</span></button>
      <button onclick="editarCliente()">👤<span>Cliente</span></button>
      <button onclick="salida()">🎁<span>Regalo o pérdida</span></button>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="l">Hoy</div><div class="v">${bs(D.hoy.ventas, 0)}</div><div class="s">${D.hoy.n} venta${D.hoy.n === 1 ? "" : "s"}</div></div>
      <div class="kpi"><div class="l">Este mes</div><div class="v">${bs(D.mes.ventas, 0)}</div><div class="s">${D.mes.n} ventas ${vsMes}</div></div>
      <div class="kpi"><div class="l">Ganancia del mes</div><div class="v">${bs(D.mes.ganancia, 0)}</div><div class="s">antes de gastos</div></div>
    </div>
    <div class="card todo"><h2>Para hacer hoy</h2>
      ${grupos.length ? grupos.map(g => `<details class="grupo" ${g === grupos[0] ? "open" : ""}><summary><span>${g[0]} ${g[1]}</span><span class="count">${g[2]}</span></summary>${g[3]}</details>`).join("")
        : `<div class="alert ok">Todo en orden ✅</div>`}
    </div>
    <div class="card"><div class="row"><h2 style="margin:0">Últimas ventas</h2><span class="spacer"></span><a href="#ventas">Ver todas →</a></div>
      ${ventas.length ? ventas.map(v => `<a class="venta-mini" href="#ventas"><span><b>${esc(v.cliente || "Sin nombre")}</b><small>${fecha(v.fecha)} · ${esc(v.detalle || "")}</small></span><b>${bs(v.total, 0)}</b></a>`).join("")
        : `<div class="empty">Todavía no hay ventas.</div>`}
    </div>`;
}

// ================================================================== VENDER
function nuevoCart() { return { fecha: hoy(), cliente: "", notas: "", items: [], descuento: null, usar_insumos: true, usar_bolsita: true }; }
function descuentoAuto(n) {
  let d = 0;
  try { for (const [q, p] of JSON.parse(S.boot.config.descuentos)) if (n >= q) d = p; } catch (e) { /* sin descuentos */ }
  return d;
}
function cartCalc() {
  const c = S.cart;
  const nDec = c.items.filter(i => i.kind === "decant").length;
  const dAuto = descuentoAuto(nDec);
  const d = c.descuento === null ? dAuto : num(c.descuento);
  let sub = 0, tot = 0, costo = 0;
  for (const it of c.items) {
    const p = num(it.precio), pf = perfById(it.perfume_id);
    it._final = it.kind === "decant" ? p * (1 - d / 100) : p;
    sub += p; tot += it._final;
    it._costo = !pf ? 0 : it.kind === "frasco" ? pf.costo_frasco_prom : pf.costo_ml * (it.kind === "parcial" ? Math.max(pf.ml, 0) : num(it.ml));
    costo += it._costo;
  }
  return { nDec, dAuto, d, sub, tot, costo, gan: tot - costo };
}
function addItem(kind, extra = {}) {
  S.cart.items.push({ kind, perfume_id: null, ml: kind === "decant" ? 5 : "", precio: "", ...extra });
  renderCart();
  if (!extra.perfume_id) { const rows = $$(".cart-item"); const inp = rows.length && $("input", rows[rows.length - 1]); inp && inp.focus(); }
}
function autoPrecio(it) {
  const p = perfById(it.perfume_id);
  if (!p) return;
  if (it.kind === "decant") { const k = { 2: "p2", 3: "p3", 5: "p5", 9: "p9" }[num(it.ml)]; if (k && num(p[k])) it.precio = p[k]; }
  else if (it.kind === "parcial") { it.ml = Math.max(0, p.ml); it.precio = p.precio_parcial || ""; }
  else if (it.kind === "frasco") { it.precio = p.precio_frasco || ""; }
}
function itemHtml(it, i) {
  const p = perfById(it.perfume_id);
  const del = `<button class="sm danger" data-del="${i}" title="Quitar">✕</button>`;
  const warn = it._costo && num(it._final) && it._final < it._costo ? `<div class="hint neg">⚠ Debajo del costo (${bs(it._costo)})</div>` : (it._costo ? `<div class="hint">Costo ${bs(it._costo)}</div>` : "");
  const pf = `<label class="f">Perfume<input list="dl-perfumes" data-k="perfume" value="${esc(p ? perfLabel(p) : "")}" placeholder="Escribe para buscar…">
    ${p ? `<span class="hint">${stockCell(p)}</span>` : ""}</label>`;
  const precio = `<label class="f">Precio (Bs)<input type="number" step="any" data-k="precio" value="${esc(it.precio)}">${warn}</label>`;
  if (it.kind === "frasco") return `<div class="cart-item" data-i="${i}"><div><span class="badge b-n">Frasco cerrado</span></div>${pf}<div></div>${precio}${del}</div>`;
  if (it.kind === "parcial") return `<div class="cart-item" data-i="${i}"><div><span class="badge b-mid">Frasco abierto</span><div class="hint">se vende lo que queda</div></div>${pf}
    <label class="f">ml que quedan<input type="number" value="${esc(it.ml)}" disabled></label>${precio}${del}</div>`;
  return `<div class="cart-item" data-i="${i}"><div><span class="badge b-ok">Decant</span></div>${pf}
    <label class="f">Tamaño (ml)<div class="sizes">${[2, 3, 5, 9].map(s => `<button type="button" class="sm ${num(it.ml) === s ? "on" : ""}" data-size="${s}">${s}</button>`).join("")}
      <input type="number" step="any" data-k="ml" value="${esc(it.ml)}" style="width:58px" title="Otro tamaño"></div></label>${precio}${del}</div>`;
}
function renderCart() {
  const box = $("#cart"); if (!box) return;
  const c = cartCalc();
  box.innerHTML = S.cart.items.length ? S.cart.items.map(itemHtml).join("") : `<div class="empty">Agrega productos con los botones de arriba.</div>`;
  renderTotals(c);
}
function renderTotals(c = cartCalc()) {
  $("#totals").innerHTML = `
    <div class="row"><span>Subtotal</span><span class="spacer"></span><b>${bs(c.sub, 2)}</b></div>
    <div class="row" style="margin:8px 0"><span>Descuento en decants (${c.nDec} decant${c.nDec === 1 ? "" : "s"})</span><span class="spacer"></span>
      <input type="number" step="any" id="desc" value="${c.d}" style="width:70px"> %</div>
    ${c.d !== c.dAuto ? `<div class="hint">Sugerido: ${c.dAuto}% · <a href="#" id="descReset">usar sugerido</a></div>` : ""}
    <hr style="border:none;border-top:1px solid var(--line);margin:12px 0">
    <div class="row"><span>TOTAL A COBRAR</span><span class="spacer"></span><span class="cart-total">${bs(c.tot, 2)}</span></div>
    <div class="row hint"><span>Ganancia de esta venta</span><span class="spacer"></span><span class="${cls(c.gan)}">${bs(c.gan, 2)}</span></div>`;
  $("#desc").onchange = e => { S.cart.descuento = e.target.value === "" ? null : num(e.target.value); renderCart(); };
  const r = $("#descReset"); if (r) r.onclick = e => { e.preventDefault(); S.cart.descuento = null; renderCart(); };
}
async function pgVender(el) {
  if (!S.cart) S.cart = nuevoCart();
  const c = S.cart;
  el.innerHTML = `<h1>🛒 Nueva venta</h1><p class="sub">Elige el cliente y agrega lo que lleva. El stock y los insumos se descuentan solos.</p>
    <div class="card"><div class="form">
      ${F("Fecha", "fecha", c.fecha, "date", 'id="v-fecha"')}
      <label class="f wide">Cliente<input id="v-cliente" list="dl-clientes" value="${esc(c.cliente)}" placeholder="Nombre (si es nuevo se crea solo)"><span class="hint" id="v-cli-info"></span></label>
      <label class="f wide">Notas<input id="v-notas" value="${esc(c.notas)}" placeholder="Ej: envío, pago QR…"></label>
    </div></div>
    <div class="card">
      <div class="row" style="margin-bottom:6px"><h2 style="margin:0">¿Qué lleva?</h2><span class="spacer"></span>
        <button class="primary" id="add-dec">+ Decant</button><button id="add-fr">+ Frasco cerrado</button><button id="add-par">+ Frasco abierto (lo que queda)</button></div>
      <div id="cart"></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Insumos</h2>${Chk("Descontar frasquito y sticker por cada decant", "usar_insumos", c.usar_insumos)}<br>${Chk("Usar 1 bolsita en esta venta", "usar_bolsita", c.usar_bolsita)}</div>
      <div class="card"><div id="totals"></div>
        <div class="row" style="margin-top:16px"><button id="v-clear">Vaciar</button><span class="spacer"></span><button class="primary big" id="v-save">✔ Registrar venta</button></div></div>
    </div>`;
  const cliInfo = () => {
    const n = c.cliente.trim().toLowerCase();
    const ex = S.boot.clientes.find(x => x.nombre.toLowerCase() === n);
    $("#v-cli-info").textContent = !n ? "Venta sin nombre (cliente general)" : ex ? "Cliente registrado ✓" : "Cliente nuevo: se va a registrar";
  };
  $("#v-fecha").onchange = e => (c.fecha = e.target.value);
  $("#v-cliente").oninput = e => { c.cliente = e.target.value; cliInfo(); };
  $("#v-notas").oninput = e => (c.notas = e.target.value);
  $$("[name=usar_insumos],[name=usar_bolsita]", el).forEach(i => (i.onchange = () => (c[i.name] = i.checked)));
  $("#add-dec").onclick = () => addItem("decant");
  $("#add-fr").onclick = () => addItem("frasco");
  $("#add-par").onclick = () => addItem("parcial");
  $("#v-clear").onclick = () => { if (!c.items.length || confirmar("¿Vaciar la venta?")) { S.cart = nuevoCart(); route(); } };
  const cart = $("#cart");
  cart.addEventListener("click", e => {
    const row = e.target.closest(".cart-item"); if (!row) return;
    const it = c.items[+row.dataset.i];
    if (e.target.dataset.del !== undefined) { c.items.splice(+e.target.dataset.del, 1); renderCart(); }
    if (e.target.dataset.size) { it.ml = +e.target.dataset.size; autoPrecio(it); renderCart(); }
  });
  cart.addEventListener("change", e => {
    const row = e.target.closest(".cart-item"); if (!row) return;
    const it = c.items[+row.dataset.i], k = e.target.dataset.k;
    if (k === "perfume") {
      const p = perfByLabel(e.target.value);
      if (!p) { toast("No encontré ese perfume. Elígelo de la lista (o créalo en Productos).", true); return; }
      it.perfume_id = p.id; autoPrecio(it); renderCart();
    } else if (k === "ml") { it.ml = e.target.value; autoPrecio(it); renderCart(); }
    else if (k === "precio") { it.precio = e.target.value; renderCart(); }
  });
  cart.addEventListener("input", e => {
    const row = e.target.closest(".cart-item"); if (!row) return;
    if (e.target.dataset.k === "precio") { c.items[+row.dataset.i].precio = e.target.value; renderTotals(); }
  });
  $("#v-save").onclick = async () => {
    const calc = cartCalc();
    if (!c.items.length) return toast("Agrega al menos un producto.", true);
    for (const it of c.items) {
      if (!it.perfume_id) return toast("Falta elegir un perfume.", true);
      if (it.kind === "decant" && num(it.ml) <= 0) return toast("Falta el tamaño de un decant.", true);
      if (num(it.precio) <= 0 && !confirmar("Hay un producto con precio 0. ¿Registrar igual?")) return;
    }
    if (calc.gan < 0 && !confirmar(`Esta venta deja PÉRDIDA (${bs(calc.gan)}). ¿Registrar igual?`)) return;
    const body = { fecha: c.fecha, cliente: c.cliente, notas: c.notas, descuento_pct: calc.d, usar_insumos: c.usar_insumos, usar_bolsita: c.usar_bolsita,
      items: c.items.map(it => ({ kind: it.kind, perfume_id: it.perfume_id, ml: num(it.ml), precio: num(it.precio) })) };
    $("#v-save").disabled = true;
    const enviar = async forzar => {
      try {
        const r = await api("ventas", { method: "POST", body: { ...body, forzar } });
        S.cart = nuevoCart(); await reloadBoot();
        modal("✔ Venta registrada", `<div class="big-num">${bs(r.total, 2)}</div><p>Venta <b>${esc(r.numero)}</b>${c.cliente ? " a " + esc(c.cliente) : ""}.</p>`, null);
        route();
      } catch (e) {
        if (/no hay frascos|solo quedan/i.test(e.message) && !forzar && confirmar(e.message + "\n\n¿Registrar la venta igual? (el stock quedará en negativo hasta que registres la compra)")) return enviar(true);
        toast(e.message, true); const b = $("#v-save"); if (b) b.disabled = false;
      }
    };
    enviar(false);
  };
  cliInfo();
  renderCart();
}

// ================================================================== VENTAS
function tablaVentas(vs, click = true) {
  if (!vs.length) return `<div class="empty">No hay ventas.</div>`;
  return `<div class="tbl-wrap"><table><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th class="r">Total</th><th class="r">Ganancia</th></tr></thead><tbody>
    ${vs.map(v => `<tr class="${click ? "click" : ""}" ${click ? `onclick="verVenta(${v.id})"` : ""}><td>${esc(v.numero)}</td><td>${fecha(v.fecha)}</td><td>${esc(v.cliente || "—")}</td>
      <td>${esc(v.detalle || "")}${v.notas ? `<div class="hint">${esc(v.notas)}</div>` : ""}</td><td class="r"><b>${bs(v.total)}</b></td><td class="r ${cls(v.ganancia)}">${bs(v.ganancia)}</td></tr>`).join("")}
    </tbody></table></div>`;
}
let VF = { mes: "", q: "" };
async function pgVentas(el) {
  el.innerHTML = `<div class="row"><div><h1>🧾 Ventas</h1><p class="sub">Toca una venta para ver el detalle, corregirla o anularla.</p></div><span class="spacer"></span>
      <button class="primary" onclick="location.hash='vender'">+ Nueva venta</button></div>
    <div class="card"><div class="row">${Sel("Mes", "mes", [["", "Todos"], ...lastMonths(24).map(m => [m, mesTxt(m)])], VF.mes)}
      <label class="f" style="flex:1">Buscar<input name="q" value="${esc(VF.q)}" placeholder="Cliente, perfume, N°…"></label></div>
      <div id="v-sum" class="hint" style="margin-top:8px"></div></div>
    <div class="card" id="v-list"><div class="empty">Cargando…</div></div>`;
  const load = async () => {
    const vs = await api("ventas?" + new URLSearchParams(Object.entries(VF).filter(([, v]) => v)));
    const t = vs.reduce((a, v) => a + num(v.total), 0), g = vs.reduce((a, v) => a + num(v.ganancia), 0);
    $("#v-sum").innerHTML = `${vs.length} ventas · Total <b>${bs(t, 0)}</b> · Ganancia <b>${bs(g, 0)}</b> · Ticket promedio ${bs(vs.length ? t / vs.length : 0, 0)}`;
    $("#v-list").innerHTML = tablaVentas(vs);
  };
  $$("select,input", el).forEach(i => (i[i.tagName === "INPUT" ? "oninput" : "onchange"] = () => { VF[i.name] = i.value; clearTimeout(i._t); i._t = setTimeout(load, 250); }));
  await load();
}
async function verVenta(id) {
  const v = await safe(() => api("ventas/" + id));
  const items = v.items.filter(i => i.tipo.startsWith("venta"));
  const abiertos = v.items.filter(i => i.tipo === "abrir");
  modal(`Venta ${esc(v.numero)}`, `<div class="form">
      ${F("Fecha", "fecha", v.fecha, "date")}<label class="f wide">Cliente<input name="cliente" list="dl-clientes" value="${esc(v.cliente || "")}"></label>
      <label class="f wide">Notas<input name="notas" value="${esc(v.notas)}"></label></div>
    <table style="margin-top:14px"><thead><tr><th>Producto</th><th class="r">ml</th><th class="r">Costo</th><th class="r">Precio cobrado</th></tr></thead><tbody>
      ${items.map(i => `<tr><td>${esc(i.perfume)}<div class="hint">${esc(i.tipo_txt)}</div></td><td class="r">${i.ml ? n1(-i.ml) : ""}</td><td class="r">${bs(i.costo)}</td>
        <td class="r"><input type="number" step="any" data-precio="${i.id}" value="${i.precio}" style="width:100px"></td></tr>`).join("")}</tbody></table>
    ${v.descuento ? `<p class="hint">Descuento aplicado: ${bs(v.descuento)}</p>` : ""}
    ${abiertos.length ? `<p class="hint">En esta venta se abrió un frasco nuevo de: ${abiertos.map(a => esc(a.perfume)).join(", ")}.</p>` : ""}`,
    async (d, bg) => {
      const precios = {}; $$("[data-precio]", bg).forEach(i => (precios[i.dataset.precio] = num(i.value)));
      await api("ventas/" + id, { method: "PUT", body: { fecha: d.fecha, cliente: d.cliente, notas: d.notas, precios } });
      toast("✔ Venta corregida"); refresh();
    }, "Guardar cambios", { wide: true, noFocus: true,
      extraBtn: `<button class="danger" style="margin-right:auto" onclick="anularVenta(${id})">Anular venta</button>` });
}
async function anularVenta(id) {
  if (!confirmar("¿Anular esta venta? Se borra y el stock vuelve como estaba.")) return;
  await safe(() => api("ventas/" + id, { method: "DELETE" }));
  closeModals(); toast("Venta anulada"); refresh();
}

// ================================================================== PRODUCTOS
let PF = { filtro: "con", q: "", inactivos: false, tab: "perfumes" };
async function pgProductos(el, arg) {
  if (arg === "quietos") { PF.filtro = "quietos"; PF.tab = "perfumes"; history.replaceState(null, "", "#productos"); }
  if (arg === "insumos") { PF.tab = "insumos"; history.replaceState(null, "", "#productos"); }
  await reloadBoot();
  const all = S.boot.perfumes, act = all.filter(p => p.activo);
  const n = f => act.filter(f).length;
  const filtros = [["con", "Con stock", p => p.frascos > 0 || p.ml > 0.5], ["reponer", "Para reponer", p => p.se_vende && p.estado !== "ok"],
    ["quietos", "Quietos", p => p.quieto], ["viejos", "Abiertos hace mucho", p => p.frasco_viejo], ["sin", "Sin stock", p => p.estado === "agotado"], ["todos", "Todos", () => true]];
  el.innerHTML = `<div class="row"><div><h1>🧴 Productos</h1><p class="sub">Catálogo de perfumes, stock (frascos cerrados y ml abiertos) e insumos.</p></div><span class="spacer"></span>
      <button onclick="salida()">🎁 Regalo / uso / pérdida</button><button class="primary" onclick="editarPerfume()">+ Nuevo perfume</button></div>
    <div class="tabs"><button data-tab="perfumes" class="${PF.tab === "perfumes" ? "on" : ""}">Perfumes</button><button data-tab="insumos" class="${PF.tab === "insumos" ? "on" : ""}">Insumos (frasquitos, bolsitas…)</button></div>
    <div id="p-body"></div>`;
  $$("[data-tab]", el).forEach(b => (b.onclick = () => { PF.tab = b.dataset.tab; route(); }));
  if (PF.tab === "insumos") return pgInsumos($("#p-body"));
  $("#p-body").innerHTML = `
    <div class="grid g4" style="margin-bottom:18px">
      <div class="kpi"><div class="l">Perfumes con stock</div><div class="v">${n(filtros[0][2])}</div><div class="s">${n0(act.reduce((a, p) => a + Math.max(p.ml, 0), 0))} ml abiertos · ${n0(act.reduce((a, p) => a + Math.max(p.frascos, 0), 0))} frascos cerrados</div></div>
      <div class="kpi"><div class="l">Valor del stock (a costo)</div><div class="v">${bs(act.reduce((a, p) => a + p.valor, 0), 0)}</div></div>
      <div class="kpi warn"><div class="l">Para reponer</div><div class="v">${n(filtros[1][2])}</div><div class="s">se venden y se acaban</div></div>
      <div class="kpi"><div class="l">Quietos</div><div class="v">${n(filtros[2][2])}</div><div class="s">${bs(act.filter(p => p.quieto).reduce((a, p) => a + p.valor, 0), 0)} parados</div></div>
    </div>
    <div class="card"><div class="row"><div class="chips">${filtros.map(f => `<button data-f="${f[0]}" class="${PF.filtro === f[0] ? "on" : ""}">${f[1]} (${n(f[2])})</button>`).join("")}</div>
      <span class="spacer"></span><input id="pf-q" placeholder="Buscar perfume o marca" value="${esc(PF.q)}">
      <label class="chk"><input type="checkbox" id="pf-i" ${PF.inactivos ? "checked" : ""}> inactivos</label></div></div>
    <div class="card"><div class="tbl-wrap" id="pf-t"></div></div>`;
  const draw = () => {
    const f = filtros.find(x => x[0] === PF.filtro)[2], q = PF.q.toLowerCase();
    const list = all.filter(p => (PF.inactivos || p.activo) && f(p) && (!q || (p.nombre + " " + p.marca).toLowerCase().includes(q)));
    $("#pf-t").innerHTML = list.length ? `<table><thead><tr><th>Perfume</th><th>Stock</th><th></th><th>Estado</th><th class="r">Precios decant 2·3·5·9</th><th class="r">Frasco</th>
      <th class="r">Vendido 60 días</th><th>Última venta</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr style="${p.activo ? "" : "opacity:.5"}"><td><b>${esc(p.nombre)}</b><div class="hint">${esc(p.marca)}${p.vol_ml ? " · " + n0(p.vol_ml) + " ml" : ""}</div></td>
        <td>${stockCell(p)}${p.dias_abierto !== null && p.ml > 0 ? `<div class="hint">abierto hace ${p.dias_abierto} días</div>` : ""}</td><td style="width:90px">${stockBar(p)}</td><td>${estadoBadge(p)}</td>
        <td class="r">${[p.p2, p.p3, p.p5, p.p9].map(x => x ? n0(x) : "–").join(" · ")}</td><td class="r">${p.precio_frasco ? bs(p.precio_frasco, 0) : "—"}</td>
        <td class="r">${p.ventas_60d ? bs(p.ventas_60d, 0) : "—"}</td><td>${p.ult_venta ? fecha(p.ult_venta) : "—"}</td>
        <td><div class="menu-acc">${p.frascos > 0 ? `<button class="sm" onclick="abrirFrasco(${p.id})">Abrir frasco</button>` : ""}
          <button class="sm" onclick="contarStock(${p.id})">Contar</button><button class="sm" onclick="historial(${p.id})">Historial</button>
          <button class="sm" onclick="editarPerfume(${p.id})">Editar</button></div></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No hay perfumes en este filtro.</div>`;
  };
  $$("[data-f]", el).forEach(b => (b.onclick = () => { PF.filtro = b.dataset.f; $$("[data-f]", el).forEach(x => x.classList.toggle("on", x === b)); draw(); }));
  $("#pf-q").oninput = e => { PF.q = e.target.value; draw(); };
  $("#pf-i").onchange = e => { PF.inactivos = e.target.checked; draw(); };
  draw();
}
function editarPerfume(id) {
  const p = id ? perfById(id) : { nombre: "", marca: "", genero: "", vol_ml: 100, costo_ref: "", precio_frasco: "", p2: "", p3: "", p5: "", p9: "", activo: 1, notas: "" };
  const otros = S.boot.perfumes.filter(x => x.id !== id).map(x => [x.id, x.nombre]);
  modal(id ? "Editar perfume" : "Nuevo perfume", `<div class="form">
    <label class="f wide">Nombre<input name="nombre" value="${esc(p.nombre)}"></label>${F("Marca / casa", "marca", p.marca)}
    ${Sel("Para", "genero", [["", "—"], "Hombre", "Mujer", "Unisex"], p.genero)}${F("ml del frasco", "vol_ml", p.vol_ml, "number")}
    ${F("Costo del frasco (Bs)", "costo_ref", p.costo_ref, "number")}${F("Precio venta frasco (Bs)", "precio_frasco", p.precio_frasco, "number")}
    ${F("Decant 2 ml (Bs)", "p2", p.p2, "number")}${F("Decant 3 ml (Bs)", "p3", p.p3, "number")}${F("Decant 5 ml (Bs)", "p5", p.p5, "number")}${F("Decant 9 ml (Bs)", "p9", p.p9, "number")}
    <label class="f wide">Notas<input name="notas" value="${esc(p.notas || "")}"></label>
    <details class="wide"><summary><b>Página web</b> ${String(p.web || "").toUpperCase() === "OCULTO" ? badgeNivel("n", "oculto") : badgeNivel("ok", "visible")}</summary><div class="form" style="margin-top:10px">
      <div class="wide">${Chk("Ocultar de la página web", "web_oculto", String(p.web || "").toUpperCase() === "OCULTO")}</div>
      <label class="f wide">Foto (URL de Cloudinary)<input name="imagen_url" value="${esc(p.imagen_url || "")}" placeholder="https://res.cloudinary.com/..."></label>
      ${F("Familia olfativa", "familia", p.familia || "")}${F("Orden en la web (1 = primero)", "destacado", p.destacado ?? "", "number")}
      <label class="f wide">Notas olfativas (separadas por |)<input name="notas_olf" value="${esc(p.notas_olf || "")}" placeholder="Vainilla|Canela|Ámbar"></label>
      <label class="f wide">Descripción<textarea name="descripcion" rows="4">${esc(p.descripcion || "")}</textarea></label>
      <div class="wide hint">Todos los perfumes activos salen en la web, con o sin foto. Precio y stock salen solos; la web se actualiza en unos 2 minutos.</div></div></details>
    ${id ? `<div class="wide">${Chk("Activo (desmarca si ya no lo trabajas)", "activo", !!p.activo)}</div>` : ""}
    <div class="wide hint">${id ? `Costo por ml actual: ${bs(p.costo_ml, 2)}. ` : ""}El stock no se cambia aquí: entra con <b>Compras</b> y sale con <b>Ventas</b>.</div></div>
    ${id ? `<details style="margin-top:14px"><summary class="hint">¿Está repetido con otro nombre? Unir con otro perfume</summary>
      <div class="row" style="margin-top:8px">${Sel("Pasar todo su historial a", "unir_con", [["", "— elegir —"], ...otros], "", 'id="unir"')}<button class="danger" id="unir-btn" style="margin-top:18px">Unir</button></div></details>` : ""}`,
    async d => {
      if (!d.nombre) throw new Error("Falta el nombre.");
      const body = { ...d, activo: id ? (d.activo ? 1 : 0) : 1, web: d.web_oculto ? "OCULTO" : "SI" }; delete body.unir_con; delete body.web_oculto;
      if (id) await api("perfumes/" + id, { method: "PUT", body });
      else {
        if (S.boot.perfumes.some(x => x.nombre.toLowerCase() === d.nombre.toLowerCase())) throw new Error("Ya existe un perfume con ese nombre.");
        await api("perfumes", { method: "POST", body });
        toast("✔ Perfume creado. Para tener stock, registra la compra en Compras.");
      }
      refresh();
    }, "Guardar", { wide: true });
  const ub = $("#unir-btn");
  if (ub) ub.onclick = async () => {
    const dest = $("#unir").value; if (!dest) return toast("Elige el perfume.", true);
    if (!confirmar(`Se pasará todo el historial de "${p.nombre}" a "${perfById(dest).nombre}" y se borrará "${p.nombre}". ¿Continuar?`)) return;
    await safe(() => api(`perfumes/${id}/unir`, { method: "POST", body: { destino_id: +dest } }));
    closeModals(); toast("✔ Perfumes unidos"); refresh();
  };
}
function abrirFrasco(id) {
  const p = perfById(id);
  modal(`Abrir un frasco de ${esc(p.nombre)}`, `<p>Pasa 1 frasco cerrado (de ${n0(p.frascos)}) a perfume abierto para decants.</p><div class="form">
    ${F("Fecha", "fecha", hoy(), "date")}${F("ml del frasco", "vol_ml", p.vol_ml, "number")}</div>
    ${p.ml > 0.5 ? `<p class="hint">Todavía quedan ${n1(p.ml)} ml abiertos; se suman.</p>` : ""}`,
    async d => { await api("abrir", { method: "POST", body: { perfume_id: id, ...d } }); toast("✔ Frasco abierto"); refresh(); }, "Abrir frasco");
}
function contarStock(id) {
  const p = perfById(id);
  modal(`Contar stock de ${esc(p.nombre)}`, `<p class="hint">Escribe lo que hay de verdad. Si falta algo, se registra como pérdida; si sobra, como ajuste.</p><div class="form">
    ${F("Frascos cerrados", "frascos", p.frascos, "number")}${F("ml abiertos (aprox.)", "ml", n1(p.ml).replace(",", "."), "number")}
    <label class="f wide">Motivo<input name="notas" value="Conteo de stock"></label></div>`,
    async d => {
      const r = await api("ajuste", { method: "POST", body: { perfume_id: id, ...d } });
      toast(r.cambios ? "✔ Stock corregido" : "Sin cambios"); refresh();
    }, "Guardar conteo");
}
function salida(perfumeId) {
  const p0 = perfumeId ? perfById(perfumeId) : null;
  const bg = modal("Regalo, uso propio o pérdida", `<div class="form">
    ${Sel("¿Qué pasó?", "tipo", [["regalo", "🎁 Regalo"], ["uso", "🧪 Uso propio"], ["merma", "💧 Pérdida / derrame / roto"]], "regalo")}
    ${F("Fecha", "fecha", hoy(), "date")}
    <label class="f wide">Perfume<input name="perfume" list="dl-perfumes" value="${esc(p0 ? perfLabel(p0) : "")}" placeholder="Escribe para buscar…"></label>
    <label class="f">ml<div class="sizes">${[2, 3, 5, 9].map(s => `<button type="button" class="sm" data-s="${s}">${s}</button>`).join("")}<input name="ml" type="number" step="any" value="5" style="width:64px"></div></label>
    <label class="f wide">Para quién / motivo<input name="notas" placeholder="Ej: cliente nuevo, promo, sorteo…"></label>
    <div class="wide">${Chk("Fue un frasco cerrado completo (no ml)", "frasco_cerrado", false)}</div>
    <div class="wide">${Chk("Descontar frasquito y sticker (si fue un decant de regalo)", "usar_insumos", true)}</div></div>`,
    async d => {
      const p = perfByLabel(d.perfume); if (!p) throw new Error("Elige un perfume de la lista.");
      await api("salidas", { method: "POST", body: { ...d, perfume_id: p.id } });
      toast("✔ Registrado"); refresh();
    });
  $$("[data-s]", bg).forEach(b => (b.onclick = () => { $("[name=ml]", bg).value = b.dataset.s; $$("[data-s]", bg).forEach(x => x.classList.toggle("on", x === b)); }));
}
async function historial(id) {
  const p = perfById(id);
  const hs = await safe(() => api(`perfumes/${id}/historial`));
  const borrable = h => !h.venta_id && !h.compra_id;
  modal(`Historial de ${esc(p.nombre)}`, `<p class="hint">Todo lo que entró y salió. Ventas y compras se corrigen desde sus pestañas.</p><div class="scroll" style="max-height:60vh"><table>
    <thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Frascos</th><th class="r">ml</th><th class="r">Precio</th><th class="r">Costo</th><th>Detalle</th><th class="r">Queda</th><th></th></tr></thead><tbody>
    ${hs.map(h => `<tr><td>${fecha(h.fecha)}</td><td>${esc(h.tipo_txt)}</td><td class="r">${h.unidades ? n0(h.unidades) : ""}</td><td class="r">${h.ml ? n1(h.ml) : ""}</td>
      <td class="r">${h.precio ? bs(h.precio) : ""}</td><td class="r">${h.costo ? bs(h.costo) : ""}</td>
      <td class="hint">${esc([h.numero, h.cliente, h.proveedor, h.notas].filter(Boolean).join(" · "))}</td>
      <td class="r hint">${h.frascos_post ? n0(h.frascos_post) + " fr · " : ""}${n1(h.ml_post)} ml</td>
      <td>${borrable(h) ? `<button class="sm danger" onclick="borrarMov(${h.id},${id})">✕</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`, null, "", { wide: true });
}
async function borrarMov(mid, pid) {
  if (!confirmar("¿Borrar este movimiento?")) return;
  await safe(() => api("movimientos/" + mid, { method: "DELETE" }));
  closeModals(); await reloadBoot(); historial(pid); route();
}

// ---- insumos (dentro de Productos)
const AUTO_OPC = [["", "No se descuenta solo"], ["decant_2", "1 por cada decant de 2 ml"], ["decant_3", "1 por cada decant de 3 ml"],
  ["decant_5", "1 por cada decant de 5 ml"], ["decant_9", "1 por cada decant de 9 ml"], ["item", "1 por cada decant (cualquier tamaño)"], ["venta", "1 por cada venta con decants"]];
async function pgInsumos(box) {
  const ins = S.boot.insumos;
  const movs = await api("insumo_movs?limit=150");
  box.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0">Insumos</h2><span class="spacer"></span>
      <button onclick="editarInsumo()">+ Nuevo insumo</button><button class="primary" onclick="movInsumo(null,'compra')">+ Compré insumos</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>Insumo</th><th class="r">Quedan</th><th>Estado</th><th class="r">Usados 60 días</th><th class="r">Costo c/u</th><th>Se descuenta solo</th><th></th></tr></thead><tbody>
      ${ins.map(i => `<tr><td><b>${esc(i.nombre)}</b></td><td class="r">${n0(i.stock)}</td>
        <td>${i.stock <= 0 ? badgeNivel("bad", "Agotado") : i.bajo ? badgeNivel("warn", "Comprar") : badgeNivel("ok", "OK")}</td><td class="r">${n0(i.usado_60d)}</td>
        <td class="r">${bs(i.costo_unit, 2)}</td><td class="hint">${esc((AUTO_OPC.find(a => a[0] === (i.auto || "")) || ["", ""])[1])}</td>
        <td><div class="menu-acc"><button class="sm" onclick="movInsumo(${i.id},'compra')">Compra</button><button class="sm" onclick="movInsumo(${i.id},'uso')">Uso / ajuste</button><button class="sm" onclick="editarInsumo(${i.id})">Editar</button></div></td></tr>`).join("")}
    </tbody></table></div></div>
    <div class="card"><h2>Últimos movimientos de insumos</h2><div class="scroll"><table><thead><tr><th>Fecha</th><th>Insumo</th><th class="r">Cantidad</th><th class="r">Pagado</th><th>Detalle</th><th></th></tr></thead><tbody>
      ${movs.map(m => `<tr><td>${fecha(m.fecha)}</td><td>${esc(m.insumo)}</td><td class="r ${m.cantidad < 0 ? "" : "pos"}">${m.cantidad > 0 ? "+" : ""}${n0(m.cantidad)}</td>
        <td class="r">${m.costo_total ? bs(m.costo_total) : ""}</td><td class="hint">${m.numero ? "Venta " + esc(m.numero) : esc(m.notas === "auto" ? "automático" : m.notas)}</td>
        <td>${m.venta_id || m.mov_id ? "" : `<button class="sm danger" onclick="borrarInsMov(${m.id})">✕</button>`}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function movInsumo(id, tipo) {
  modal(tipo === "compra" ? "Compré insumos" : "Uso o ajuste de insumo", `<div class="form">
    ${Sel("Insumo", "insumo_id", S.boot.insumos.map(i => [i.id, i.nombre]), id)}${F("Fecha", "fecha", hoy(), "date")}
    ${F(tipo === "compra" ? "Cantidad (unidades)" : "Cantidad usada / perdida", "cantidad", "", "number")}
    ${tipo === "compra" ? F("Total pagado (Bs)", "costo_total", "", "number") : ""}
    <label class="f wide">Notas<input name="notas"></label>
    ${tipo === "compra" ? `<div class="wide hint">Ej: 3 docenas de frasquitos = 36 unidades.</div>` : ""}</div>`,
    async d => {
      if (!(num(d.cantidad) > 0)) throw new Error("Indica la cantidad.");
      await api("insumo_movs", { method: "POST", body: { ...d, cantidad: tipo === "compra" ? num(d.cantidad) : -num(d.cantidad) } });
      toast("✔ Registrado"); PF.tab = "insumos"; refresh();
    });
}
function editarInsumo(id) {
  const i = id ? S.boot.insumos.find(x => x.id === id) : { nombre: "", costo_unit: "", stock_min: 10, auto: "" };
  modal(id ? "Editar insumo" : "Nuevo insumo", `<div class="form"><label class="f wide">Nombre<input name="nombre" value="${esc(i.nombre)}"></label>
    ${F("Costo por unidad (Bs)", "costo_unit", i.costo_unit, "number")}${F("Avisar cuando queden", "stock_min", i.stock_min, "number")}
    <div class="wide">${Sel("Se descuenta automáticamente", "auto", AUTO_OPC, i.auto || "")}</div></div>`,
    async d => {
      if (!d.nombre) throw new Error("Falta el nombre.");
      await api(id ? "insumos/" + id : "insumos", { method: id ? "PUT" : "POST", body: d });
      toast("✔ Guardado"); PF.tab = "insumos"; refresh();
    });
}
async function borrarInsMov(id) {
  if (!confirmar("¿Borrar este registro?")) return;
  await safe(() => api("insumo_movs/" + id, { method: "DELETE" })); PF.tab = "insumos"; refresh();
}

// ================================================================== COMPRAS
let CF = { tab: "compras", mes: "" };
async function pgCompras(el) {
  el.innerHTML = `<div class="row"><div><h1>📦 Compras</h1><p class="sub">Todo lo que entra al negocio. Si compras un frasco para hacer decants, marca “abrir para decants”.</p></div><span class="spacer"></span>
      <button onclick="movInsumo(null,'compra')">+ Compré insumos</button><button class="primary" onclick="nuevaCompra()">+ Nueva compra de perfumes</button></div>
    <div class="tabs"><button data-t="compras" class="${CF.tab === "compras" ? "on" : ""}">Compras</button><button data-t="prov" class="${CF.tab === "prov" ? "on" : ""}">Proveedores</button></div>
    <div id="c-body"></div>`;
  $$("[data-t]", el).forEach(b => (b.onclick = () => { CF.tab = b.dataset.t; route(); }));
  const box = $("#c-body");
  if (CF.tab === "prov") {
    const pr = await api("proveedores");
    box.innerHTML = `<div class="card"><table><thead><tr><th>Proveedor</th><th>Teléfono</th><th class="r">Compras</th><th class="r">Total comprado</th><th>Última</th><th></th></tr></thead><tbody>
      ${pr.map(p => `<tr><td><b>${esc(p.nombre)}</b>${p.notas ? `<div class="hint">${esc(p.notas)}</div>` : ""}</td><td>${esc(p.telefono)}</td><td class="r">${p.compras}</td><td class="r">${bs(p.total, 0)}</td>
        <td>${fecha(p.ultima)}</td><td><button class="sm" onclick='editarProveedor(${JSON.stringify(p).replace(/'/g, "&#39;")})'>Editar</button></td></tr>`).join("")}</tbody></table></div>`;
    return;
  }
  box.innerHTML = `<div class="card"><div class="row">${Sel("Mes", "mes", [["", "Todos"], ...lastMonths(24).map(m => [m, mesTxt(m)])], CF.mes, 'id="c-mes"')}<span class="spacer"></span><span id="c-sum" class="hint"></span></div></div>
    <div class="card" id="c-list"></div>`;
  const load = async () => {
    const cs = await api("compras?" + new URLSearchParams(CF.mes ? { mes: CF.mes } : {}));
    $("#c-sum").innerHTML = `${cs.length} compras · Total <b>${bs(cs.reduce((a, c) => a + num(c.total), 0), 0)}</b>`;
    $("#c-list").innerHTML = cs.length ? `<div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Qué se compró</th><th class="r">Total</th><th></th></tr></thead><tbody>
      ${cs.map(c => `<tr><td>${fecha(c.fecha)}</td><td>${esc(c.proveedor || "—")}</td><td>${esc(c.detalle || "")}${c.abiertos ? `<div class="hint">${c.abiertos} abierto(s) para decants</div>` : ""}${c.notas ? `<div class="hint">${esc(c.notas)}</div>` : ""}</td>
        <td class="r"><b>${bs(c.total)}</b></td><td class="r"><button class="sm danger" onclick="borrarCompra(${c.id})">✕</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No hay compras.</div>`;
  };
  $("#c-mes").onchange = e => { CF.mes = e.target.value; load(); };
  load();
}
function nuevaCompra() {
  const lineas = [{}];
  const bg = modal("Nueva compra de perfumes", `<div class="form">
      ${F("Fecha", "fecha", hoy(), "date")}<label class="f wide">Proveedor<input name="proveedor" list="dl-proveedores" placeholder="Nombre del proveedor"></label>
      <label class="f wide">Notas<input name="notas"></label></div>
    <h3 style="margin-top:16px">Perfumes</h3><div id="lineas"></div>
    <button type="button" id="add-l" style="margin-top:8px">+ Otro perfume</button>
    <div class="row" style="margin-top:12px"><span class="spacer"></span><span>Total: <b id="c-tot">Bs 0</b></span></div>`,
    async (d, bg) => {
      const items = [];
      for (const l of $$(".linea", bg)) {
        const g = readForm(l);
        if (!g.perfume) continue;
        const p = perfByLabel(g.perfume);
        if (!p && !confirmar(`"${g.perfume}" no está en el catálogo. ¿Crearlo como perfume nuevo?`)) return false;
        items.push({ perfume_id: p ? p.id : null, nombre: p ? null : g.perfume, marca: g.marca, unidades: num(g.unidades) || 1, costo_unit: num(g.costo_unit),
          vol_ml: num(g.vol_ml), precio_frasco: num(g.precio_frasco), abrir: g.abrir ? 1 : 0 });
      }
      if (!items.length) throw new Error("Agrega al menos un perfume.");
      if (items.some(i => !(i.costo_unit > 0)) && !confirmar("Hay perfumes sin costo. Sin costo no se puede calcular la ganancia. ¿Guardar igual?")) return false;
      const r = await api("compras", { method: "POST", body: { fecha: d.fecha, proveedor: d.proveedor, notas: d.notas, items } });
      toast(`✔ Compra registrada: ${bs(r.total, 0)}`); refresh();
    }, "Guardar compra", { wide: true });
  const lineaHtml = () => `<div class="linea card" style="padding:12px;margin-bottom:8px"><div class="form">
      <label class="f wide">Perfume<input name="perfume" list="dl-perfumes" placeholder="Escribe para buscar o un nombre nuevo"></label>
      ${F("Cantidad de frascos", "unidades", 1, "number")}${F("Costo por frasco (Bs)", "costo_unit", "", "number")}
      ${F("Precio de venta frasco", "precio_frasco", "", "number")}${F("ml del frasco", "vol_ml", "", "number")}
      <div class="nuevo-extra" style="display:none">${F("Marca (perfume nuevo)", "marca", "")}</div>
      <div class="wide">${Chk("Abrir 1 frasco para hacer decants", "abrir", false)} <span class="hint info"></span></div></div></div>`;
  const draw = () => {
    $("#lineas", bg).insertAdjacentHTML("beforeend", lineaHtml());
    const l = $$(".linea", bg).at(-1);
    $("[name=perfume]", l).onchange = e => {
      const p = perfByLabel(e.target.value);
      $(".nuevo-extra", l).style.display = p || !e.target.value ? "none" : "";
      if (p) {
        for (const [k, v] of [["costo_unit", p.costo_ref], ["precio_frasco", p.precio_frasco], ["vol_ml", p.vol_ml]]) { const i = $(`[name=${k}]`, l); if (!i.value && v) i.value = v; }
        $(".info", l).textContent = `Ahora tienes: ${p.frascos > 0 ? n0(p.frascos) + " cerrados, " : ""}${n0(Math.max(p.ml, 0))} ml abiertos`;
      } else $(".info", l).textContent = e.target.value ? "Perfume nuevo: se agrega al catálogo" : "";
      tot();
    };
    $$("input", l).forEach(i => i.addEventListener("input", tot));
  };
  const tot = () => { $("#c-tot", bg).textContent = bs($$(".linea", bg).reduce((a, l) => a + num($("[name=unidades]", l).value) * num($("[name=costo_unit]", l).value), 0), 0); };
  $("#add-l", bg).onclick = draw;
  lineas.forEach(draw);
}
async function borrarCompra(id) {
  if (!confirmar("¿Borrar esta compra? El stock que entró con ella se quita.")) return;
  await safe(() => api("compras/" + id, { method: "DELETE" })); toast("Compra borrada"); refresh();
}
function editarProveedor(p) {
  modal("Proveedor", `<div class="form"><label class="f wide">Nombre<input name="nombre" value="${esc(p.nombre)}"></label>${F("Teléfono", "telefono", p.telefono)}
    <label class="f wide">Notas<input name="notas" value="${esc(p.notas || "")}" placeholder="Ej: qué trae, tiempos, precios"></label></div>`,
    async d => { await api("proveedores/" + p.id, { method: "PUT", body: d }); toast("✔ Guardado"); refresh(); });
}

// ================================================================== CLIENTES
let CLF = { seg: "", q: "" };
const SEG_TXT = {
  "Frecuente": "3 o más compras y compró hace poco", "Activo": "2 compras, compró hace poco", "Nuevo": "Primera compra reciente",
  "En riesgo": "Hace tiempo que no compra: escribirle", "Perdido": "No compra hace mucho", "Sin compras": "Registrado pero sin compras",
};
async function pgClientes(el, arg) {
  if (arg) { history.replaceState(null, "", "#clientes"); setTimeout(() => verCliente(+arg), 50); }
  const cls = await api("clientes");
  const segs = ["Frecuente", "Activo", "Nuevo", "En riesgo", "Perdido", "Sin compras"];
  const cnt = s => cls.filter(c => c.segmento === s).length;
  el.innerHTML = `<div class="row"><div><h1>👥 Clientes</h1><p class="sub">Quién compra, cada cuánto y qué le gusta. Agrega el teléfono para escribirle por WhatsApp con un clic.</p></div><span class="spacer"></span>
      <button class="primary" onclick="editarCliente()">+ Nuevo cliente</button></div>
    <div class="grid g4" style="margin-bottom:18px">
      <div class="kpi"><div class="l">Clientes</div><div class="v">${cls.length}</div><div class="s">${cls.filter(c => c.telefono).length} con teléfono</div></div>
      <div class="kpi ok"><div class="l">Vuelven a comprar</div><div class="v">${pct(cls.filter(c => c.compras >= 2).length / Math.max(1, cls.filter(c => c.compras).length), 0)}</div><div class="s">compraron 2 veces o más</div></div>
      <div class="kpi warn"><div class="l">En riesgo</div><div class="v">${cnt("En riesgo")}</div><div class="s">hace más de ${S.boot.config.dias_cliente_riesgo} días sin comprar</div></div>
      <div class="kpi"><div class="l">Ticket promedio</div><div class="v">${bs(cls.reduce((a, c) => a + c.total, 0) / Math.max(1, cls.reduce((a, c) => a + c.compras, 0)), 0)}</div></div>
    </div>
    <div class="card"><div class="row"><div class="chips"><button data-s="" class="${!CLF.seg ? "on" : ""}">Todos (${cls.length})</button>${segs.map(s => `<button data-s="${s}" title="${esc(SEG_TXT[s])}" class="${CLF.seg === s ? "on" : ""}">${s} (${cnt(s)})</button>`).join("")}</div>
      <span class="spacer"></span><input id="cl-q" placeholder="Buscar cliente" value="${esc(CLF.q)}"></div>
      <p class="hint" id="cl-h" style="margin:8px 0 0"></p></div>
    <div class="card"><div class="tbl-wrap" id="cl-t"></div></div>`;
  const draw = () => {
    const q = CLF.q.toLowerCase();
    const list = cls.filter(c => (!CLF.seg || c.segmento === CLF.seg) && (!q || (c.nombre + " " + c.telefono).toLowerCase().includes(q)));
    $("#cl-h").textContent = CLF.seg ? SEG_TXT[CLF.seg] : "";
    $("#cl-t").innerHTML = list.length ? `<table><thead><tr><th>Cliente</th><th>Grupo</th><th class="r">Compras</th><th class="r">Total</th><th class="r">Ticket</th><th>Última compra</th><th>Le gusta</th><th></th></tr></thead><tbody>
      ${list.map(c => `<tr class="click" onclick="verCliente(${c.id})"><td><b>${esc(c.nombre)}</b>${c.vip ? " ⭐" : ""}<div class="hint">${esc(c.telefono || "sin teléfono")}</div></td>
        <td>${badgeNivel(SEG_COLOR[c.segmento], c.segmento)}</td><td class="r">${c.compras}</td><td class="r">${bs(c.total, 0)}</td><td class="r">${bs(c.ticket, 0)}</td>
        <td>${c.ultima ? fecha(c.ultima) + `<div class="hint">hace ${c.dias} días</div>` : "—"}</td><td>${esc(c.favorito)}</td>
        <td onclick="event.stopPropagation()">${waBtn(c.wa, `Hola ${c.nombre}! `, "")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No hay clientes aquí.</div>`;
  };
  $$("[data-s]", el).forEach(b => (b.onclick = () => { CLF.seg = b.dataset.s; $$("[data-s]", el).forEach(x => x.classList.toggle("on", x === b)); draw(); }));
  $("#cl-q").oninput = e => { CLF.q = e.target.value; draw(); };
  draw();
}
function editarCliente(c) {
  c = c || { nombre: "", telefono: "", ciudad: "", notas: "" };
  modal(c.id ? "Editar cliente" : "Nuevo cliente", `<div class="form"><label class="f wide">Nombre<input name="nombre" value="${esc(c.nombre)}"></label>
    ${F("Teléfono / WhatsApp", "telefono", c.telefono, "tel", 'placeholder="Ej: 70012345"')}${F("Ciudad / zona", "ciudad", c.ciudad)}
    <label class="f wide">Notas<input name="notas" value="${esc(c.notas || "")}" placeholder="Ej: le gustan los dulces, cumpleaños…"></label></div>`,
    async d => {
      if (!d.nombre) throw new Error("Falta el nombre.");
      await api(c.id ? "clientes/" + c.id : "clientes", { method: c.id ? "PUT" : "POST", body: d });
      toast("✔ Guardado"); closeModals(); await reloadBoot();
      if (location.hash.startsWith("#clientes")) route();
    });
}
async function verCliente(id) {
  const c = await safe(() => api("clientes/" + id));
  const otros = S.boot.clientes.filter(x => x.id !== id).map(x => [x.id, x.nombre]);
  modal(`${esc(c.nombre)} ${c.vip ? "⭐" : ""}`, `
    <div class="row" style="margin-bottom:12px">${badgeNivel(SEG_COLOR[c.segmento], c.segmento)}<span class="hint">${esc(SEG_TXT[c.segmento])}</span><span class="spacer"></span>
      ${waBtn(c.wa, `Hola ${c.nombre}! `)}<button class="sm" id="cl-edit">Editar datos</button></div>
    <div class="grid g4" style="margin-bottom:12px">
      <div class="kpi"><div class="l">Compras</div><div class="v">${c.compras}</div></div><div class="kpi"><div class="l">Total</div><div class="v">${bs(c.total, 0)}</div></div>
      <div class="kpi"><div class="l">Ticket</div><div class="v">${bs(c.ticket, 0)}</div></div><div class="kpi"><div class="l">Última</div><div class="v" style="font-size:18px">${c.ultima ? fecha(c.ultima) : "—"}</div></div></div>
    <p>${c.telefono ? "📞 " + esc(c.telefono) : "<span class='hint'>Sin teléfono</span>"} ${c.ciudad ? " · 📍 " + esc(c.ciudad) : ""} ${c.notas ? "<br>📝 " + esc(c.notas) : ""}</p>
    ${c.probo_decant_nombres.length ? `<div class="alert ok">🎯 Probó en decant y no compró el frasco: <b>${c.probo_decant_nombres.map(esc).join(", ")}</b>. Buena oportunidad para ofrecérselo.</div>` : ""}
    <h3>Compras</h3><div class="scroll" style="max-height:40vh">${tablaVentas(c.ventas, false)}</div>
    <details style="margin-top:14px"><summary class="hint">¿Está repetido? Unir con otro cliente</summary>
      <div class="row" style="margin-top:8px">${Sel("Pasar sus compras a", "x", [["", "— elegir —"], ...otros], "", 'id="cl-unir"')}<button class="danger" id="cl-unir-b" style="margin-top:18px">Unir</button></div></details>`,
    null, "", { wide: true, extraBtn: c.compras ? "" : `<button class="danger" style="margin-right:auto" id="cl-del">Borrar cliente</button>` });
  $("#cl-edit").onclick = () => { closeModals(); editarCliente(c); };
  const del = $("#cl-del"); if (del) del.onclick = async () => { if (!confirmar("¿Borrar este cliente?")) return; await safe(() => api("clientes/" + id, { method: "DELETE" })); closeModals(); refresh(); };
  $("#cl-unir-b").onclick = async () => {
    const dest = $("#cl-unir").value; if (!dest) return toast("Elige el cliente.", true);
    if (!confirmar("Sus compras pasarán al otro cliente y este se borrará. ¿Continuar?")) return;
    await safe(() => api(`clientes/${id}/unir`, { method: "POST", body: { destino_id: +dest } })); closeModals(); toast("✔ Clientes unidos"); refresh();
  };
}

// ================================================================== GASTOS
let GF = { mes: "" };
async function pgGastos(el) {
  const gastos = await api("gastos");
  const list = gastos.filter(g => !GF.mes || g.fecha.startsWith(GF.mes)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  const esRet = c => (c || "").toLowerCase().includes("retiro");
  const porCat = {};
  list.forEach(g => (porCat[g.categoria] = (porCat[g.categoria] || 0) + num(g.monto)));
  el.innerHTML = `<h1>💸 Gastos</h1><p class="sub">Lo que se paga para que el negocio funcione (envíos, publicidad, transporte…). Si sacas plata para ti, usa <b>“Retiro personal (dueño)”</b>: no es un gasto del negocio, pero así se sabe cuánto se retiró.</p>
    <div class="card"><h2>Nuevo gasto</h2><div class="form" id="g-form">
      ${F("Fecha", "fecha", hoy(), "date")}<label class="f">Categoría<input name="categoria" list="dl-categorias" value="Envíos / Delivery"></label>
      <label class="f wide">Descripción<input name="descripcion"></label>${F("Monto (Bs)", "monto", "", "number")}
      <div style="align-self:end"><button class="primary" id="g-add">Agregar</button></div></div></div>
    <div class="grid g2">
      <div class="card"><div class="row"><h2 style="margin:0">Registro</h2><span class="spacer"></span>${Sel("", "mes", [["", "Todos los meses"], ...lastMonths(24).map(m => [m, mesTxt(m)])], GF.mes, 'id="g-mes"')}</div>
        <div class="scroll">${list.length ? `<table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="r">Monto</th><th></th></tr></thead><tbody>
        ${list.map(g => `<tr><td>${fecha(g.fecha)}</td><td>${esc(g.categoria)}</td><td>${esc(g.descripcion)}</td><td class="r">${bs(g.monto)}</td>
          <td class="r"><button class="sm danger" onclick="borrarGasto(${g.id})">✕</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">Sin gastos registrados.</div>`}</div></div>
      <div class="card"><h2>Por categoría</h2>${Object.keys(porCat).length ? hBars(Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v })), "var(--c2)") : `<div class="empty">—</div>`}
        <p><b>Gastos:</b> ${bs(list.filter(g => !esRet(g.categoria)).reduce((a, g) => a + num(g.monto), 0))} · <b>Retiros:</b> ${bs(list.filter(g => esRet(g.categoria)).reduce((a, g) => a + num(g.monto), 0))}</p></div>
    </div>`;
  $("#g-mes").onchange = e => { GF.mes = e.target.value; route(); };
  $("#g-add").onclick = async () => {
    const d = readForm($("#g-form"));
    if (!(num(d.monto) > 0)) return toast("Falta el monto.", true);
    await safe(() => api("gastos", { method: "POST", body: d })); toast("✔ Gasto agregado"); refresh();
  };
}
async function borrarGasto(id) { if (!confirmar("¿Borrar este gasto?")) return; await safe(() => api("gastos/" + id, { method: "DELETE" })); refresh(); }

// ================================================================== SALUD DEL NEGOCIO
let HF = null;
function presetRango(k) {
  const cur = mesActual(), back = n => lastMonths(n)[n - 1];
  return { m3: [back(3), back(1)], m6: [back(6), back(1)], anio: [cur.slice(0, 4) + "-01", cur], mes: [cur, cur], ant: [back(2), back(2)], todo: ["", ""] }[k];
}
async function pgSalud(el) {
  if (!HF) HF = { desde: "", hasta: "" };
  const R = await api(`salud?desde=${HF.desde}&hasta=${HF.hasta}`);
  HF = { desde: R.desde, hasta: R.hasta };
  const T = R.totales, M = R.mensual, I = R.indicadores, C = R.clientes, inv = R.inventario;
  const meses = R.meses_disponibles.map(m => [m, mesTxt(m)]);
  const tr = (k, v, c = "") => `<tr><td>${k}</td><td class="r ${c}">${v}</td></tr>`;
  el.innerHTML = `
    <div class="row no-print"><div><h1>📈 Salud del negocio</h1><p class="sub">Resumen para evaluar cómo va el negocio.</p></div><span class="spacer"></span>
      <button class="primary" onclick="window.print()">📄 Exportar PDF</button></div>
    <div class="card no-print"><div class="row">${Sel("Desde", "desde", meses, R.desde, 'id="h-d"')}${Sel("Hasta", "hasta", meses, R.hasta, 'id="h-h"')}
      <div class="chips" style="margin-top:18px">${[["mes", "Este mes"], ["ant", "Mes pasado"], ["m3", "Últimos 3 meses"], ["m6", "Últimos 6 meses"], ["anio", "Este año"], ["todo", "Todo"]].map(p => `<button data-p="${p[0]}">${p[1]}</button>`).join("")}</div></div></div>
    <div class="print-only" style="border-bottom:3px solid var(--accent);margin-bottom:14px;padding-bottom:8px">
      <h1 style="color:var(--accent)">${esc(R.negocio)} — Salud del negocio</h1><div class="hint">Periodo: ${esc(mesTxt(R.desde))} a ${esc(mesTxt(R.hasta))} · Generado el ${esc(R.generado)} · Montos en Bs</div></div>
    <p class="hint no-print">Periodo: <b>${esc(mesTxt(R.desde))}</b> a <b>${esc(mesTxt(R.hasta))}</b>. Los indicadores de salud usan los últimos meses completos (${I.meses_evaluados.map(mesTxt).join(", ") || "—"}).</p>

    <div class="verdict ${R.nivel}"><div class="t">${esc(R.veredicto)}</div>
      <p>${I.meses_evaluados.length ? `Ganancia neta promedio: <b>${bs(I.util_prom_3m, 0)} por mes</b> · Ventas promedio: ${bs(I.ventas_prom_3m, 0)} por mes` : ""}</p></div>

    <div class="grid g4" style="margin-bottom:18px">
      <div class="kpi"><div class="l">Ventas</div><div class="v">${bs(T.ventas_total, 0)}</div><div class="s">${n0(T.n_ventas)} ventas · ticket ${bs(T.ticket, 0)}</div></div>
      <div class="kpi"><div class="l">Ganancia bruta</div><div class="v">${bs(T.utilidad_bruta, 0)}</div><div class="s">Margen ${pct(T.margen_bruto)} (ventas − costo del perfume)</div></div>
      <div class="kpi ${T.utilidad_neta >= 0 ? "ok" : "bad"}"><div class="l">Ganancia neta</div><div class="v ${cls(T.utilidad_neta)}">${bs(T.utilidad_neta, 0)}</div><div class="s">Margen ${pct(T.margen_neto)} · ${bs(T.utilidad_neta / Math.max(T.meses, 1), 0)} por mes</div></div>
      <div class="kpi"><div class="l">Inventario hoy (a costo)</div><div class="v">${bs(inv.total, 0)}</div><div class="s">${I.dias_inventario ? `se vende en ~${n0(I.dias_inventario)} días` : ""}</div></div>
    </div>

    <div class="grid g2">
      <div class="card"><h2>Semáforo</h2>${R.senales.map(s => `<div class="alert ${s.nivel}">${NIVEL_ICON[s.nivel]} <b>${esc(s.titulo)}:</b> ${esc(s.texto)}</div>`).join("")}</div>
      <div class="card"><h2>💡 Qué conviene hacer</h2>${R.consejos.length ? R.consejos.map(c => `<div class="consejo">${esc(c)}</div>`).join("") : `<div class="empty">Sin recomendaciones.</div>`}</div>
    </div>

    <div class="card"><h2>Ventas y ganancia neta por mes</h2>
      ${barChart(M.map(r => mesCorto(r.mes)), [{ name: "Ventas", color: "var(--accent-2)", values: M.map(r => r.ventas_total) }, { name: "Ganancia neta", color: "var(--c3)", values: M.map(r => r.utilidad_neta) }], { height: 230 })}</div>

    <div class="card pb"><h2>Resultados por mes</h2><div class="tbl-wrap"><table><thead><tr><th>Mes</th><th class="r">Ventas</th><th class="r">Costo perfume</th><th class="r">Gan. bruta</th>
      <th class="r">Regalos, uso y pérdidas</th><th class="r">Insumos</th><th class="r">Gastos</th><th class="r">Gan. neta</th><th class="r">Margen</th><th class="r">N° ventas</th><th class="r">Ticket</th><th class="r">Retiros</th><th class="r">Flujo</th></tr></thead><tbody>
      ${M.map(r => `<tr><td>${esc(r.mes_txt)}</td><td class="r"><b>${n0(r.ventas_total)}</b></td><td class="r">${n0(r.costo_ventas)}</td><td class="r">${n0(r.utilidad_bruta)}</td>
        <td class="r">${n0(r.regalos + r.uso + r.mermas)}</td><td class="r">${n0(r.insumos)}</td><td class="r">${n0(r.gastos)}</td><td class="r ${cls(r.utilidad_neta)}"><b>${n0(r.utilidad_neta)}</b></td>
        <td class="r">${pct(r.margen_neto, 0)}</td><td class="r">${n0(r.n_ventas)}</td><td class="r">${n0(r.ticket)}</td><td class="r">${n0(r.retiros)}</td><td class="r ${cls(r.flujo_neto)}">${n0(r.flujo_neto)}</td></tr>`).join("")}
      <tr class="total"><td>Total</td><td class="r">${n0(T.ventas_total)}</td><td class="r">${n0(T.costo_ventas)}</td><td class="r">${n0(T.utilidad_bruta)}</td><td class="r">${n0(T.regalos + T.uso + T.mermas)}</td>
        <td class="r">${n0(T.insumos)}</td><td class="r">${n0(T.gastos)}</td><td class="r">${n0(T.utilidad_neta)}</td><td class="r">${pct(T.margen_neto, 0)}</td><td class="r">${n0(T.n_ventas)}</td><td class="r">${n0(T.ticket)}</td>
        <td class="r">${n0(T.retiros)}</td><td class="r">${n0(T.flujo_neto)}</td></tr></tbody></table></div>
      <p class="hint">Flujo = dinero de ventas − compras de perfumes e insumos − gastos − retiros. Muestra si sobra o falta plata en caja cada mes.</p></div>

    <div class="grid g2">
      <div class="card"><h2>¿Qué deja más ganancia?</h2><table><thead><tr><th>Línea</th><th class="r">Ventas</th><th class="r">% de ventas</th><th class="r">Ganancia</th><th class="r">Margen</th></tr></thead><tbody>
        ${R.por_linea.map(l => `<tr><td><b>${esc(l.nombre)}</b> <span class="hint">(${n0(l.n)})</span></td><td class="r">${bs(l.ventas, 0)}</td><td class="r">${pct(l.participacion, 0)}</td><td class="r">${bs(l.ganancia, 0)}</td><td class="r"><b>${pct(l.margen, 0)}</b></td></tr>`).join("")}</tbody></table>
        <h3 style="margin-top:16px">Decants por tamaño</h3><table><thead><tr><th>Tamaño</th><th class="r">Vendidos</th><th class="r">Precio prom.</th><th class="r">Costo real*</th><th class="r">Margen real</th></tr></thead><tbody>
        ${R.por_tamano.map(t => `<tr><td>${esc(t.nombre)}</td><td class="r">${n0(t.n)}</td><td class="r">${bs(t.precio_prom)}</td><td class="r">${bs(t.costo_real_prom)}</td><td class="r"><b>${pct(t.margen_real, 0)}</b></td></tr>`).join("")}</tbody></table>
        <p class="hint">*Perfume + frasquito + sticker.</p></div>
      <div class="card"><h2>Inventario</h2><table><tbody>
        ${tr("Frascos cerrados", bs(inv.cerrados, 0))}${tr("Perfume abierto (para decants)", bs(inv.abiertos, 0))}${tr("Insumos", bs(inv.insumos, 0))}${tr("<b>Total a costo</b>", "<b>" + bs(inv.total, 0) + "</b>")}
        ${tr("Rotación al año", I.rotacion ? n1(I.rotacion) + " veces" : "—")}${tr("Días para vender todo", I.dias_inventario ? n0(I.dias_inventario) : "—")}
        ${tr("Ganancia bruta anual por cada Bs 1 de inventario", I.gmroi ? "Bs " + n1(I.gmroi) : "—")}
        ${tr("Stock quieto (sin ventas " + S.boot.config.dias_sin_venta + "+ días)", bs(inv.quieto, 0) + " · " + inv.n_quietos + " perfumes", inv.quieto > inv.total * 0.25 ? "neg" : "")}</tbody></table>
        ${R.quietos.length ? `<p class="hint" style="margin-top:10px">Quietos: ${R.quietos.map(q => `${esc(q.nombre)} (${bs(q.valor, 0)})`).join(", ")}</p>` : ""}</div>
    </div>

    <div class="grid g2">
      <div class="card"><h2>Clientes</h2><table><tbody>
        ${tr("Clientes que compraron en el periodo", n0(C.con_nombre_periodo))}${tr("Clientes nuevos en el periodo", n0(C.nuevos_periodo))}
        ${tr("Volvieron a comprar (histórico)", pct(C.recompra_historica, 0))}${tr("Ventas con cliente registrado", pct(C.pct_ventas_con_nombre, 0))}
        ${tr("Probaron decant → compraron frasco", `${C.conversion.compraron_frasco} de ${C.conversion.probaron} (${pct(C.conversion.tasa, 0)})`)}
        ${tr("Ventas de los 5 mejores clientes", pct(C.concentracion_top5, 0))}</tbody></table>
        <p class="hint" style="margin-top:10px">${Object.entries(C.segmentos).map(([k, v]) => `${esc(k)}: ${v}`).join(" · ")}</p></div>
      <div class="card"><h2>Mejores clientes</h2><table><thead><tr><th>Cliente</th><th class="r">Compras</th><th class="r">Total</th><th>Estado</th></tr></thead><tbody>
        ${C.top.map(c => `<tr><td>${esc(c.nombre)}</td><td class="r">${c.compras}</td><td class="r">${bs(c.total, 0)}</td><td>${badgeNivel(SEG_COLOR[c.segmento], c.segmento)}</td></tr>`).join("")}</tbody></table></div>
    </div>

    <div class="grid g2">
      <div class="card"><h2>🏆 Perfumes que más ganancia dejan</h2>${hBars(R.por_perfume.slice(0, 10).map(p => ({ label: p.nombre, value: p.ganancia })), "var(--c3)")}</div>
      <div class="card"><h2>⛔ Ventas por debajo del costo</h2>${R.perdidas.length ? `<p class="hint">${R.perdidas.length} ventas · ${bs(-R.perdidas.reduce((a, p) => a + p.perdida, 0), 0)} perdidos</p>
        <table><thead><tr><th>Fecha</th><th>Perfume</th><th class="r">Precio</th><th class="r">Costo</th></tr></thead><tbody>
        ${R.perdidas.slice(0, 10).map(p => `<tr><td>${fecha(p.fecha)}</td><td>${esc(p.perfume)}<div class="hint">${esc(p.tipo)}</div></td><td class="r">${bs(p.precio, 0)}</td><td class="r neg">${bs(p.costo, 0)}</td></tr>`).join("")}</tbody></table>`
        : `<div class="empty">✅ Ninguna</div>`}</div>
    </div>

    <div class="card"><h2>¿Qué significa cada cosa?</h2><ul class="hint" style="line-height:1.7;margin:0">
      <li><b>Ganancia bruta:</b> ventas menos lo que costó el perfume vendido.</li>
      <li><b>Ganancia neta:</b> ganancia bruta menos regalos, uso propio, pérdidas, insumos (frasquitos, bolsitas, stickers) y gastos. Es lo que realmente gana el negocio (antes de que el dueño retire plata).</li>
      <li><b>Margen:</b> de cada Bs 100 vendidos, cuántos quedan de ganancia.</li>
      <li><b>Ticket promedio:</b> cuánto gasta un cliente en promedio por compra.</li>
      <li><b>Rotación / días de inventario:</b> qué tan rápido se convierte la mercadería en ventas. Menos días = menos plata parada.</li>
      <li><b>Ganancia por cada Bs 1 de inventario (GMROI):</b> cuánto deja al año cada boliviano invertido en mercadería. Lo sano es 2 o más.</li>
      <li><b>Stock quieto:</b> perfumes que hace más de ${S.boot.config.dias_sin_venta} días no se venden: plata inmovilizada.</li></ul></div>`;
  $("#h-d").onchange = e => { HF.desde = e.target.value; route(); };
  $("#h-h").onchange = e => { HF.hasta = e.target.value; route(); };
  $$("[data-p]", el).forEach(b => (b.onclick = () => { const [d, h] = presetRango(b.dataset.p); HF = { desde: d, hasta: h }; route(); }));
}

// ================================================================== AJUSTES
async function pgAjustes(el) {
  const c = S.boot.config;
  let desc = [];
  try { desc = JSON.parse(c.descuentos); } catch (e) { /* vacío */ }
  el.innerHTML = `<h1>⚙️ Ajustes</h1><p class="sub">Configuración general.</p>
    <div class="card"><div class="form" id="cfg">
      <label class="f wide">Nombre del negocio<input name="negocio" value="${esc(c.negocio)}"></label>
      ${F("“Se acaba” si quedan menos de (ml)", "stock_bajo_ml", c.stock_bajo_ml, "number")}
      ${F("Perfume “quieto” si no se vende en (días)", "dias_sin_venta", c.dias_sin_venta, "number")}
      ${F("Avisar frasco abierto hace más de (días)", "dias_frasco_abierto", c.dias_frasco_abierto, "number")}
      ${F("Cliente “en riesgo” después de (días)", "dias_cliente_riesgo", c.dias_cliente_riesgo, "number")}
      ${F("Cliente “perdido” después de (días)", "dias_cliente_perdido", c.dias_cliente_perdido, "number")}
      <label class="f wide">Descuentos por cantidad de decants<input name="descuentos" value="${esc(desc.map(d => `${d[0]}:${d[1]}`).join(", "))}">
        <span class="hint">cantidad:porcentaje. Ej: 2:5, 3:8, 4:10, 5:13 → 2 decants = 5%, 5 o más = 13%.</span></label>
    </div><div class="row" style="margin-top:14px"><span class="spacer"></span><button class="primary" id="cfg-save">Guardar</button></div></div>
    <div class="card"><h2>Datos y respaldos</h2>
      <p>Todo se guarda en tu Google Sheet <b>Aura DB</b>. Cada lunes se guarda una copia en la carpeta <b>Aura DB backups</b> de tu Drive.
      Desde la hoja puedes descargar todo en Excel (Archivo → Descargar).</p>
      <div class="row"><button id="sy">🔄 Sincronizar ahora</button>
      ${Sync.sheetUrl() ? `<a class="btn" href="${esc(Sync.sheetUrl())}" target="_blank" rel="noopener">📄 Abrir la hoja</a>` : ""}
      <button id="cx-change">🔑 Cambiar conexión</button><button class="danger" id="cx-off">Desconectar este dispositivo</button></div>
      <p class="hint">${Sync.pending() ? "Hay cambios esperando internet para guardarse en la hoja." : "Todo está guardado en la hoja."}</p></div>`;
  $("#cfg-save").onclick = async () => {
    const d = readForm($("#cfg"));
    const parsed = d.descuentos.split(",").map(x => x.split(":").map(num)).filter(x => x.length === 2 && x[0] > 0).sort((a, b) => a[0] - b[0]);
    const body = { ...d, descuentos: JSON.stringify(parsed) };
    for (const k of Object.keys(body)) body[k] = String(body[k]);
    await safe(() => api("config", { method: "PUT", body })); toast("✔ Guardado"); refresh();
  };
  $("#sy").onclick = async () => { await Sync.syncNow(); refresh(); };
  $("#cx-change").onclick = () => pgConectar();
  $("#cx-off").onclick = async () => {
    if (Sync.pending()) return toast("Hay cambios sin guardar en la hoja. Conéctate a internet y sincroniza primero.", true);
    if (!confirmar("Se borrará la copia de este dispositivo (la hoja no se toca). ¿Continuar?")) return;
    await Sync.disconnect(); location.reload();
  };
}

const PAGES = { inicio: pgInicio, vender: pgVender, ventas: pgVentas, productos: pgProductos, compras: pgCompras,
  clientes: pgClientes, gastos: pgGastos, salud: pgSalud, ajustes: pgAjustes };

window.addEventListener("hashchange", route);

// En el celular las tablas se muestran como tarjetas: cada dato lleva el nombre de su columna.
function etiquetarTablas(root) {
  $$("table", root).forEach(t => {
    const heads = $$("thead th", t).map(th => th.textContent.trim());
    if (!heads.length) return;
    $$("tbody tr", t).forEach(tr => [...tr.children].forEach((td, i) => { if (!td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i] || ""); }));
  });
}
new MutationObserver(() => etiquetarTablas(document.body)).observe(document.body, { childList: true, subtree: true });
(async () => {
  let st;
  try { st = await Sync.init(onRemoteChange); }
  catch (e) { MAIN().innerHTML = `<div class="card"><b>No se pudo iniciar la app.</b> ${esc(e.message)}</div>`; return; }
  Sync.onState(showSync);
  if (!st.hasConn) return pgConectar();
  await reloadBoot(); route();
  Sync.syncNow();
})();

async function onRemoteChange() {
  await reloadBoot();
  const busy = $(".modal-bg") || location.hash.startsWith("#vender");
  if (busy) toast("Hay datos nuevos de otro dispositivo. Se verán al cambiar de pantalla.");
  else route();
}

function showSync(s) {
  const el = $("#sync");
  if (!el) return;
  const ico = { ok: "☁️", saving: "⏳", offline: "📴", error: "⚠️", idle: "☁️" }[s.status] || "☁️";
  el.className = "sync " + s.status;
  el.innerHTML = `${ico} <span>${esc(s.text || "Sincronizar")}</span>`;
  el.title = "Tocar para sincronizar ahora";
}

function pgConectar(msg = "") {
  renderNav("ajustes");
  MAIN().innerHTML = `<div class="card" style="max-width:560px"><h1>Conectar con la hoja</h1>
    <p class="sub">Solo se hace una vez en cada dispositivo. Los datos se guardan en tu Google Sheet <b>Aura DB</b>.</p>
    ${msg ? `<p class="neg">${esc(msg)}</p>` : ""}
    <div class="form" id="cx">
      <label class="f wide">URL de la hoja (termina en /exec)<input name="url" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(Sync.conn()?.url || "")}"></label>
      <label class="f wide">Clave de la app<input name="key" autocomplete="off"></label>
    </div>
    <div class="hint" style="margin:8px 0 14px">La URL y la clave están en la hoja: menú <b>Aura → Show app key</b>.</div>
    <button class="primary" id="cx-ok">Conectar</button> <span id="cx-st" class="hint"></span></div>`;
  $("#cx-ok").onclick = async () => {
    const d = readForm($("#cx"));
    $("#cx-ok").disabled = true; $("#cx-st").textContent = "Conectando y descargando datos…";
    try { await Sync.connect(d.url, d.key); await reloadBoot(); location.hash = "inicio"; route(); toast("✔ Conectado"); }
    catch (e) { $("#cx-st").textContent = ""; $("#cx-ok").disabled = false; toast(e.message, true); }
  };
}
