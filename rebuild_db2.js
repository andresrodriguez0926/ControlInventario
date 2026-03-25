const fs = require('fs');

function parseRestValue(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.mapValue && val.mapValue.fields) {
        const res = {};
        for(let k in val.mapValue.fields) {
            res[k] = parseRestValue(val.mapValue.fields[k]);
        }
        return res;
    }
    if (val.arrayValue && val.arrayValue.values) {
        return val.arrayValue.values.map(v => parseRestValue(v));
    }
    if (val.nullValue !== undefined) return null;
    return val;
}

const raw = JSON.parse(fs.readFileSync('actividad.json', 'utf8'));
const logs = raw.map(d => parseRestValue({ mapValue: { fields: d.fields } }))
                .sort((a,b) => new Date(a.date) - new Date(b.date));

const prodMap = new Map();
const almMap = new Map();
const ptosMap = new Map();
const cliMap = new Map();

logs.forEach(log => {
    const p = log.rawPayload;
    if (!p) return;

    if (log.operacion === 'Recepción de Fruta') {
        const prodMatch = log.detalle.match(/De:\s*([^,]+)/);
        if (prodMatch && p.productorId) prodMap.set(p.productorId, prodMatch[1].trim());

        const ptoMatch = log.detalle.match(/Prod:\s*([^,]+)/);
        if (ptoMatch && ptoMatch[1] !== 'Varios (+'+(p.lotes?p.lotes.length:'')+')' && !ptoMatch[1].includes('Varios')) {
            const pId = p.productoId || (p.lotes && p.lotes[0] ? p.lotes[0].productoId : null);
            if (pId) ptosMap.set(pId, ptoMatch[1].trim());
        }
        
        if (p.lotes) p.lotes.forEach(l => {
            if (!almMap.has(l.almacenId)) almMap.set(l.almacenId, 'Almacen ' + l.almacenId);
            if (!ptosMap.has(l.productoId)) ptosMap.set(l.productoId, 'Producto ' + l.productoId);
        });
    }
    if (log.operacion === 'Transferencia entre Almacenes') {
        const tMatch = log.detalle.match(/\(De (.*?) a (.*?)\)/);
        if (tMatch) {
            if (p.almacenOrigenId) almMap.set(p.almacenOrigenId, tMatch[1].trim());
            if (p.almacenDestinoId) almMap.set(p.almacenDestinoId, tMatch[2].trim());
        }
    }
    if (log.operacion.includes('Decomiso')) {
        const ptoMatch = log.detalle.match(/Producto:\s*([^|]+)/);
        if (ptoMatch && p.productoId) ptosMap.set(p.productoId, ptoMatch[1].trim());
    }
    if (log.operacion.includes('Fruta Demás') || log.operacion.includes('Ingreso Fruta Demás')) {
        const ptoMatch = log.detalle.match(/Llenadas con:\s*(.+)/);
        if (ptoMatch && p.productoId) ptosMap.set(p.productoId, ptoMatch[1].trim());
    }
    if (log.operacion === 'Despacho a Cliente' || log.operacion.includes('Desp. Cliente')) {
        const cliMatch = log.detalle.match(/A cliente:\s*([^|]+)/);
        if (cliMatch && p.clienteId) cliMap.set(p.clienteId, cliMatch[1].trim());
    }
});

// Final check from "Catálogos" logs if we still have plain "Producto <id>"
// We might not know which is which, but at least we have the names they created
const catProductos = [];
const catAlmacenes = [];
logs.forEach(log => {
    if (log.operacion === 'Catálogos') {
        let m = log.detalle.match(/Nuevo Producto:\s*(.+)/);
        if (m) catProductos.push(m[1].trim());
        m = log.detalle.match(/Nuevo Almacén:\s*(.+)/);
        if (m) catAlmacenes.push(m[1].trim());
    }
});


const state = {
    productores: Array.from(prodMap.entries()).map(([id, nombre]) => ({ id, nombre, createdAt: new Date().toISOString() })),
    productos: Array.from(ptosMap.entries()).map(([id, nombre]) => ({ id, nombre, createdAt: new Date().toISOString() })),
    almacenes: Array.from(almMap.entries()).map(([id, nombre]) => ({ id, nombre, createdAt: new Date().toISOString() })),
    clientes: Array.from(cliMap.entries()).map(([id, nombre]) => ({ id, nombre, createdAt: new Date().toISOString() })),
    configVersion: 50,
    secuenciaDocumento: 2000,
    nextProductorId: prodMap.size + 10,
    nextClienteId: cliMap.size + 10,
    inventario: {
        canastasLlenas: 0,
        canastasVacias: 0,
        porAlmacen: {}
    },
    usuarios: [
        {
            "id": "admin_default",
            "usuario": "admin",
            "clave": "admin123",
            "rol": "admin",
            "modulosBloqueados": [],
            "createdAt": new Date().toISOString()
        }
    ]
};

console.log("Productos resueltos:", state.productos.map(p => p.nombre).join(', '));
console.log("Almacenes resueltos:", state.almacenes.map(p => p.nombre).join(', '));
if (state.productos.some(p => p.nombre.startsWith('Producto '))) {
   console.log("Sugerencias Productos desde catálogos:", catProductos.join(', '));
}
if (state.almacenes.some(p => p.nombre.startsWith('Almacen '))) {
   console.log("Sugerencias Almacenes desde catálogos:", catAlmacenes.join(', '));
}

// Recalculate inventario to match the real situation based on the audit
// Since we don't duplicate `store.js` logic completely in node, 
// we'll just write the state as is, and the app's Dashboard will automatically show correct or broken values until they run "Auditar".
// Actually, `store.js` recalculates nicely if we just set zeros: 
for (let a of state.almacenes) {
    state.inventario.porAlmacen[a.id] = { vacias: 0 };
}

fs.writeFileSync('reconstructed_catalogs_v2.json', JSON.stringify(state, null, 2));
