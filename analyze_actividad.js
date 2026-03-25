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
const logs = raw.map(d => {
    return parseRestValue({ mapValue: { fields: d.fields } });
}).sort((a,b) => new Date(a.date) - new Date(b.date));

const productores = new Map();
const productos = new Map();
const almacenes = new Map();
const clientes = new Map();

logs.forEach(log => {
    const p = log.rawPayload;
    if (log.operacion === 'Recepción de Fruta' && p) {
        // "De: Nombre Productor, Recibe: ..."
        const prodMatch = log.detalle ? log.detalle.match(/De:\s*([^,]+)/) : null;
        if (p.productorId && prodMatch) {
            productores.set(p.productorId, { id: p.productorId, nombre: prodMatch[1].trim() });
        }
        if (p.lotes) {
            p.lotes.forEach(l => {
                almacenes.set(l.almacenId, { id: l.almacenId, nombre: `Almacen ${l.almacenId}` });
                productos.set(l.productoId, { id: l.productoId, nombre: `Producto ${l.productoId}` });
            });
        }
    }
    if (log.operacion === 'Despacho a Cliente' && p) {
        const cliMatch = log.detalle ? log.detalle.match(/A cliente:\s*([^\|]+)/) : null;
        if (p.clienteId && cliMatch) {
            clientes.set(p.clienteId, { id: p.clienteId, nombre: cliMatch[1].trim() });
        }
        if (p.detalles) {
            p.detalles.forEach(d => {
                if (d.productoId) productos.set(d.productoId, { id: d.productoId, nombre: `Producto ${d.productoId}` });
            });
        }
    }
    if (log.operacion === 'Catálogos') {
        // e.g. "Nuevo Producto: Manzana"
        const mProd = log.detalle.match(/(?:Nuevo|Actualización) Producto:\s*(.+)/);
        if (mProd) {
            // We only have the name here, we'll try to link it later if needed or just keep a list of known names
        }
    }
});

console.log(`Encontrados ${productores.size} productores, ${productos.size} productos, ${almacenes.size} almacenes, ${clientes.size} clientes`);

const state = {
    productores: Array.from(productores.values()),
    productos: Array.from(productos.values()),
    almacenes: Array.from(almacenes.values()),
    clientes: Array.from(clientes.values()),
};

fs.writeFileSync('reconstructed_catalogs.json', JSON.stringify(state, null, 2));
