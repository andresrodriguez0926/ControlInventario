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

const state = JSON.parse(fs.readFileSync('reconstructed_catalogs_v4.json', 'utf8'));
const logs = JSON.parse(fs.readFileSync('actividad.json', 'utf8'))
    .map(d => parseRestValue({mapValue:{fields:d.fields}}))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));

state.inventario = { canastasLlenas: 0, canastasVacias: 0, despachadasProductor: 0, despachadasCliente: 0, porAlmacen: {} };
state.almacenes.forEach(a => state.inventario.porAlmacen[a.id] = { vacias: 0 });
state.productores.forEach(p => p.canastasPrestadas = 0);
state.clientes.forEach(c => c.canastasPrestadas = 0);

function getInv(almId) {
    if (!almId) almId = 'no-especificado';
    if (!state.inventario.porAlmacen[almId]) {
        state.almacenes.push({ id: almId, nombre: 'Almacen ' + almId });
        state.inventario.porAlmacen[almId] = { vacias: 0 };
    }
    return state.inventario.porAlmacen[almId];
}

const targetDate = new Date("2026-03-24T03:59:59Z"); // End of Day timezone roughly to match end of 3/23 in Local

logs.forEach(a => {
    if (a.anulado) return; 
    if (new Date(a.date) > targetDate) return;

    let payload = a.rawPayload || {};
    const qtyStr = (a.cantidad || '0').toString();
    const match = qtyStr.match(/-?\d+/);
    const a_cantidad = match ? Math.abs(parseInt(match[0], 10)) : 0;
    const op = a.operacion;

    if (op === 'Recepción' || op === 'Recepción de Fruta') {
        if (payload.lotes) {
            payload.lotes.forEach(l => {
                const i = getInv(l.almacenId || l.almacenDestinoId || payload.almacenId);
                i[l.productoId] = (i[l.productoId] || 0) + (parseInt(l.cantidad) || 0);
            });
        }
    }
    else if (op === 'Transf. Interna' || op === 'Transferencia entre Almacenes') {
        const cantL = parseInt(payload.cantidad) || 0;
        if (cantL > 0) {
            getInv(payload.almacenOrigenId)[payload.productoIdActual] -= cantL;
            getInv(payload.almacenDestinoId)[payload.productoIdNuevo || payload.productoIdActual] = (getInv(payload.almacenDestinoId)[payload.productoIdNuevo || payload.productoIdActual] || 0) + cantL;
        }
    }
    else if (op === 'Desp. Cliente' || op === 'Despacho a Cliente') {
        if (payload.detalles) {
            payload.detalles.forEach(d => {
                getInv(d.almacenOrigenId || d.almacenId)[d.productoId] -= (parseInt(d.cantidad)||0);
            });
        }
    }
    else if (op === 'Devolución' || op === 'Devolución de Canastas') {
        const isLlena = a.detalle && a.detalle.toLowerCase().includes('llena');
        if (isLlena) {
            getInv(payload.almacenDestinoId)[payload.productoId] = (getInv(payload.almacenDestinoId)[payload.productoId] || 0) + a_cantidad;
        }
    }
    else if (op === 'Decomiso' || op === 'Decomiso de Fruta') {
        getInv(payload.almacenOrigenId)[payload.productoId] -= a_cantidad;
    }
    else if (op === 'Fruta Demás' || op === 'Canastas Demás' || op === 'Ingreso Fruta Demás') {
        getInv(payload.almacenDestinoId)[payload.productoId] = (getInv(payload.almacenDestinoId)[payload.productoId] || 0) + a_cantidad;
    }
    else if (op === 'Reparación Sistema') {
        if (payload.balanceNuevo && payload.productoId) {
            Object.entries(payload.balanceNuevo).forEach(([almId, cantNueva]) => {
                getInv(almId)[payload.productoId] = cantNueva;
            });
        }
    }
});

const prods = {};
state.productos.forEach(p => prods[p.id] = p.nombre);

console.log("=== BALANCES ON MAR 23 ===");
state.almacenes.forEach(a => {
    const inv = state.inventario.porAlmacen[a.id];
    const keys = Object.keys(inv).filter(k => k !== 'vacias' && inv[k] > 0);
    if (keys.length > 0) {
        console.log(`${a.id} -> ${keys.map(k => prods[k] + ': ' + inv[k]).join(', ')}`);
    }
});
