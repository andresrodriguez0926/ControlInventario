const fs = require('fs');

function parseRestValue(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.mapValue && val.mapValue.fields) {
        const res = {};
        for(let k in val.mapValue.fields) res[k] = parseRestValue(val.mapValue.fields[k]);
        return res;
    }
    if (val.arrayValue && val.arrayValue.values) return val.arrayValue.values.map(v => parseRestValue(v));
    if (val.nullValue !== undefined) return null;
    return val;
}

const rawLocal = JSON.parse(fs.readFileSync('reconstructed_catalogs_v2.json', 'utf8'));
const state = structuredClone(rawLocal);
const logs = JSON.parse(fs.readFileSync('actividad.json', 'utf8'))
    .map(d => parseRestValue({mapValue:{fields:d.fields}}))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));

// Initially zero out everything
state.inventario = { canastasLlenas: 0, canastasVacias: 0, despachadasProductor: 0, despachadasCliente: 0, porAlmacen: {} };
state.almacenes.forEach(a => state.inventario.porAlmacen[a.id] = { vacias: 0 });
state.productores.forEach(p => p.canastasPrestadas = 0);
state.clientes.forEach(c => c.canastasPrestadas = 0);

logs.forEach(act => {
    if (act.anulado) return; // Ignore annulled documents entirely
    let raw = act.rawPayload;
    if (!raw) return;

    function getInv(almId) {
        if (!state.inventario.porAlmacen[almId]) state.inventario.porAlmacen[almId] = { vacias: 0 };
        return state.inventario.porAlmacen[almId];
    }
    function getProd(id) { return state.productores.find(p => p.id === id); }
    function getCli(id, name) { return state.clientes.find(c => c.id === id || c.nombre === name); }

    const op = act.operacion;

    if (op === 'Recepción de Fruta') {
        let total = 0;
        let lotes = raw.lotes || [{ productoId: raw.productoId, cantidad: raw.cantidad, almacenId: raw.almacenDestinoId }];
        lotes.forEach(l => {
            const cant = parseInt(l.cantidad) || 0;
            total += cant;
            const inv = getInv(l.almacenId || raw.almacenDestinoId);
            inv[l.productoId] = (inv[l.productoId] || 0) + cant;
        });
        state.inventario.canastasLlenas += total;
        state.inventario.despachadasProductor = Math.max(0, state.inventario.despachadasProductor - total);
        const p = getProd(raw.productorId);
        if (p) p.canastasPrestadas = Math.max(0, (p.canastasPrestadas || 0) - total);
    }
    else if (op === 'Despacho de Vacías') {
        const cant = parseInt(raw.cantidad) || 0;
        getInv(raw.almacenOrigenId).vacias -= cant;
        state.inventario.canastasVacias -= cant;
        state.inventario.despachadasProductor += cant;
        const p = getProd(raw.productorId);
        if (p) p.canastasPrestadas = (p.canastasPrestadas || 0) + cant;
    }
    else if (op === 'Transferencia entre Fincas') {
        const cant = parseInt(raw.cantidad) || 0;
        const o = getProd(raw.productorOrigenId);
        const d = getProd(raw.productorDestinoId);
        if (o) o.canastasPrestadas -= cant;
        if (d) d.canastasPrestadas = (d.canastasPrestadas || 0) + cant;
    }
    else if (op === 'Despacho a Cliente' || op === 'Desp. Cliente') {
        let total = 0;
        if (raw.detalles) {
            raw.detalles.forEach(d => {
                const cant = parseInt(d.cantidad) || 0;
                total += cant;
                getInv(d.almacenOrigenId)[d.productoId] -= cant;
            });
        }
        state.inventario.canastasLlenas -= total;
        state.inventario.despachadasCliente += total;
        const c = getCli(raw.clienteId, raw.clienteNombre);
        if (c) c.canastasPrestadas = (c.canastasPrestadas || 0) + total;
    }
    else if (op === 'Devolución de Canastas') {
        const cant = parseInt(raw.cantidad) || 0;
        if (raw.esLlena) {
            getInv(raw.almacenDestinoId)[raw.productoId] = (getInv(raw.almacenDestinoId)[raw.productoId] || 0) + cant;
            state.inventario.canastasLlenas += cant;
        } else {
            getInv(raw.almacenDestinoId).vacias += cant;
            state.inventario.canastasVacias += cant;
        }
        if (raw.tipoOrigen === 'productor') {
            const p = getProd(raw.productorId);
            if (p) p.canastasPrestadas = Math.max(0, (p.canastasPrestadas || 0) - cant);
            state.inventario.despachadasProductor = Math.max(0, state.inventario.despachadasProductor - cant);
        } else {
            const c = getCli(raw.clienteId, raw.clienteNombre);
            if (c) c.canastasPrestadas = Math.max(0, (c.canastasPrestadas || 0) - cant);
            state.inventario.despachadasCliente = Math.max(0, state.inventario.despachadasCliente - cant);
        }
    }
    else if (op === 'Compra de Canastas') {
        const cant = parseInt(raw.cantidad) || 0;
        getInv(raw.almacenDestinoId).vacias += cant;
        state.inventario.canastasVacias += cant;
    }
    else if (op === 'Transferencia entre Almacenes') {
        const cant = parseInt(raw.cantidad) || 0;
        const vacias = parseInt(raw.canastasVacias) || 0;
        if (cant > 0) {
            getInv(raw.almacenOrigenId)[raw.productoIdActual] -= cant;
            getInv(raw.almacenDestinoId)[raw.productoIdNuevo] = (getInv(raw.almacenDestinoId)[raw.productoIdNuevo] || 0) + cant;
        }
        if (vacias > 0 && raw.almacenDestinoVaciasId) {
            getInv(raw.almacenOrigenId).vacias -= vacias;
            getInv(raw.almacenDestinoVaciasId).vacias += vacias;
        }
    }
    else if (op === 'Decomiso de Fruta' || op === 'Decomiso') {
        const cant = parseInt(raw.cantidad) || 0;
        getInv(raw.almacenOrigenId)[raw.productoId] -= cant;
        state.inventario.canastasLlenas -= cant;
        getInv(raw.almacenVaciasId || raw.almacenOrigenId).vacias += cant;
        state.inventario.canastasVacias += cant;
    }
    else if (op === 'Ingreso Fruta Demás' || op === 'Fruta Demás') {
        const cant = parseInt(raw.cantidad) || 0;
        getInv(raw.almacenOrigenId).vacias -= cant;
        state.inventario.canastasVacias -= cant;
        getInv(raw.almacenDestinoId)[raw.productoId] = (getInv(raw.almacenDestinoId)[raw.productoId] || 0) + cant;
        state.inventario.canastasLlenas += cant;
    }
    else if (op === 'Baja de Canastas') {
        const cant = parseInt(raw.cantidad) || 0;
        getInv(raw.almacenId).vacias -= cant;
        state.inventario.canastasVacias -= cant;
    }
});

console.log("Calculated Totals:", state.inventario);
fs.writeFileSync('reconstructed_catalogs_v3.json', JSON.stringify(state, null, 2));

const https = require('https');
const firestoreData = { fields: {} };
function toFirestore(obj) {
  if (obj === null || obj === undefined) return { nullValue: null };
  if (typeof obj === 'string') return { stringValue: obj };
  if (typeof obj === 'number') return Number.isInteger(obj) ? { integerValue: String(obj) } : { doubleValue: obj };
  if (typeof obj === 'boolean') return { booleanValue: obj };
  if (Array.isArray(obj)) return { arrayValue: { values: obj.map(toFirestore) } };
  if (typeof obj === 'object') {
    const fields = {};
    for (let k in obj) fields[k] = toFirestore(obj[k]);
    return { mapValue: { fields } };
  }
}
for (let k in state) firestoreData.fields[k] = toFirestore(state[k]);
const payload = JSON.stringify(firestoreData);

const urlObj = new URL('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState');
const options = {
    hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
};
const req = https.request(options, (res) => {
    let resData = ''; res.on('data', d => { resData += d; });
    res.on('end', () => console.log('Upload Result HTTP', res.statusCode));
});
req.write(payload);
req.end();
