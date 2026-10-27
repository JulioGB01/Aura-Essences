// Aura Essences: keeps the local copy (this device) and the Google Sheet in sync.
// Every change is saved on the device first, then sent to the Sheet. Without internet it waits and retries.
const Sync = (() => {
  const CONN = "aura.conn";
  let SQL = null, snap = {}, dirty = false, busy = null, again = false, timer = null, lastSync = 0;
  let state = { status: "idle", text: "" }, sheetUrl = "";
  const listeners = new Set();
  let onRemoteChange = () => {};

  // ---------------------------------------------------------------- device storage (IndexedDB)
  const idb = new Promise((res, rej) => {
    const r = indexedDB.open("aura", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const idbGet = async k => { const d = await idb; return new Promise((res, rej) => { const q = d.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
  const idbSet = async (k, v) => { const d = await idb; return new Promise((res, rej) => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); };
  const idbClear = async () => { const d = await idb; return new Promise(res => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").clear(); t.oncomplete = res; }); };

  function conn() { try { return JSON.parse(localStorage.getItem(CONN) || "null"); } catch { return null; } }
  function setState(status, text = "") { state = { status, text }; listeners.forEach(f => f(state)); }

  // ---------------------------------------------------------------- snapshots and changes
  function snapOf(tables) {
    const out = {};
    for (const [t, tb] of Object.entries(tables)) {
      const keyName = Aura.TABLE_KEYS[t], ki = tb.columns.indexOf(keyName), m = {};
      for (const r of tb.rows) { const o = {}; tb.columns.forEach((c, i) => (o[c] = r[i])); m[String(r[ki])] = o; }
      out[t] = m;
    }
    return out;
  }
  function diff(a, b) {
    const changes = {};
    let n = 0;
    for (const t of Object.keys(Aura.TABLE_KEYS)) {
      const A = a[t] || {}, B = b[t] || {}, keyName = Aura.TABLE_KEYS[t], upsert = [], del = [];
      for (const [k, row] of Object.entries(B)) {
        const old = A[k];
        if (!old) { upsert.push(row); continue; }
        const part = {};
        let changed = false;
        for (const c of Object.keys(row)) if (row[c] !== old[c]) { part[c] = row[c]; changed = true; }
        if (changed) { part[keyName] = row[keyName]; upsert.push(part); }
      }
      for (const k of Object.keys(A)) if (!(k in B)) del.push(A[k][keyName]);
      if (upsert.length || del.length) { changes[t] = { upsert, del }; n += upsert.length + del.length; }
    }
    return n ? changes : null;
  }

  async function persist() {
    await idbSet("db", Aura.exportBytes());
    await idbSet("snap", JSON.stringify(snap));
    await idbSet("dirty", dirty);
  }

  // ---------------------------------------------------------------- talking to the Sheet
  async function call(action, extra = {}, c = conn()) {
    if (!c) throw new Error("Sin conexión configurada.");
    let r;
    try {
      r = await fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ key: c.key, action, ...extra }), redirect: "follow" });
    } catch { const e = new Error("Sin internet"); e.offline = true; throw e; }
    let j;
    try { j = await r.json(); } catch { throw new Error("La hoja no respondió bien. Revisa la URL."); }
    if (j.error) throw new Error(j.error === "Wrong key" ? "Clave incorrecta" : j.error);
    return j;
  }

  async function push() {
    if (!dirty) return;
    const cur = snapOf(Aura.dump());
    const changes = diff(snap, cur);
    if (changes) await call("push", { changes });
    snap = cur;
    dirty = !!diff(snap, snapOf(Aura.dump()));
    await persist();
  }

  async function pull() {
    const j = await call("pull");
    if (j.sheetUrl) { sheetUrl = j.sheetUrl; localStorage.setItem("aura.sheet", sheetUrl); }
    const before = JSON.stringify(snap);
    Aura.load(j.tables);
    snap = snapOf(Aura.dump());
    await persist();
    return JSON.stringify(snap) !== before;
  }

  // Push pending changes, then download the latest data.
  function syncNow({ download = true } = {}) {
    if (busy) { again = true; return busy.then(() => busy || Promise.resolve()); }
    busy = (async () => {
      setState("saving", dirty ? "Guardando…" : "Actualizando…");
      try {
        await push();
        const changed = download && !dirty ? await pull() : false;
        if (dirty) schedule();
        lastSync = Date.now();
        setState("ok", "Guardado en la hoja");
        if (changed) onRemoteChange();
      } catch (e) {
        if (e.offline) setState("offline", dirty ? "Sin internet: se guardará luego" : "Sin internet");
        else setState("error", e.message);
        schedule(30000);
      } finally {
        busy = null;
        if (again) { again = false; syncNow(); }
      }
    })();
    return busy;
  }

  function schedule(ms = 800) {
    clearTimeout(timer);
    timer = setTimeout(() => (dirty ? syncNow({ download: false }) : null), ms);
  }

  async function afterWrite() {
    dirty = true;
    setState("saving", "Guardando…");
    await persist();
    schedule();
  }

  // ---------------------------------------------------------------- start
  async function init(onChange) {
    onRemoteChange = onChange || onRemoteChange;
    sheetUrl = localStorage.getItem("aura.sheet") || "";
    SQL = await initSqlJs({ locateFile: f => "vendor/" + f });
    const bytes = await idbGet("db");
    Aura.open(SQL, bytes ? new Uint8Array(bytes) : null);
    snap = JSON.parse((await idbGet("snap")) || "{}");
    dirty = !!(await idbGet("dirty"));
    window.addEventListener("online", () => syncNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && conn() && Date.now() - lastSync > 60000) syncNow();
    });
    return { hasLocal: !!bytes, hasConn: !!conn() };
  }

  async function connect(url, key) {
    url = String(url || "").trim(); key = String(key || "").trim();
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) throw new Error("La URL debe empezar con https://script.google.com/ y terminar en /exec");
    if (!key) throw new Error("Falta la clave.");
    await call("ping", {}, { url, key });
    localStorage.setItem(CONN, JSON.stringify({ url, key }));
    if (dirty) await push();
    await pull();
    lastSync = Date.now();
    setState("ok", "Guardado en la hoja");
  }

  async function disconnect() {
    localStorage.removeItem(CONN);
    localStorage.removeItem("aura.sheet");
    await idbClear();
  }

  return {
    init, connect, disconnect, syncNow, afterWrite, conn,
    pending: () => dirty, sheetUrl: () => sheetUrl,
    onState: f => { listeners.add(f); f(state); },
  };
})();
