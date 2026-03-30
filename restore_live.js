const fs = require('fs');
const https = require('https');

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

async function fetchLiveActivity() {
    return new Promise((resolve, reject) => {
        let allDocs = [];
        let pageToken = '';
        
        const fetchPage = () => {
            const url = `https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/actividad?pageSize=1000${pageToken ? '&pageToken='+pageToken : ''}`;
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) return reject(new Error('Failed to fetch activity: ' + res.statusCode));
                    const json = JSON.parse(data);
                    if (json.documents) {
                        allDocs = allDocs.concat(json.documents);
                    }
                    if (json.nextPageToken) {
                        pageToken = encodeURIComponent(json.nextPageToken);
                        fetchPage();
                    } else {
                        resolve(allDocs);
                    }
                });
            }).on('error', reject);
        };
        fetchPage();
    });
}

async function restoreDatabase() {
    console.log('[1/4] Descargando la actividad oficial LÍNEA...');
    const liveDocs = await fetchLiveActivity();
    console.log(`Descargados ${liveDocs.length} documentos de actividad`);
    
    // Convert REST to plain JS
    const logs = liveDocs.map(d => parseRestValue({mapValue:{fields:d.fields}})).sort((a,b)=>new Date(a.date)-new Date(b.date));
    
    console.log('[2/4] Preparando la restauración desde los catálogos base...');
    const state = JSON.parse(fs.readFileSync('reconstructed_catalogs_v4.json', 'utf8'));
    
    // Ensure admin user exists explicitly (the v4 map lacks new users but the user said "borro usuarios, almacenes, ...", so let's keep users that might be in reconstructed backup. No, users are in v4 json).
    
    state.inventario = { canastasLlenas: 0, canastasVacias: 0, despachadasProductor: 0, despachadasCliente: 0, porAlmacen: {} };
    if (!state.almacenes) state.almacenes = [];
    if (!state.productores) state.productores = [];
    if (!state.clientes) state.clientes = [];
    
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
    
    function getProd(id, nombreAprox) {
        if (!id || id === 'no-especificado') return null;
        let p = state.productores.find(p => p.id === id);
        if (!p) {
            p = { id, nombre: nombreAprox || 'Productor Auto-Recuperado', canastasPrestadas: 0 };
            state.productores.push(p);
        }
        return p;
    }
    
    function getCli(id, nombre) {
        if ((!id || id === 'no-especificado') && !nombre) return null;
        let c = state.clientes.find(c => (id && c.id === id) || (nombre && c.nombre === nombre));
        if (!c && nombre) {
            c = { id: id || (Date.now() + Math.random().toString()), nombre, canastasPrestadas: 0 };
            state.clientes.push(c);
        }
        return c;
    }

    console.log('[3/4] Reproduciendo y recalculando cada movimiento matemáticamente...');
    logs.forEach(a => {
        if (a.anulado) return; 
        let payload = a.rawPayload || {};
        
        const qtyStr = (a.cantidad || '0').toString();
        const match = qtyStr.match(/-?\d+/);
        const a_cantidad = match ? Math.abs(parseInt(match[0], 10)) : 0;
        const op = a.operacion;
        
        if (op === 'Recepción' || op === 'Recepción de Fruta') {
            state.inventario.canastasLlenas += a_cantidad;
            if (payload.lotes) {
                payload.lotes.forEach(l => {
                    const i = getInv(l.almacenId || l.almacenDestinoId || payload.almacenId);
                    i[l.productoId] = (i[l.productoId] || 0) + (parseInt(l.cantidad) || 0);
                });
            }
            state.inventario.despachadasProductor -= a_cantidad;
            const p = getProd(payload.productorId);
            if (p) p.canastasPrestadas = (p.canastasPrestadas || 0) - a_cantidad;
        }
        else if (op === 'Desp. Vacías' || op === 'Despacho de Vacías') {
            getInv(payload.almacenOrigenId).vacias -= a_cantidad;
            state.inventario.canastasVacias -= a_cantidad;
            state.inventario.despachadasProductor += a_cantidad;
            const p = getProd(payload.productorId);
            if (p) p.canastasPrestadas = (p.canastasPrestadas || 0) + a_cantidad;
        }
        else if (op === 'Transf. Fincas' || op === 'Transferencia entre Fincas') {
            const o = getProd(payload.productorOrigenId);
            const d = getProd(payload.productorDestinoId);
            if (o) o.canastasPrestadas -= a_cantidad;
            if (d) d.canastasPrestadas = (d.canastasPrestadas || 0) + a_cantidad;
        }
        else if (op === 'Desp. Cliente' || op === 'Despacho a Cliente') {
            state.inventario.canastasLlenas -= a_cantidad;
            state.inventario.despachadasCliente += a_cantidad;
            if (payload.detalles) {
                payload.detalles.forEach(d => {
                    getInv(d.almacenOrigenId || d.almacenId)[d.productoId] -= (parseInt(d.cantidad)||0);
                });
            }
            const c = getCli(payload.clienteId, payload.clienteNombre);
            if (c) c.canastasPrestadas = (c.canastasPrestadas || 0) + a_cantidad;
        }
        else if (op === 'Devolución' || op === 'Devolución de Canastas') {
            const isLlena = a.detalle && a.detalle.toLowerCase().includes('llena');
            const isProd = (payload.tipoOrigen === 'productor');
            if (isLlena) {
                getInv(payload.almacenDestinoId)[payload.productoId] = (getInv(payload.almacenDestinoId)[payload.productoId] || 0) + a_cantidad;
                state.inventario.canastasLlenas += a_cantidad;
            } else {
                getInv(payload.almacenDestinoId).vacias += a_cantidad;
                state.inventario.canastasVacias += a_cantidad;
            }
            if (isProd) {
                const p = getProd(payload.productorId);
                if (p) p.canastasPrestadas = (p.canastasPrestadas || 0) - a_cantidad;
                state.inventario.despachadasProductor -= a_cantidad;
            } else {
                const c = getCli(payload.clienteId, payload.clienteNombre);
                if (c) c.canastasPrestadas = (c.canastasPrestadas || 0) - a_cantidad;
                state.inventario.despachadasCliente -= a_cantidad;
            }
        }
        else if (op === 'Compra' || op === 'Compra Canastas' || op === 'Compra de Canastas') {
            getInv(payload.almacenDestinoId).vacias += a_cantidad;
            state.inventario.canastasVacias += a_cantidad;
        }
        else if (op === 'Transf. Interna' || op === 'Transferencia entre Almacenes') {
            const cantL = parseInt(payload.cantidad) || 0;
            const cantV = parseInt(payload.canastasVacias) || 0;
            if (cantL > 0) {
                getInv(payload.almacenOrigenId)[payload.productoIdActual] -= cantL;
                getInv(payload.almacenDestinoId)[payload.productoIdNuevo || payload.productoIdActual] = (getInv(payload.almacenDestinoId)[payload.productoIdNuevo || payload.productoIdActual] || 0) + cantL;
            }
            if (cantV > 0 && payload.almacenDestinoVaciasId) {
                getInv(payload.almacenOrigenId).vacias -= cantV;
                getInv(payload.almacenDestinoVaciasId).vacias += cantV;
            }
        }
        else if (op === 'Decomiso' || op === 'Decomiso de Fruta') {
            getInv(payload.almacenOrigenId)[payload.productoId] -= a_cantidad;
            state.inventario.canastasLlenas -= a_cantidad;
            getInv(payload.almacenVaciasId || payload.almacenOrigenId).vacias += a_cantidad;
            state.inventario.canastasVacias += a_cantidad;
        }
        else if (op === 'Fruta Demás' || op === 'Canastas Demás' || op === 'Ingreso Fruta Demás') {
            getInv(payload.almacenOrigenId).vacias -= a_cantidad;
            state.inventario.canastasVacias -= a_cantidad;
            getInv(payload.almacenDestinoId)[payload.productoId] = (getInv(payload.almacenDestinoId)[payload.productoId] || 0) + a_cantidad;
            state.inventario.canastasLlenas += a_cantidad;
        }
        else if (op === 'Salida Canastas' || op === 'Baja de Canastas') {
            getInv(payload.almacenId).vacias -= a_cantidad;
            state.inventario.canastasVacias -= a_cantidad;
        }
        else if (op === 'Reparación Sistema') {
            const isNeg = qtyStr.includes('-');
            const diff = isNeg ? -Math.abs(a_cantidad) : Math.abs(a_cantidad);
            state.inventario.canastasLlenas += diff;
            if (payload.balanceNuevo && payload.productoId) {
                Object.entries(payload.balanceNuevo).forEach(([almId, cantNueva]) => {
                    getInv(almId)[payload.productoId] = cantNueva;
                });
            }
        }
    });

    state.inventario.despachadasProductor = state.productores.reduce((acc,p)=>acc+(p.canastasPrestadas||0),0);
    state.inventario.despachadasCliente = state.clientes.reduce((acc,c)=>acc+(c.canastasPrestadas||0),0);
    state.configVersion = Date.now(); // increment the version manually just in case

    console.log("=== VÍCTORIA MATEMÁTICA DEFINITIVA ===");
    console.log("Globales:", state.inventario.canastasLlenas, state.inventario.canastasVacias, state.inventario.despachadasProductor, state.inventario.despachadasCliente);

    console.log('[4/4] Subiendo resultados finales por PATCH a la nube...');
    const firestoreData = { fields: {} };
    for (let k in state) firestoreData.fields[k] = toFirestore(state[k]);
    const finalPayload = JSON.stringify(firestoreData);

    const urlObj = new URL('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState');
    const options = {
        hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(finalPayload) }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log('¡Nube recuperada existosamente! HTTP: ' + res.statusCode);
                    resolve();
                } else {
                    reject(new Error('Upload Failed: HTTP ' + res.statusCode + ' ' + data));
                }
            });
        }).on('error', reject);
        req.write(finalPayload);
        req.end();
    });
}

restoreDatabase().catch(console.error);
