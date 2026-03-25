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

const logs = JSON.parse(fs.readFileSync('actividad.json', 'utf8'))
    .map(d => parseRestValue({mapValue:{fields:d.fields}}))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));

let currentLlenas = 0;
let currentVacias = 0;
let deudaProductor = {};
let deudaCliente = {};

const applyObjDelta = (obj, key, delta) => {
    if (!key) key = 'no-especificado';
    obj[key] = (obj[key] || 0) + delta;
};

logs.forEach(a => {
    if (a.anulado) return;
    
    const payload = a.rawPayload || {};
    const qtyStr = (a.cantidad || '0').toString();
    const match = qtyStr.match(/-?\d+/);
    const a_cantidad = match ? Math.abs(parseInt(match[0], 10)) : 0;
    const op = a.operacion;

    if (op === 'Recepción' || op === 'Recepción de Fruta') {
        currentLlenas += a_cantidad;
        applyObjDelta(deudaProductor, payload.productorId, -a_cantidad);
    } 
    else if (op === 'Desp. Cliente' || op === 'Despacho a Cliente') {
        currentLlenas -= a_cantidad;
        applyObjDelta(deudaCliente, payload.clienteId || payload.clienteNombre, a_cantidad);
    } 
    else if (op === 'Desp. Vacías' || op === 'Despacho de Vacías') {
        currentVacias -= a_cantidad;
        applyObjDelta(deudaProductor, payload.productorId, a_cantidad);
    } 
    else if (op === 'Devolución' || op === 'Devolución de Canastas') {
        const isLlena = a.detalle && a.detalle.toLowerCase().includes('llena');
        const isProd = (payload.tipoOrigen === 'productor');
        if (isLlena) {
            currentLlenas += a_cantidad;
        } else {
            currentVacias += a_cantidad;
        }
        if (isProd) applyObjDelta(deudaProductor, payload.productorId, -a_cantidad);
        else applyObjDelta(deudaCliente, payload.clienteId || payload.clienteNombre, -a_cantidad);
    } 
    else if (op === 'Transf. Fincas' || op === 'Transferencia entre Fincas') {
        applyObjDelta(deudaProductor, payload.productorOrigenId, -a_cantidad);
        applyObjDelta(deudaProductor, payload.productorDestinoId, a_cantidad);
    } 
    else if (op === 'Compra' || op === 'Compra Canastas' || op === 'Compra de Canastas') {
        currentVacias += a_cantidad;
    } 
    else if (op === 'Decomiso' || op === 'Decomiso de Fruta') {
        currentLlenas -= a_cantidad;
        currentVacias += a_cantidad;
    } 
    else if (op === 'Fruta Demás' || op === 'Canastas Demás' || op === 'Ingreso Fruta Demás') {
        currentLlenas += a_cantidad;
        currentVacias -= a_cantidad;
    } 
    else if (op === 'Salida Canastas' || op === 'Baja de Canastas') {
        currentVacias -= a_cantidad;
    } 
    else if (op === 'Reparación Sistema') {
        const isNeg = qtyStr.includes('-');
        const diff = isNeg ? -Math.abs(a_cantidad) : Math.abs(a_cantidad);
        currentLlenas += diff;
    } 
});

const currentDespProd = Object.values(deudaProductor).reduce((s, v) => s + v, 0);
const currentDespCli = Object.values(deudaCliente).reduce((s, v) => s + v, 0);

console.log("=== INVENTARIO FECHA REPORT SIMULATION ===");
console.log(`Llenas: ${currentLlenas}`);
console.log(`Vacias: ${currentVacias}`);
console.log(`Deuda Prod Tot: ${currentDespProd}`);
console.log(`Deuda Cli Tot: ${currentDespCli}`);
console.log("Deuda Cliente Breakdown:", deudaCliente);
