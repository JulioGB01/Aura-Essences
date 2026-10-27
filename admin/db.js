// Aura Essences: business rules (port of the PC Tool logic.py + server.py), running on SQLite in the browser.
const Aura = (() => {
  const SCHEMA = `
CREATE TABLE IF NOT EXISTS config(clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS perfumes(id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, marca TEXT DEFAULT '', genero TEXT DEFAULT '',
  vol_ml REAL DEFAULT 100, costo_ref REAL DEFAULT 0, precio_frasco REAL DEFAULT 0,
  p2 REAL DEFAULT 0, p3 REAL DEFAULT 0, p5 REAL DEFAULT 0, p9 REAL DEFAULT 0, activo INTEGER DEFAULT 1, notas TEXT DEFAULT '',
  web TEXT DEFAULT 'NO', destacado REAL, familia TEXT DEFAULT '', notas_olf TEXT DEFAULT '', descripcion TEXT DEFAULT '', imagen_url TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS clientes(id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, telefono TEXT DEFAULT '', ciudad TEXT DEFAULT '',
  notas TEXT DEFAULT '', creado TEXT);
CREATE TABLE IF NOT EXISTS proveedores(id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, telefono TEXT DEFAULT '', notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS compras(id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, proveedor_id INTEGER REFERENCES proveedores(id),
  total REAL DEFAULT 0, notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS ventas(id INTEGER PRIMARY KEY, numero TEXT, fecha TEXT NOT NULL, cliente_id INTEGER REFERENCES clientes(id),
  subtotal REAL DEFAULT 0, descuento REAL DEFAULT 0, total REAL DEFAULT 0, notas TEXT DEFAULT '', creado TEXT);
CREATE TABLE IF NOT EXISTS movimientos(id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, tipo TEXT NOT NULL,
  perfume_id INTEGER NOT NULL REFERENCES perfumes(id), unidades REAL DEFAULT 0, ml REAL DEFAULT 0, precio REAL DEFAULT 0,
  costo REAL DEFAULT 0, venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
  compra_id INTEGER REFERENCES compras(id) ON DELETE CASCADE, notas TEXT DEFAULT '', creado TEXT);
CREATE TABLE IF NOT EXISTS insumos(id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, costo_unit REAL DEFAULT 0, stock_min REAL DEFAULT 0,
  auto TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS insumo_movs(id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, insumo_id INTEGER NOT NULL REFERENCES insumos(id),
  cantidad REAL DEFAULT 0, costo_total REAL DEFAULT 0, venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
  mov_id INTEGER REFERENCES movimientos(id) ON DELETE CASCADE, notas TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS gastos(id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, categoria TEXT DEFAULT 'Otros', descripcion TEXT DEFAULT '',
  monto REAL DEFAULT 0);
CREATE INDEX IF NOT EXISTS ix_mov_perf ON movimientos(perfume_id);
CREATE INDEX IF NOT EXISTS ix_mov_venta ON movimientos(venta_id);
CREATE INDEX IF NOT EXISTS ix_mov_compra ON movimientos(compra_id);
CREATE INDEX IF NOT EXISTS ix_venta_cli ON ventas(cliente_id);`;

  const TABLE_KEYS = { config: "clave", perfumes: "id", clientes: "id", proveedores: "id", compras: "id", ventas: "id",
    movimientos: "id", insumos: "id", insumo_movs: "id", gastos: "id" };
  const DEFAULT_CONFIG = { negocio: "Aura Essences", stock_bajo_ml: "15", dias_sin_venta: "60", dias_frasco_abierto: "180",
    dias_cliente_riesgo: "45", dias_cliente_perdido: "120", descuentos: "[[2, 5], [3, 8], [4, 10], [5, 13]]" };
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const TIPOS = { compra: "Compra", abrir: "Frasco abierto para decants", venta_frasco: "Venta frasco cerrado",
    venta_decant: "Venta decant", venta_parcial: "Venta frasco abierto (parcial)", regalo: "Regalo", uso: "Uso propio",
    merma: "Pérdida / derrame", ajuste: "Ajuste de stock" };
  const VENTA_TIPOS = ["venta_frasco", "venta_decant", "venta_parcial"];
  const LINEA = { venta_decant: "Decants", venta_parcial: "Frascos abiertos (parciales)", venta_frasco: "Frascos cerrados" };
  const CATEGORIAS_GASTO = ["Envíos / Delivery", "Publicidad", "Transporte", "Empaque", "Comisiones / QR", "Servicios (internet, luz)",
    "Otros", "Retiro personal (dueño)"];
  const T_STR = "s", T_NUM = "f", T_INT = "i";
  const TABLAS = {
    perfumes: { nombre: T_STR, marca: T_STR, genero: T_STR, vol_ml: T_NUM, costo_ref: T_NUM, precio_frasco: T_NUM, p2: T_NUM, p3: T_NUM,
      p5: T_NUM, p9: T_NUM, activo: T_INT, notas: T_STR, web: T_STR, destacado: T_NUM, familia: T_STR, notas_olf: T_STR,
      descripcion: T_STR, imagen_url: T_STR },
    clientes: { nombre: T_STR, telefono: T_STR, ciudad: T_STR, notas: T_STR },
    proveedores: { nombre: T_STR, telefono: T_STR, notas: T_STR },
    insumos: { nombre: T_STR, costo_unit: T_NUM, stock_min: T_NUM, auto: T_STR },
    gastos: { fecha: T_STR, categoria: T_STR, descripcion: T_STR, monto: T_NUM },
  };
  const REQUERIDOS = { perfumes: ["nombre"], clientes: ["nombre"], proveedores: ["nombre"], insumos: ["nombre"], gastos: ["fecha", "monto"] };
  const NOMBRES_GENERICOS = new Set(["", "venta", "ventas", "anonimo", "anónimo", "regalo", "para venta", "nuevo", "cliente", "promo", "-", "—", "cliente general"]);

  let db = null;

  // ---------------------------------------------------------------- sql helpers
  const clean = a => (a || []).map(v => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v));
  function rows(sql, args) {
    const st = db.prepare(sql);
    try {
      st.bind(clean(args));
      const out = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally { st.free(); }
  }
  const one = (sql, args) => rows(sql, args)[0] || null;
  const val = (sql, args) => { const r = one(sql, args); return r ? Object.values(r)[0] : null; };
  const run = (sql, args) => db.run(sql, clean(args));
  function newId(table) {
    const m = val(`SELECT MAX(id) FROM ${table}`) || 0;
    return Math.max(m + 1, Date.now());
  }
  function insert(table, obj) {
    const o = { id: newId(table), ...obj };
    const cols = Object.keys(o);
    run(`INSERT INTO ${table}(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`, cols.map(c => o[c]));
    return o.id;
  }
  const err = msg => { throw new Error(msg); };

  // ---------------------------------------------------------------- general helpers
  const fnum = (x, d = 0) => { if (x === null || x === undefined || x === "") return d; const n = Number(x); return isFinite(n) ? n : d; };
  const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
  const pad = n => String(n).padStart(2, "0");
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => isoDate(new Date());
  const ahora = () => { const d = new Date(); return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const dayNum = s => { const [y, m, d] = s.slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const diasDesde = f => (f ? Math.round(dayNum(hoy()) - dayNum(f)) : null);
  const haceDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d); };
  const nombreMes = ym => { const [y, m] = ym.split("-"); return `${MESES[+m - 1]} ${y}`; };
  function monthRange(a, b) {
    let [y, m] = a.split("-").map(Number); const [y2, m2] = b.split("-").map(Number); const out = [];
    while (y < y2 || (y === y2 && m <= m2)) { out.push(`${y}-${pad(m)}`); m++; if (m > 12) { y++; m = 1; } }
    return out;
  }
  function addMonths(ym, n) {
    let [y, m] = ym.split("-").map(Number); m += n;
    while (m > 12) { y++; m -= 12; } while (m < 1) { y--; m += 12; }
    return `${y}-${pad(m)}`;
  }
  const tamanoKey = ml => [2, 3, 5, 9].find(s => Math.abs(fnum(ml) - s) < 0.01) || null;
  const spaces = s => String(s || "").split(/\s+/).filter(Boolean).join(" ");
  const bsTxt = x => "Bs " + Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const pcTxt = x => `${Math.round(x * 100)}%`;
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const groupDefault = make => { const m = new Map(); return { get: k => { if (!m.has(k)) m.set(k, make()); return m.get(k); }, map: m }; };

  function getConfig() {
    const out = { ...DEFAULT_CONFIG };
    rows("SELECT clave, valor FROM config").forEach(r => (out[r.clave] = r.valor));
    return out;
  }

  // ---------------------------------------------------------------- kardex / stock
  const emptyState = () => ({ u: 0, uval: 0, ml: 0, mlval: 0, abierto: null, ult_venta: null, ult_compra: null });
  function kardex() {
    const st = new Map(), post = new Map();
    for (const m of rows("SELECT id, fecha, tipo, perfume_id, unidades, ml, costo FROM movimientos ORDER BY id")) {
      if (!st.has(m.perfume_id)) st.set(m.perfume_id, emptyState());
      const s = st.get(m.perfume_id);
      const t = m.tipo, u = fnum(m.unidades), ml = fnum(m.ml), c = fnum(m.costo), f = m.fecha;
      if (t === "compra") { s.u += u; s.uval += c; s.ult_compra = (s.ult_compra || "") > f ? s.ult_compra : f; }
      else if (t === "abrir") { s.u += u; s.uval -= c; s.ml += ml; s.mlval += c; s.abierto = f; }
      else if (t === "venta_parcial") { s.ml = 0; s.mlval = 0; }
      else if (t === "ajuste") {
        s.u += u; s.ml += ml;
        if (u) s.uval += u > 0 ? c : -c;
        if (ml) s.mlval += ml > 0 ? c : -c;
        if (ml > 0 && !s.abierto) s.abierto = f;
      } else if (u) { s.u += u; s.uval -= c; }
      else if (ml) { s.ml += ml; s.mlval -= c; }
      if (s.ml <= 0.001) s.mlval = 0;
      if (s.u <= 0.001) s.uval = 0;
      if (VENTA_TIPOS.includes(t)) s.ult_venta = (s.ult_venta || "") > f ? s.ult_venta : f;
      post.set(m.id, [r2(s.u), r2(s.ml)]);
    }
    return [st, post];
  }
  const estado = (pid, st) => st.get(pid) || emptyState();
  function costoMl(p, s) {
    if (s.ml > 0.001 && s.mlval > 0) return s.mlval / s.ml;
    return fnum(p.costo_ref) / (fnum(p.vol_ml) || 100);
  }
  function costoUnidad(p, s) {
    if (s.u > 0.001 && s.uval > 0) return s.uval / s.u;
    return fnum(p.costo_ref);
  }

  function perfumesConStock(cfg) {
    const bajo = fnum(cfg.stock_bajo_ml, 15), quieto = fnum(cfg.dias_sin_venta, 60), viejo = fnum(cfg.dias_frasco_abierto, 180);
    const [st] = kardex();
    const vend = groupDefault(() => ({ ml: 0, frascos: 0, ventas: 0, gan: 0 }));
    for (const r of rows("SELECT perfume_id, tipo, ml, unidades, precio, costo FROM movimientos WHERE tipo IN ('venta_decant','venta_parcial','venta_frasco') AND fecha>=?", [haceDias(60)])) {
      const v = vend.get(r.perfume_id);
      if (r.tipo === "venta_frasco") v.frascos += -fnum(r.unidades); else v.ml += -fnum(r.ml);
      v.ventas += fnum(r.precio); v.gan += fnum(r.precio) - fnum(r.costo);
    }
    return rows("SELECT * FROM perfumes ORDER BY nombre COLLATE NOCASE").map(p => {
      const s = estado(p.id, st), vol = fnum(p.vol_ml) || 100;
      p.frascos = r2(s.u); p.ml = r2(s.ml);
      p.pct = vol ? s.ml / vol : 0;
      p.costo_ml = costoMl(p, s); p.costo_frasco_prom = costoUnidad(p, s);
      p.valor_cerrados = Math.max(s.uval, 0); p.valor_abierto = Math.max(s.mlval, 0); p.valor = p.valor_cerrados + p.valor_abierto;
      p.precio_parcial = Math.round(fnum(p.precio_frasco) * Math.max(p.pct, 0));
      p.abierto_desde = s.ml > 0 ? s.abierto : null;
      p.dias_abierto = p.abierto_desde ? diasDesde(p.abierto_desde) : null;
      p.ult_venta = s.ult_venta;
      p.dias_sin_venta = s.ult_venta ? diasDesde(s.ult_venta) : null;
      const v = vend.map.get(p.id) || { ml: 0, frascos: 0, ventas: 0, gan: 0 };
      p.ml_vendidos_60d = v.ml; p.frascos_vendidos_60d = v.frascos; p.ventas_60d = v.ventas; p.ganancia_60d = v.gan;
      p.dias_alcanza = v.ml > 0 && s.ml > 0 ? Math.round(s.ml / (v.ml / 60)) : null;
      const tiene = s.ml > 0.5 || s.u > 0;
      p.estado = !tiene ? "agotado" : s.ml < bajo && s.u <= 0 ? "bajo" : "ok";
      p.quieto = tiene && (p.dias_sin_venta === null || p.dias_sin_venta > quieto) && ((diasDesde(s.ult_compra) || 999) > quieto);
      p.frasco_viejo = p.dias_abierto !== null && p.dias_abierto > viejo && p.pct > 0.3;
      p.se_vende = v.ml >= 10 || v.frascos >= 1;
      return p;
    });
  }

  function insumosConStock() {
    return rows(`SELECT i.*,
      COALESCE((SELECT SUM(cantidad) FROM insumo_movs m WHERE m.insumo_id=i.id),0) AS stock,
      COALESCE((SELECT SUM(cantidad) FROM insumo_movs m WHERE m.insumo_id=i.id AND cantidad>0),0) AS comprado,
      COALESCE((SELECT -SUM(cantidad) FROM insumo_movs m WHERE m.insumo_id=i.id AND cantidad<0 AND fecha>=?),0) AS usado_60d
      FROM insumos i ORDER BY i.nombre`, [haceDias(60)]).map(i => {
      i.stock = r2(i.stock); i.valor = Math.max(i.stock, 0) * fnum(i.costo_unit); i.bajo = i.stock <= fnum(i.stock_min);
      return i;
    });
  }

  // ---------------------------------------------------------------- clientes / proveedores
  function clienteId(nombre) {
    nombre = spaces(nombre);
    if (!nombre) return null;
    const r = one("SELECT id FROM clientes WHERE lower(nombre)=lower(?)", [nombre]);
    return r ? r.id : insert("clientes", { nombre, creado: hoy() });
  }
  function proveedorId(nombre) {
    nombre = spaces(nombre);
    if (!nombre) return null;
    const r = one("SELECT id FROM proveedores WHERE lower(nombre)=lower(?)", [nombre]);
    return r ? r.id : insert("proveedores", { nombre });
  }
  function telefonoWa(tel) {
    let d = String(tel || "").replace(/\D/g, "");
    if (!d) return null;
    if (d.length === 8) d = "591" + d;
    return d;
  }

  function clientesConStats(cfg) {
    const riesgo = fnum(cfg.dias_cliente_riesgo, 45), perdido = fnum(cfg.dias_cliente_perdido, 120);
    const cl = rows("SELECT * FROM clientes");
    const vs = rows(`SELECT v.id, v.fecha, v.cliente_id, v.total,
      COALESCE((SELECT SUM(costo) FROM movimientos m WHERE m.venta_id=v.id AND m.tipo IN ('venta_decant','venta_parcial','venta_frasco')),0) costo
      FROM ventas v WHERE v.cliente_id IS NOT NULL`);
    const items = rows(`SELECT v.cliente_id, m.perfume_id, m.tipo, v.fecha, p.nombre FROM movimientos m
      JOIN ventas v ON v.id=m.venta_id JOIN perfumes p ON p.id=m.perfume_id
      WHERE v.cliente_id IS NOT NULL AND m.tipo IN ('venta_decant','venta_parcial','venta_frasco')`);
    const agg = groupDefault(() => ({ n: 0, total: 0, gan: 0, primera: null, ultima: null }));
    for (const v of vs) {
      const a = agg.get(v.cliente_id);
      a.n++; a.total += fnum(v.total); a.gan += fnum(v.total) - fnum(v.costo);
      a.primera = a.primera && a.primera < v.fecha ? a.primera : v.fecha;
      a.ultima = (a.ultima || "") > v.fecha ? a.ultima : v.fecha;
    }
    const fav = groupDefault(() => new Map()), decantDe = groupDefault(() => new Map()), frascoDe = groupDefault(() => new Set());
    for (const it of items) {
      const f = fav.get(it.cliente_id); f.set(it.nombre, (f.get(it.nombre) || 0) + 1);
      if (it.tipo === "venta_decant") { const d = decantDe.get(it.cliente_id); const prev = d.get(it.perfume_id) || ""; d.set(it.perfume_id, prev > it.fecha ? prev : it.fecha); }
      else frascoDe.get(it.cliente_id).add(it.perfume_id);
    }
    const totales = [...agg.map.values()].map(a => a.total).sort((a, b) => b - a);
    const vipCorte = totales.length >= 10 ? totales[Math.max(0, Math.floor(totales.length / 10) - 1)] : (totales[0] || 0);
    const out = cl.map(c => {
      const a = agg.map.get(c.id) || { n: 0, total: 0, gan: 0, primera: null, ultima: null };
      const dias = diasDesde(a.ultima);
      const seg = a.n === 0 ? "Sin compras" : dias > perdido ? "Perdido" : dias > riesgo ? "En riesgo" : a.n >= 3 ? "Frecuente" : a.n === 1 ? "Nuevo" : "Activo";
      const f = fav.map.get(c.id);
      let favorito = "";
      if (f) { let best = -1; for (const [k, n] of f) if (n > best) { best = n; favorito = k; } }
      const fr = frascoDe.map.get(c.id) || new Set();
      const probo = [...(decantDe.map.get(c.id) || new Map()).keys()].filter(pid => !fr.has(pid));
      return { ...c, compras: a.n, total: a.total, ganancia: a.gan, primera: a.primera, ultima: a.ultima, dias, segmento: seg,
        ticket: a.n ? a.total / a.n : 0, vip: a.n > 0 && a.total >= vipCorte && vipCorte > 0, favorito, probo_decant: probo, wa: telefonoWa(c.telefono) };
    });
    out.sort((x, y) => y.total - x.total);
    return out;
  }

  // ---------------------------------------------------------------- insumos automáticos
  function insumosAuto() {
    const o = {};
    rows("SELECT id, auto FROM insumos WHERE auto<>''").forEach(r => (o[r.auto] = r.id));
    return o;
  }
  function usarInsumosDecant(auto, fecha, ml, movId, ventaId) {
    const k = tamanoKey(ml);
    for (const key of [...(k ? [`decant_${k}`] : []), "item"])
      if (auto[key]) insert("insumo_movs", { fecha, insumo_id: auto[key], cantidad: -1, venta_id: ventaId, mov_id: movId, notas: "auto" });
  }

  // ---------------------------------------------------------------- ventas
  function perfume(pid) {
    const p = one("SELECT * FROM perfumes WHERE id=?", [Number(pid)]);
    if (!p) err("Perfume no encontrado.");
    return p;
  }
  function siguienteNumero() {
    const r = val("SELECT MAX(CAST(substr(numero,3) AS INTEGER)) FROM ventas WHERE numero LIKE 'V-%'");
    return `V-${String((r || 0) + 1).padStart(5, "0")}`;
  }

  function registrarVenta(d) {
    const fecha = d.fecha || hoy();
    const items = d.items || [];
    if (!items.length) err("La venta no tiene productos.");
    const forzar = !!d.forzar;
    const cid = d.cliente_id ? Number(d.cliente_id) : clienteId(d.cliente);
    const [st] = kardex();
    const desc = fnum(d.descuento_pct) / 100;
    const creado = ahora();
    const vid = insert("ventas", { numero: siguienteNumero(), fecha, cliente_id: cid, notas: String(d.notas || "").trim(), creado });
    const auto = d.usar_insumos === false ? {} : insumosAuto();
    let subtotal = 0, total = 0, hayDecant = false;
    for (const it of items) {
      const p = perfume(it.perfume_id);
      if (!st.has(p.id)) st.set(p.id, emptyState());
      const s = st.get(p.id);
      const kind = it.kind, precioLista = fnum(it.precio);
      const precio = kind === "decant" ? r2(precioLista * (1 - desc)) : precioLista;
      subtotal += precioLista; total += precio;
      if (kind === "frasco") {
        if (s.u < 1 && !forzar) err(`No hay frascos cerrados de ${p.nombre} registrados. ¿Registraste la compra?`);
        const c = r2(costoUnidad(p, s));
        insert("movimientos", { fecha, tipo: "venta_frasco", perfume_id: p.id, unidades: -1, precio, costo: c, venta_id: vid, creado });
        s.u -= 1; s.uval = Math.max(s.uval - c, 0);
      } else if (kind === "decant" || kind === "parcial") {
        const ml = kind === "decant" ? fnum(it.ml) : s.ml;
        if (ml <= 0) err(kind === "parcial" ? `No queda perfume abierto de ${p.nombre}.` : "Falta el tamaño del decant.");
        if (kind === "decant" && s.ml < ml - 0.5) {
          if (s.u >= 1) {
            const c = r2(costoUnidad(p, s)), vol = fnum(p.vol_ml) || 100;
            insert("movimientos", { fecha, tipo: "abrir", perfume_id: p.id, unidades: -1, ml: vol, costo: c, venta_id: vid, notas: "abierto al vender", creado });
            s.u -= 1; s.uval = Math.max(s.uval - c, 0); s.ml += vol; s.mlval += c;
          } else if (!forzar) err(`Solo quedan ${Math.round(s.ml)} ml abiertos de ${p.nombre} y no hay frascos cerrados.`);
        }
        const c = r2(costoMl(p, s) * ml);
        const tipo = kind === "decant" ? "venta_decant" : "venta_parcial";
        const mid = insert("movimientos", { fecha, tipo, perfume_id: p.id, ml: -ml, precio, costo: c, venta_id: vid, creado });
        if (kind === "decant") {
          hayDecant = true; s.ml -= ml; s.mlval = Math.max(s.mlval - c, 0);
          usarInsumosDecant(auto, fecha, ml, mid, vid);
        } else { s.ml = 0; s.mlval = 0; }
      } else err("Producto desconocido.");
    }
    if (hayDecant && d.usar_bolsita !== false && auto.venta)
      insert("insumo_movs", { fecha, insumo_id: auto.venta, cantidad: -1, venta_id: vid, notas: "auto" });
    run("UPDATE ventas SET subtotal=?, descuento=?, total=? WHERE id=?", [r2(subtotal), r2(subtotal - total), r2(total), vid]);
    return { id: vid, numero: val("SELECT numero FROM ventas WHERE id=?", [vid]), total: r2(total) };
  }

  function listarVentas(f) {
    let sql = `SELECT v.*, c.nombre cliente, c.telefono,
      COALESCE((SELECT SUM(costo) FROM movimientos m WHERE m.venta_id=v.id AND m.tipo IN ('venta_decant','venta_parcial','venta_frasco')),0) costo,
      (SELECT GROUP_CONCAT(CASE m.tipo WHEN 'venta_decant' THEN p.nombre||' '||CAST(-m.ml AS INTEGER)||'ml'
                                       WHEN 'venta_parcial' THEN p.nombre||' (abierto '||CAST(-m.ml AS INTEGER)||'ml)'
                                       ELSE p.nombre||' (frasco)' END, ' · ')
       FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id
       WHERE m.venta_id=v.id AND m.tipo IN ('venta_decant','venta_parcial','venta_frasco')) detalle
      FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE 1=1`;
    const args = [];
    if (f.mes) { sql += " AND substr(v.fecha,1,7)=?"; args.push(f.mes); }
    if (f.cliente_id) { sql += " AND v.cliente_id=?"; args.push(Number(f.cliente_id)); }
    if (f.q) {
      sql += " AND (c.nombre LIKE ? OR v.notas LIKE ? OR v.numero LIKE ? OR v.id IN (SELECT m.venta_id FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id WHERE p.nombre LIKE ?))";
      for (let i = 0; i < 4; i++) args.push(`%${f.q}%`);
    }
    sql += " ORDER BY v.fecha DESC, v.id DESC";
    if (f.limit) { sql += " LIMIT ?"; args.push(Number(f.limit)); }
    return rows(sql, args).map(v => ({ ...v, ganancia: r2(fnum(v.total) - fnum(v.costo)) }));
  }

  function ventaDetalle(vid) {
    const v = one("SELECT v.*, c.nombre cliente FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE v.id=?", [vid]);
    if (!v) err("Venta no encontrada.");
    v.items = rows(`SELECT m.*, p.nombre perfume, p.marca FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id
                    WHERE m.venta_id=? ORDER BY m.id`, [vid]).map(it => ({ ...it, tipo_txt: TIPOS[it.tipo] || it.tipo }));
    return v;
  }

  function editarVenta(vid, d) {
    const v = ventaDetalle(vid);
    const fecha = d.fecha || v.fecha;
    let cid = v.cliente_id;
    if ("cliente" in d) cid = clienteId(d.cliente);
    run("UPDATE ventas SET fecha=?, cliente_id=?, notas=? WHERE id=?", [fecha, cid, "notas" in d ? d.notas : v.notas, vid]);
    run("UPDATE movimientos SET fecha=? WHERE venta_id=?", [fecha, vid]);
    run("UPDATE insumo_movs SET fecha=? WHERE venta_id=?", [fecha, vid]);
    for (const [k, x] of Object.entries(d.precios || {})) run("UPDATE movimientos SET precio=? WHERE id=? AND venta_id=?", [fnum(x), Number(k), vid]);
    const tot = val("SELECT COALESCE(SUM(precio),0) FROM movimientos WHERE venta_id=?", [vid]);
    run("UPDATE ventas SET total=?, subtotal=?+descuento WHERE id=?", [tot, tot, vid]);
  }

  // ---------------------------------------------------------------- compras
  function registrarCompra(d) {
    const fecha = d.fecha || hoy();
    const items = d.items || [];
    if (!items.length) err("La compra no tiene productos.");
    const pidProv = proveedorId(d.proveedor);
    const creado = ahora();
    const cmp = insert("compras", { fecha, proveedor_id: pidProv, notas: String(d.notas || "").trim() });
    let total = 0;
    for (const it of items) {
      let p;
      if (it.perfume_id) p = perfume(it.perfume_id);
      else {
        const nombre = spaces(it.nombre);
        if (!nombre) err("Falta el nombre de un perfume.");
        const ex = one("SELECT id FROM perfumes WHERE lower(nombre)=lower(?)", [nombre]);
        const newId = ex ? ex.id : insert("perfumes", { nombre, marca: it.marca || "", vol_ml: fnum(it.vol_ml, 100) || 100,
          costo_ref: fnum(it.costo_unit), precio_frasco: fnum(it.precio_frasco) });
        p = perfume(newId);
      }
      const n = fnum(it.unidades, 1), cu = fnum(it.costo_unit);
      if (n <= 0) err("La cantidad debe ser mayor a 0.");
      insert("movimientos", { fecha, tipo: "compra", perfume_id: p.id, unidades: n, costo: r2(cu * n), compra_id: cmp, creado });
      total += cu * n;
      const upd = cu > 0 ? { costo_ref: cu } : {};
      if (fnum(it.vol_ml) > 0) upd.vol_ml = fnum(it.vol_ml);
      if (fnum(it.precio_frasco) > 0) upd.precio_frasco = fnum(it.precio_frasco);
      const ks = Object.keys(upd);
      if (ks.length) run(`UPDATE perfumes SET ${ks.map(k => k + "=?").join(",")}, activo=1 WHERE id=?`, [...ks.map(k => upd[k]), p.id]);
      const abrir = Math.trunc(fnum(it.abrir));
      for (let i = 0; i < Math.min(abrir, Math.trunc(n)); i++) {
        const vol = fnum(it.vol_ml) || fnum(p.vol_ml) || 100;
        insert("movimientos", { fecha, tipo: "abrir", perfume_id: p.id, unidades: -1, ml: vol, costo: r2(cu), compra_id: cmp, creado });
      }
    }
    run("UPDATE compras SET total=? WHERE id=?", [r2(total), cmp]);
    return { id: cmp, total: r2(total) };
  }

  function listarCompras(f) {
    let sql = `SELECT c.*, pr.nombre proveedor,
      (SELECT GROUP_CONCAT(p.nombre||' ×'||CAST(m.unidades AS INTEGER), ' · ') FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id
       WHERE m.compra_id=c.id AND m.tipo='compra') detalle,
      (SELECT COUNT(*) FROM movimientos m WHERE m.compra_id=c.id AND m.tipo='abrir') abiertos
      FROM compras c LEFT JOIN proveedores pr ON pr.id=c.proveedor_id WHERE 1=1`;
    const args = [];
    if (f.mes) { sql += " AND substr(c.fecha,1,7)=?"; args.push(f.mes); }
    if (f.q) {
      sql += " AND (pr.nombre LIKE ? OR c.id IN (SELECT m.compra_id FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id WHERE p.nombre LIKE ?))";
      args.push(`%${f.q}%`, `%${f.q}%`);
    }
    return rows(sql + " ORDER BY c.fecha DESC, c.id DESC", args);
  }

  const proveedoresConStats = () => rows(`SELECT pr.*, COUNT(c.id) compras, COALESCE(SUM(c.total),0) total, MAX(c.fecha) ultima
    FROM proveedores pr LEFT JOIN compras c ON c.proveedor_id=pr.id GROUP BY pr.id ORDER BY total DESC`);

  // ---------------------------------------------------------------- otras salidas / stock
  function registrarSalida(d) {
    const tipo = d.tipo;
    if (!["regalo", "uso", "merma"].includes(tipo)) err("Tipo inválido.");
    const p = perfume(d.perfume_id);
    const [st] = kardex();
    const s = estado(p.id, st);
    const fecha = d.fecha || hoy(), notas = String(d.notas || "").trim();
    let mid;
    if (d.frasco_cerrado) {
      mid = insert("movimientos", { fecha, tipo, perfume_id: p.id, unidades: -1, costo: r2(costoUnidad(p, s)), notas, creado: ahora() });
    } else {
      const ml = fnum(d.ml);
      if (ml <= 0) err("Indica cuántos ml salieron.");
      mid = insert("movimientos", { fecha, tipo, perfume_id: p.id, ml: -ml, costo: r2(costoMl(p, s) * ml), notas, creado: ahora() });
      if (tipo === "regalo" && d.usar_insumos !== false) usarInsumosDecant(insumosAuto(), fecha, ml, mid, null);
    }
    return { id: mid };
  }

  function abrirFrasco(d) {
    const p = perfume(d.perfume_id);
    const [st] = kardex();
    const s = estado(p.id, st);
    if (s.u < 1) err("No hay frascos cerrados de este perfume. Registra primero la compra (en Compras puedes marcar 'abrir para decants').");
    const vol = fnum(d.vol_ml) || fnum(p.vol_ml) || 100;
    insert("movimientos", { fecha: d.fecha || hoy(), tipo: "abrir", perfume_id: p.id, unidades: -1, ml: vol, costo: r2(costoUnidad(p, s)),
      notas: String(d.notas || "").trim(), creado: ahora() });
  }

  function ajustarStock(d) {
    const p = perfume(d.perfume_id);
    const [st] = kardex();
    const s = estado(p.id, st);
    const fecha = d.fecha || hoy(), nota = String(d.notas || "Conteo de stock").trim();
    let cambios = 0;
    if (d.ml !== undefined && d.ml !== null && d.ml !== "") {
      const diff = r2(fnum(d.ml) - s.ml);
      if (Math.abs(diff) >= 0.01) {
        insert("movimientos", { fecha, tipo: diff < 0 ? "merma" : "ajuste", perfume_id: p.id, ml: diff, costo: r2(Math.abs(diff) * costoMl(p, s)), notas: nota, creado: ahora() });
        cambios++;
      }
    }
    if (d.frascos !== undefined && d.frascos !== null && d.frascos !== "") {
      const diff = r2(fnum(d.frascos) - s.u);
      if (Math.abs(diff) >= 0.01) {
        insert("movimientos", { fecha, tipo: diff < 0 ? "merma" : "ajuste", perfume_id: p.id, unidades: diff, costo: r2(Math.abs(diff) * costoUnidad(p, s)), notas: nota, creado: ahora() });
        cambios++;
      }
    }
    return { cambios };
  }

  function historialPerfume(pid) {
    const [, post] = kardex();
    return rows(`SELECT m.*, c.nombre cliente, pr.nombre proveedor, v.numero FROM movimientos m
      LEFT JOIN ventas v ON v.id=m.venta_id LEFT JOIN clientes c ON c.id=v.cliente_id
      LEFT JOIN compras cp ON cp.id=m.compra_id LEFT JOIN proveedores pr ON pr.id=cp.proveedor_id
      WHERE m.perfume_id=? ORDER BY m.id DESC`, [Number(pid)]).map(m => {
      const [fp, mp] = post.get(m.id) || [null, null];
      return { ...m, tipo_txt: TIPOS[m.tipo] || m.tipo, frascos_post: fp, ml_post: mp };
    });
  }

  function unirPerfumes(origen, destino) {
    origen = Number(origen); destino = Number(destino);
    if (origen === destino) err("Elige un perfume distinto.");
    perfume(origen); perfume(destino);
    run("UPDATE movimientos SET perfume_id=? WHERE perfume_id=?", [destino, origen]);
    run("DELETE FROM perfumes WHERE id=?", [origen]);
  }

  function borrarMovimiento(mid) {
    const m = one("SELECT venta_id, compra_id FROM movimientos WHERE id=?", [mid]);
    if (m && (m.venta_id || m.compra_id)) err("Este movimiento es parte de una venta o compra. Bórralo desde Ventas o Compras.");
    run("DELETE FROM movimientos WHERE id=?", [mid]);
  }

  // ---------------------------------------------------------------- oportunidades
  function pendientes(cfg) {
    const perf = perfumesConStock(cfg), cls = clientesConStats(cfg);
    const pmap = new Map(perf.map(p => [p.id, p]));
    const reponer = perf.filter(p => p.activo && p.se_vende && ["bajo", "agotado"].includes(p.estado)).sort((a, b) => b.ventas_60d - a.ventas_60d);
    const escribir = cls.filter(c => c.segmento === "En riesgo" && c.compras >= 2).slice(0, 10);
    const d60 = haceDias(60), ofrecer = [];
    for (const c of cls) for (const pid of c.probo_decant) {
      const p = pmap.get(pid);
      if (p && (c.ultima || "") >= d60) ofrecer.push({ cliente: c.nombre, cliente_id: c.id, wa: c.wa, perfume: p.nombre, precio: p.precio_frasco, hay_cerrado: p.frascos > 0 });
    }
    ofrecer.sort((a, b) => (a.hay_cerrado === b.hay_cerrado ? (a.cliente < b.cliente ? -1 : a.cliente > b.cliente ? 1 : 0) : a.hay_cerrado ? -1 : 1));
    return {
      reponer: reponer.slice(0, 12), frascos_viejos: perf.filter(p => p.frasco_viejo),
      quietos: perf.filter(p => p.quieto).sort((a, b) => b.valor - a.valor),
      insumos_bajos: insumosConStock().filter(i => i.bajo), escribir, ofrecer: ofrecer.slice(0, 12),
      negativos: perf.filter(p => p.ml < -0.5 || p.frascos < 0),
    };
  }

  // ---------------------------------------------------------------- resumen y salud
  const CAMPOS = ["ventas_decants", "ventas_parciales", "ventas_frascos", "ventas_total", "costo_decants", "costo_parciales", "costo_frascos",
    "costo_ventas", "utilidad_bruta", "regalos", "uso", "mermas", "insumos", "gastos", "utilidad_neta", "retiros", "n_ventas", "n_decants",
    "ml_vendidos", "n_frascos", "n_parciales", "n_regalos", "compras_perfumes", "compras_insumos", "flujo_neto", "util_acum", "flujo_acum", "clientes_nuevos"];
  const esRetiro = cat => String(cat || "").toLowerCase().includes("retiro");

  function resumen(cfg, desde, hasta) {
    const cur = hoy().slice(0, 7);
    const movs = rows(`SELECT m.*, p.nombre perfume, v.cliente_id FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id
                       LEFT JOIN ventas v ON v.id=m.venta_id`);
    const ventas = rows("SELECT * FROM ventas");
    const ims = rows("SELECT im.*, i.costo_unit FROM insumo_movs im JOIN insumos i ON i.id=im.insumo_id");
    const gas = rows("SELECT * FROM gastos");
    const fechas = [...movs.map(m => m.fecha), ...gas.map(g => g.fecha), ...ims.map(i => i.fecha)].filter(Boolean).sort();
    const first = fechas.length ? fechas[0].slice(0, 7) : cur;
    const lastF = fechas.length ? fechas[fechas.length - 1].slice(0, 7) : cur;
    const months = monthRange(first, lastF > cur ? lastF : cur);
    const M = {};
    months.forEach(ym => { M[ym] = {}; CAMPOS.forEach(k => (M[ym][k] = 0)); });
    const add = (f, k, v) => { if (f && M[f.slice(0, 7)]) M[f.slice(0, 7)][k] += v; };
    for (const m of movs) {
      const t = m.tipo, f = m.fecha, pr = fnum(m.precio), c = fnum(m.costo);
      if (t === "venta_decant") { add(f, "ventas_decants", pr); add(f, "costo_decants", c); add(f, "n_decants", 1); add(f, "ml_vendidos", -fnum(m.ml)); }
      else if (t === "venta_parcial") { add(f, "ventas_parciales", pr); add(f, "costo_parciales", c); add(f, "n_parciales", 1); add(f, "ml_vendidos", -fnum(m.ml)); }
      else if (t === "venta_frasco") { add(f, "ventas_frascos", pr); add(f, "costo_frascos", c); add(f, "n_frascos", 1); }
      else if (t === "regalo") { add(f, "regalos", c); add(f, "n_regalos", 1); }
      else if (t === "uso") add(f, "uso", c);
      else if (t === "merma") add(f, "mermas", c);
      else if (t === "compra") add(f, "compras_perfumes", c);
    }
    ventas.forEach(v => add(v.fecha, "n_ventas", 1));
    const primeraCli = new Map();
    [...ventas].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)).forEach(v => {
      if (v.cliente_id && !primeraCli.has(v.cliente_id)) primeraCli.set(v.cliente_id, v.fecha);
    });
    primeraCli.forEach(f => add(f, "clientes_nuevos", 1));
    for (const i of ims) {
      if (fnum(i.cantidad) < 0) add(i.fecha, "insumos", -fnum(i.cantidad) * fnum(i.costo_unit));
      else add(i.fecha, "compras_insumos", fnum(i.costo_total));
    }
    gas.forEach(g => add(g.fecha, esRetiro(g.categoria) ? "retiros" : "gastos", fnum(g.monto)));
    let ua = 0, fa = 0;
    for (const ym of months) {
      const r = M[ym];
      r.ventas_total = r.ventas_decants + r.ventas_parciales + r.ventas_frascos;
      r.costo_ventas = r.costo_decants + r.costo_parciales + r.costo_frascos;
      r.utilidad_bruta = r.ventas_total - r.costo_ventas;
      r.utilidad_neta = r.utilidad_bruta - r.regalos - r.uso - r.mermas - r.insumos - r.gastos;
      r.flujo_neto = r.ventas_total - r.compras_perfumes - r.compras_insumos - r.gastos - r.retiros;
      ua += r.utilidad_neta; fa += r.flujo_neto;
      r.util_acum = ua; r.flujo_acum = fa;
      r.margen_bruto = r.ventas_total ? r.utilidad_bruta / r.ventas_total : 0;
      r.margen_neto = r.ventas_total ? r.utilidad_neta / r.ventas_total : 0;
      r.ticket = r.n_ventas ? r.ventas_total / r.n_ventas : 0;
      r.mes = ym; r.mes_txt = nombreMes(ym);
    }
    desde = desde || first; hasta = hasta || cur;
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    return { M, months, desde, hasta, movs, ventas };
  }

  function tot(rs) {
    const t = {};
    CAMPOS.filter(k => k !== "util_acum" && k !== "flujo_acum").forEach(k => (t[k] = sum(rs, r => r[k])));
    t.margen_bruto = t.ventas_total ? t.utilidad_bruta / t.ventas_total : 0;
    t.margen_neto = t.ventas_total ? t.utilidad_neta / t.ventas_total : 0;
    t.ticket = t.n_ventas ? t.ventas_total / t.n_ventas : 0;
    t.meses = rs.length;
    return t;
  }

  function inicio(cfg) {
    const { M, movs, ventas } = resumen(cfg);
    const today = new Date();
    const lunes = new Date(today); lunes.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const periodo = desde => {
      const vs = ventas.filter(v => v.fecha >= desde);
      const ms = movs.filter(m => m.fecha >= desde && VENTA_TIPOS.includes(m.tipo));
      const t = sum(vs, v => fnum(v.total));
      return { ventas: t, ganancia: t - sum(ms, m => fnum(m.costo)), n: vs.length };
    };
    const cur = hoy().slice(0, 7), ant = addMonths(cur, -1), A = M[ant] || {};
    return { hoy: periodo(hoy()), semana: periodo(isoDate(lunes)), mes: periodo(cur + "-01"),
      mes_ant: { ventas: A.ventas_total || 0, utilidad_neta: A.utilidad_neta || 0, n: A.n_ventas || 0 },
      mes_util_neta: (M[cur] || {}).utilidad_neta || 0, pendientes: pendientes(cfg) };
  }

  function conversionDecantFrasco() {
    const it = rows(`SELECT v.cliente_id, m.perfume_id, m.tipo, v.fecha FROM movimientos m JOIN ventas v ON v.id=m.venta_id
                     WHERE v.cliente_id IS NOT NULL AND m.tipo IN ('venta_decant','venta_parcial','venta_frasco') ORDER BY v.fecha`);
    const primero = new Map(), conv = new Set();
    for (const r of it) {
      const k = r.cliente_id + "|" + r.perfume_id;
      if (r.tipo === "venta_decant") { if (!primero.has(k)) primero.set(k, r.fecha); }
      else if (primero.has(k) && r.fecha >= primero.get(k)) conv.add(k);
    }
    return { probaron: primero.size, compraron_frasco: conv.size, tasa: primero.size ? conv.size / primero.size : 0 };
  }

  function salud(cfg, desdeQ, hastaQ) {
    const { M, months, desde, hasta, movs, ventas } = resumen(cfg, desdeQ, hastaQ);
    const cur = hoy().slice(0, 7);
    const sel = months.filter(ym => desde <= ym && ym <= hasta).map(ym => M[ym]);
    const T = tot(sel);
    const inr = f => !!f && desde <= f.slice(0, 7) && f.slice(0, 7) <= hasta;
    const perf = perfumesConStock(cfg), ins = insumosConStock(), cls = clientesConStats(cfg);
    const inventario = { cerrados: sum(perf, p => p.valor_cerrados), abiertos: sum(perf, p => p.valor_abierto), insumos: sum(ins, i => i.valor) };
    inventario.total = inventario.cerrados + inventario.abiertos + inventario.insumos;
    const quietos = perf.filter(p => p.quieto);
    inventario.quieto = sum(quietos, p => p.valor); inventario.n_quietos = quietos.length;

    const vm = movs.filter(m => VENTA_TIPOS.includes(m.tipo) && inr(m.fecha));
    const pl = groupDefault(() => ({ n: 0, ventas: 0, costo: 0 })), pt = groupDefault(() => ({ n: 0, ventas: 0, costo: 0 }));
    const pp = groupDefault(() => ({ n: 0, ventas: 0, costo: 0, ml: 0, frascos: 0 }));
    for (const m of vm) {
      for (const [d, k] of [[pl, LINEA[m.tipo]], [pp, m.perfume]]) { const o = d.get(k); o.n++; o.ventas += fnum(m.precio); o.costo += fnum(m.costo); }
      if (m.tipo === "venta_decant") {
        const k0 = tamanoKey(-fnum(m.ml)), k = k0 ? `${k0} ml` : "Otros tamaños";
        const o = pt.get(k); o.n++; o.ventas += fnum(m.precio); o.costo += fnum(m.costo);
        pp.get(m.perfume).ml += -fnum(m.ml);
      } else if (m.tipo === "venta_frasco") pp.get(m.perfume).frascos += 1;
      else pp.get(m.perfume).ml += -fnum(m.ml);
    }
    const fin = d => [...d.map.entries()].map(([k, v]) => ({ nombre: k, ...v, ganancia: v.ventas - v.costo,
      margen: v.ventas ? (v.ventas - v.costo) / v.ventas : 0, participacion: T.ventas_total ? v.ventas / T.ventas_total : 0,
      precio_prom: v.n ? v.ventas / v.n : 0 }));
    const porLinea = fin(pl).sort((a, b) => b.ventas - a.ventas);
    const orden = { "2 ml": 0, "3 ml": 1, "5 ml": 2, "9 ml": 3 };
    const porTamano = fin(pt).sort((a, b) => (orden[a.nombre] ?? 9) - (orden[b.nombre] ?? 9));
    const auto = {};
    rows("SELECT auto, costo_unit FROM insumos WHERE auto<>''").forEach(r => (auto[r.auto] = fnum(r.costo_unit)));
    for (const t of porTamano) {
      const k = t.nombre.split(" ")[0];
      const extra = /^\d+$/.test(k) ? (auto[`decant_${k}`] || 0) + (auto.item || 0) : 0;
      t.costo_real_prom = (t.n ? t.costo / t.n : 0) + extra;
      t.margen_real = t.precio_prom ? (t.precio_prom - t.costo_real_prom) / t.precio_prom : 0;
    }
    const porPerfume = fin(pp).sort((a, b) => b.ganancia - a.ganancia);
    const perdidas = vm.filter(m => fnum(m.precio) < fnum(m.costo) - 0.01).map(m => ({ fecha: m.fecha, perfume: m.perfume, tipo: TIPOS[m.tipo],
      precio: fnum(m.precio), costo: fnum(m.costo), perdida: fnum(m.precio) - fnum(m.costo) })).sort((a, b) => a.perdida - b.perdida);

    const vsP = ventas.filter(v => inr(v.fecha)), conCli = vsP.filter(v => v.cliente_id);
    const cliP = new Map();
    conCli.forEach(v => cliP.set(v.cliente_id, (cliP.get(v.cliente_id) || 0) + 1));
    const seg = {};
    cls.forEach(c => (seg[c.segmento] = (seg[c.segmento] || 0) + 1));
    const compradores = cls.filter(c => c.compras > 0);
    const conv = conversionDecantFrasco();
    const top5 = sum(cls.slice(0, 5), c => c.total), totCli = sum(cls, c => c.total) || 1;
    const totVsP = sum(vsP, v => fnum(v.total));
    const clientes = {
      con_nombre_periodo: cliP.size, nuevos_periodo: T.clientes_nuevos,
      recompra_periodo: cliP.size ? [...cliP.values()].filter(n => n >= 2).length / cliP.size : 0,
      recompra_historica: compradores.length ? compradores.filter(c => c.compras >= 2).length / compradores.length : 0,
      pct_ventas_con_nombre: vsP.length && totVsP ? sum(conCli, v => fnum(v.total)) / totVsP : 0,
      segmentos: seg, top: cls.slice(0, 10).map(c => ({ nombre: c.nombre, total: c.total, compras: c.compras, ultima: c.ultima, segmento: c.segmento })),
      concentracion_top5: top5 / totCli, conversion: conv,
    };

    const completos = months.filter(ym => ym < cur && M[ym].ventas_total > 0);
    const u3 = completos.slice(-3), p3 = completos.slice(-6, -3), u12 = completos.slice(-12);
    const avg = (ms, k) => (ms.length ? sum(ms, m => M[m][k]) / ms.length : 0);
    const util3 = avg(u3, "utilidad_neta"), ventas3 = avg(u3, "ventas_total"), ventasP3 = avg(p3, "ventas_total");
    const tendencia = ventasP3 ? (ventas3 - ventasP3) / ventasP3 : null;
    const s12 = k => sum(u12, m => M[m][k]);
    const v12 = s12("ventas_total"), ub12 = s12("utilidad_bruta"), un12 = s12("utilidad_neta"), cv12 = s12("costo_ventas"), ret12 = s12("retiros");
    const factor = u12.length ? 12 / u12.length : 0;
    const margen12 = v12 ? un12 / v12 : 0;
    const rotacion = inventario.total ? (cv12 * factor) / inventario.total : null;
    const diasInv = rotacion ? 365 / rotacion : null;
    const gmroi = inventario.total ? (ub12 * factor) / inventario.total : null;
    const mesesPerdida = u12.filter(m => M[m].utilidad_neta < 0).length;
    const enU12 = m => VENTA_TIPOS.includes(m.tipo) && u12.includes(m.fecha.slice(0, 7)) && fnum(m.precio) < fnum(m.costo) - 0.01;
    const perdidas12 = movs.filter(enU12).length;

    const senales = [];
    const s = (nivel, titulo, texto) => senales.push({ nivel, titulo, texto });
    if (u3.length) s(util3 > 0 ? "ok" : "bad", "Ganancia", util3 > 0 ? `Gana en promedio ${bsTxt(util3)} por mes (últimos ${u3.length} meses completos).` : `Está perdiendo ${bsTxt(-util3)} por mes en promedio.`);
    if (tendencia !== null) s(tendencia >= 0 ? "ok" : tendencia > -0.15 ? "warn" : "bad", "Ventas", `Las ventas ${tendencia >= 0 ? "subieron" : "bajaron"} ${pcTxt(Math.abs(tendencia))} comparando los últimos 3 meses con los 3 anteriores.`);
    if (v12) s(margen12 >= 0.2 ? "ok" : margen12 >= 0.1 ? "warn" : "bad", "Margen", `De cada Bs 100 vendidos, quedan Bs ${Math.round(margen12 * 100)} de ganancia limpia.`);
    if (gmroi !== null) s(gmroi >= 2 ? "ok" : gmroi >= 1 ? "warn" : "bad", "Rendimiento del inventario", `Cada Bs 1 invertido en mercadería deja Bs ${gmroi.toFixed(1)} de ganancia bruta al año (lo sano es 2 o más).`);
    if (diasInv !== null) s(diasInv <= 90 ? "ok" : diasInv <= 180 ? "warn" : "bad", "Rotación", `Con el ritmo actual, el inventario se vendería en unos ${Math.round(diasInv)} días.`);
    if (inventario.total) {
      const q = inventario.quieto / inventario.total;
      s(q < 0.15 ? "ok" : q < 0.35 ? "warn" : "bad", "Stock quieto", `${inventario.n_quietos} perfumes no se venden hace más de ${cfg.dias_sin_venta} días: ${bsTxt(inventario.quieto)} parados (${pcTxt(q)} del inventario).`);
    }
    if (compradores.length) {
      const r = clientes.recompra_historica;
      s(r >= 0.3 ? "ok" : r >= 0.15 ? "warn" : "bad", "Clientes que vuelven", `${pcTxt(r)} de los clientes con nombre compraron más de una vez.`);
    }
    if (perdidas12) {
      const monto = -sum(movs.filter(enU12), m => fnum(m.precio) - fnum(m.costo));
      s(!v12 || monto / v12 < 0.03 ? "warn" : "bad", "Ventas con pérdida", `${perdidas12} ventas por debajo del costo en el último año (${bsTxt(monto)} perdidos).`);
    }
    if (un12 > 0 && ret12) s(ret12 <= un12 ? "ok" : "bad", "Retiros del dueño", `Se retiraron ${bsTxt(ret12)} de ${bsTxt(un12)} ganados en el último año.` + (ret12 <= un12 ? "" : " Se está sacando más de lo que se gana."));

    const bad = senales.filter(x => x.nivel === "bad").length, warn = senales.filter(x => x.nivel === "warn").length;
    let veredicto, nivel;
    if (!u3.length) [veredicto, nivel] = ["Sin datos suficientes", "warn"];
    else if (util3 <= 0 || bad >= 2) [veredicto, nivel] = ["En riesgo", "bad"];
    else if (bad === 1 || warn >= 3) [veredicto, nivel] = ["Necesita atención", "warn"];
    else [veredicto, nivel] = ["Saludable", "ok"];

    const consejos = consejosTxt(porLinea, perdidas, quietos, clientes, T, inventario, tendencia, cfg);
    const d = new Date();
    return {
      negocio: cfg.negocio, desde, hasta, meses_disponibles: months,
      generado: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      veredicto, nivel, senales, consejos, totales: T, mensual: sel, por_linea: porLinea, por_tamano: porTamano,
      por_perfume: porPerfume, perdidas, clientes, inventario,
      quietos: [...quietos].sort((a, b) => b.valor - a.valor).slice(0, 12).map(p => ({ nombre: p.nombre, valor: p.valor, frascos: p.frascos, ml: p.ml, dias_sin_venta: p.dias_sin_venta })),
      indicadores: { util_prom_3m: util3, ventas_prom_3m: ventas3, tendencia, margen_neto_12m: margen12, rotacion, dias_inventario: diasInv,
        gmroi, meses_con_perdida: mesesPerdida, retiros_12m: ret12, utilidad_12m: un12, meses_evaluados: u3 },
    };
  }

  function consejosTxt(porLinea, perdidas, quietos, clientes, T, inv, tendencia, cfg) {
    const out = [];
    const lin = Object.fromEntries(porLinea.map(l => [l.nombre, l]));
    const dec = lin["Decants"], fr = lin["Frascos cerrados"];
    if (dec && fr && dec.margen > fr.margen * 1.8)
      out.push(`Los decants dejan ${Math.round(dec.margen * 100)}% de margen y los frascos cerrados ${Math.round(fr.margen * 100)}%. Los frascos traen ventas, pero la ganancia está en los decants: conviene empujar decants y packs.`);
    if (perdidas.length)
      out.push(`Hubo ${perdidas.length} ventas por debajo del costo (${bsTxt(-sum(perdidas, p => p.perdida))} perdidos). Antes de dar descuentos, revisar el costo que muestra la venta.`);
    if (quietos.length) {
      const top = [...quietos].sort((a, b) => b.valor - a.valor).slice(0, 4).map(p => p.nombre).join(", ");
      out.push(`Hay ${bsTxt(inv.quieto)} en perfumes que no se mueven (${top}…). Ofrecerlos en promo o como decant para recuperar ese dinero.`);
    }
    if (T.ventas_total && T.regalos / T.ventas_total > 0.02)
      out.push(`Los regalos costaron ${bsTxt(T.regalos)} (${(T.regalos / T.ventas_total * 100).toFixed(1)}% de las ventas). Que cada regalo tenga un objetivo (cliente nuevo, reseña, referido).`);
    if (clientes.segmentos["En riesgo"])
      out.push(`${clientes.segmentos["En riesgo"]} clientes no compran hace más de ${cfg.dias_cliente_riesgo} días. Un mensaje por WhatsApp con novedades puede recuperarlos.`);
    const cv = clientes.conversion;
    if (cv.probaron)
      out.push(`De ${cv.probaron} veces que un cliente probó un perfume en decant, ${cv.compraron_frasco} terminaron comprando el frasco (${Math.round(cv.tasa * 100)}%). Ofrecer el frasco a quien ya probó el decant es la venta más fácil.`);
    if (clientes.pct_ventas_con_nombre < 0.85)
      out.push(`Solo el ${Math.round(clientes.pct_ventas_con_nombre * 100)}% de las ventas tiene cliente registrado. Anotar siempre el cliente permite saber quién vuelve.`);
    if (tendencia !== null && tendencia < -0.1)
      out.push("Las ventas vienen bajando: revisar qué perfumes se agotaron y no se repusieron (ver 'Para reponer' en Inicio).");
    return out;
  }

  // ---------------------------------------------------------------- simple CRUD
  function cleanRow(tabla, data, parcial) {
    const out = {};
    for (const [k, t] of Object.entries(TABLAS[tabla])) {
      if (!(k in data)) continue;
      const v = data[k];
      out[k] = t === T_NUM ? fnum(v) : t === T_INT ? Math.trunc(fnum(v)) : v === null || v === undefined ? "" : String(v).trim();
    }
    if (!parcial) for (const k of REQUERIDOS[tabla] || []) if (out[k] === undefined || out[k] === "") err(`Falta completar: ${k}`);
    return out;
  }

  // ---------------------------------------------------------------- router (same routes as the PC Tool server)
  function api(method, path, body) {
    const [p0, qs] = path.split("?");
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    const p = p0.split("/").filter(Boolean);
    const r0 = p[0] || "", rid = p[1] && /^\d+$/.test(p[1]) ? Number(p[1]) : null, sub = p[2] || null;
    const cfg = getConfig();
    const ok = (o = {}) => ({ ok: true, ...o });
    const d = body || {};

    if (r0 === "bootstrap") {
      const cats = rows("SELECT DISTINCT categoria FROM gastos WHERE categoria<>''").map(r => r.categoria);
      return { config: cfg, hoy: hoy(), perfumes: perfumesConStock(cfg), insumos: insumosConStock(),
        clientes: rows("SELECT id, nombre, telefono FROM clientes ORDER BY nombre COLLATE NOCASE"),
        proveedores: rows("SELECT id, nombre FROM proveedores ORDER BY nombre COLLATE NOCASE"),
        categorias_gasto: [...new Set([...CATEGORIAS_GASTO, ...cats])].sort(), tipos: TIPOS };
    }
    if (r0 === "inicio") return inicio(cfg);
    if (r0 === "salud") return salud(cfg, q.desde, q.hasta);

    if (r0 === "ventas") {
      if (method === "GET" && rid) return ventaDetalle(rid);
      if (method === "GET") return listarVentas(q);
      if (method === "POST") return registrarVenta(d);
      if (method === "PUT" && rid) { editarVenta(rid, d); return ok(); }
      if (method === "DELETE" && rid) { run("DELETE FROM ventas WHERE id=?", [rid]); return ok(); }
    }
    if (r0 === "compras") {
      if (method === "GET" && rid) {
        const c = one("SELECT c.*, pr.nombre proveedor FROM compras c LEFT JOIN proveedores pr ON pr.id=c.proveedor_id WHERE c.id=?", [rid]);
        if (!c) err("Compra no encontrada.");
        c.items = rows("SELECT m.*, p.nombre perfume FROM movimientos m JOIN perfumes p ON p.id=m.perfume_id WHERE m.compra_id=? ORDER BY m.id", [rid]);
        return c;
      }
      if (method === "GET") return listarCompras(q);
      if (method === "POST") return registrarCompra(d);
      if (method === "DELETE" && rid) { run("DELETE FROM compras WHERE id=?", [rid]); return ok(); }
    }
    if (r0 === "clientes" && method === "GET") {
      if (rid) {
        const c = clientesConStats(cfg).find(x => x.id === rid);
        if (!c) err("Cliente no encontrado.");
        c.ventas = listarVentas({ cliente_id: rid });
        const pmap = new Map(rows("SELECT id, nombre FROM perfumes").map(x => [x.id, x.nombre]));
        c.probo_decant_nombres = c.probo_decant.map(i => pmap.get(i) || "");
        return c;
      }
      return clientesConStats(cfg);
    }
    if (r0 === "clientes" && method === "DELETE" && rid) {
      const n = val("SELECT COUNT(*) FROM ventas WHERE cliente_id=?", [rid]);
      if (n) err(`Este cliente tiene ${n} compras registradas; no se puede borrar.`);
    }
    if (r0 === "clientes" && method === "POST" && sub === "unir") {
      const dest = Number(d.destino_id);
      if (dest === rid) err("Elige un cliente distinto.");
      run("UPDATE ventas SET cliente_id=? WHERE cliente_id=?", [dest, rid]);
      run("DELETE FROM clientes WHERE id=?", [rid]);
      return ok();
    }
    if (r0 === "proveedores" && method === "GET") return proveedoresConStats();
    if (r0 === "proveedores" && method === "DELETE" && rid) {
      if (val("SELECT COUNT(*) FROM compras WHERE proveedor_id=?", [rid])) err("Este proveedor tiene compras registradas; no se puede borrar.");
    }
    if (r0 === "perfumes" && rid && sub === "historial") return historialPerfume(rid);
    if (r0 === "perfumes" && rid && sub === "unir" && method === "POST") { unirPerfumes(rid, d.destino_id); return ok(); }
    if (r0 === "perfumes" && method === "DELETE" && rid) {
      const n = val("SELECT COUNT(*) FROM movimientos WHERE perfume_id=?", [rid]);
      if (n) err(`Este perfume tiene ${n} movimientos. Márcalo como inactivo o únelo con otro.`);
    }
    if (r0 === "salidas" && method === "POST") return registrarSalida(d);
    if (r0 === "abrir" && method === "POST") { abrirFrasco(d); return ok(); }
    if (r0 === "ajuste" && method === "POST") return ajustarStock(d);
    if (r0 === "movimientos" && method === "DELETE" && rid) { borrarMovimiento(rid); return ok(); }

    if (r0 === "insumo_movs") {
      if (method === "GET") return rows(`SELECT m.*, i.nombre insumo, v.numero FROM insumo_movs m JOIN insumos i ON i.id=m.insumo_id
        LEFT JOIN ventas v ON v.id=m.venta_id ORDER BY m.fecha DESC, m.id DESC LIMIT ?`, [Number(q.limit || 200)]);
      if (method === "POST") {
        const iid = Number(d.insumo_id), cant = fnum(d.cantidad);
        if (!cant) err("Indica la cantidad.");
        const total = fnum(d.costo_total);
        insert("insumo_movs", { fecha: d.fecha || hoy(), insumo_id: iid, cantidad: cant, costo_total: total, notas: String(d.notas || "").trim() });
        if (cant > 0 && total > 0) run("UPDATE insumos SET costo_unit=? WHERE id=?", [Math.round(total / cant * 10000) / 10000, iid]);
        return ok();
      }
      if (method === "DELETE" && rid) { run("DELETE FROM insumo_movs WHERE id=?", [rid]); return ok(); }
    }
    if (r0 === "config" && method === "PUT") {
      for (const [k, v] of Object.entries(d)) if (k in DEFAULT_CONFIG)
        run("INSERT INTO config(clave, valor) VALUES(?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor", [k, typeof v === "string" ? v : JSON.stringify(v)]);
      return getConfig();
    }
    if (TABLAS[r0]) {
      if (method === "GET") return rows(`SELECT * FROM ${r0} ORDER BY id DESC`);
      if (method === "POST") {
        const o = cleanRow(r0, d);
        if (r0 === "clientes") {
          o.creado = hoy();
          if (one("SELECT 1 FROM clientes WHERE lower(nombre)=lower(?)", [o.nombre])) err("Ya existe un cliente con ese nombre.");
        }
        return { id: insert(r0, o) };
      }
      if (method === "PUT" && rid) {
        const o = cleanRow(r0, d, true), ks = Object.keys(o);
        if (ks.length) run(`UPDATE ${r0} SET ${ks.map(k => k + "=?").join(",")} WHERE id=?`, [...ks.map(k => o[k]), rid]);
        return ok();
      }
      if (method === "DELETE" && rid) { run(`DELETE FROM ${r0} WHERE id=?`, [rid]); return ok(); }
    }
    const e = new Error("Ruta no encontrada"); e.status = 404; throw e;
  }

  // Runs one request. Changes are kept only if the whole request succeeds.
  function request(method, path, body) {
    if (method === "GET") return api(method, path, body);
    run("SAVEPOINT req");
    try {
      const r = api(method, path, body);
      run("RELEASE req");
      return r;
    } catch (e) {
      run("ROLLBACK TO req"); run("RELEASE req");
      throw e;
    }
  }

  // ---------------------------------------------------------------- data in / out (used by sync.js)
  function open(SQL, bytes) {
    db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    db.run("PRAGMA foreign_keys=ON");
    db.run(SCHEMA);
    const have = new Set(rows("PRAGMA table_info(perfumes)").map(c => c.name));
    for (const [c, def] of [["web", "TEXT DEFAULT 'NO'"], ["destacado", "REAL"], ["familia", "TEXT DEFAULT ''"], ["notas_olf", "TEXT DEFAULT ''"],
      ["descripcion", "TEXT DEFAULT ''"], ["imagen_url", "TEXT DEFAULT ''"]]) if (!have.has(c)) db.run(`ALTER TABLE perfumes ADD COLUMN ${c} ${def}`);
    for (const [k, v] of Object.entries(DEFAULT_CONFIG)) run("INSERT OR IGNORE INTO config(clave, valor) VALUES(?,?)", [k, v]);
  }
  function load(tables) {
    db.run("PRAGMA foreign_keys=OFF");
    db.run("BEGIN");
    try {
      for (const t of Object.keys(TABLE_KEYS)) {
        db.run(`DELETE FROM ${t}`);
        const tb = tables[t];
        if (!tb || !tb.rows.length) continue;
        const have = new Set(rows(`PRAGMA table_info(${t})`).map(c => c.name));
        const idx = tb.columns.map((c, i) => [c, i]).filter(([c]) => have.has(c));
        const st = db.prepare(`INSERT OR REPLACE INTO ${t}(${idx.map(x => x[0]).join(",")}) VALUES(${idx.map(() => "?").join(",")})`);
        for (const r of tb.rows) { st.run(idx.map(([, i]) => (r[i] === undefined ? null : r[i]))); }
        st.free();
      }
      for (const [k, v] of Object.entries(DEFAULT_CONFIG)) run("INSERT OR IGNORE INTO config(clave, valor) VALUES(?,?)", [k, v]);
      db.run("COMMIT");
    } catch (e) { db.run("ROLLBACK"); throw e; }
    finally { db.run("PRAGMA foreign_keys=ON"); }
  }
  function dump() {
    const out = {};
    for (const t of Object.keys(TABLE_KEYS)) {
      const st = db.prepare(`SELECT * FROM ${t}`);
      const columns = st.getColumnNames(), list = [];
      while (st.step()) list.push(st.get());
      st.free();
      out[t] = { columns, rows: list };
    }
    return out;
  }
  function exportBytes() {
    const b = db.export();
    db.run("PRAGMA foreign_keys=ON"); // export() resets this pragma
    return b;
  }

  return { open, load, dump, exportBytes, request, TABLE_KEYS, isOpen: () => !!db };
})();
