const fs = require('fs');

async function main() {
    const state = JSON.parse(fs.readFileSync('reconstructed_catalogs_v4.json', 'utf8'));
    
    // We already pulled the dashboard html to check balances in the previous images.
    // I will read the live database file (actividad.json) and recreate the inventory again.
    const logs = JSON.parse(fs.readFileSync('actividad.json', 'utf8')).map(d => d.fields);
    
    let inv = {};
    state.almacenes.forEach(a => inv[a.id] = 0);
    
    logs.forEach(act => {
        let rp = act.rawPayload && act.rawPayload.mapValue && act.rawPayload.mapValue.fields ? act.rawPayload.mapValue.fields : null;
        if (!rp) return;
        
        const parse = (v) => v ? v.stringValue || v.integerValue : null;
        const op = parse(act.operacion);
        if (!op) return;
        
        let qty = parseInt(parse(act.cantidad)) || 0;
        let qtyStr = (parse(act.cantidad)||'').toString();
        const a_cantidad = qtyStr.match(/-?\d+/) ? Math.abs(parseInt(qtyStr.match(/-?\d+/)[0])) : 0;
        
        if (op === 'Recepción' || op === 'Recepción de Fruta') {
            if (rp.lotes && rp.lotes.arrayValue && rp.lotes.arrayValue.values) {
                rp.lotes.arrayValue.values.forEach(l => {
                    let lf = l.mapValue.fields;
                    if (parse(lf.productoId) === 'mlvn6m3v4jljiukjpdd') { // GUINEO MADURO
                        inv[parse(lf.almacenId) || parse(lf.almacenDestinoId) || parse(rp.almacenId)] += parseInt(parse(lf.cantidad));
                    }
                });
            }
        }
        else if (op === 'Desp. Cliente' || op === 'Despacho a Cliente') {
            if (rp.detalles && rp.detalles.arrayValue && rp.detalles.arrayValue.values) {
                rp.detalles.arrayValue.values.forEach(l => {
                    let lf = l.mapValue.fields;
                    if (parse(lf.productoId) === 'mlvn6m3v4jljiukjpdd') { // GUINEO MADURO
                        inv[parse(lf.almacenId) || parse(lf.almacenOrigenId)] -= parseInt(parse(lf.cantidad));
                    }
                });
            }
        }
        else if (op.includes('Devolución') && parse(act.detalle) && parse(act.detalle).toLowerCase().includes('llena')) {
            if (parse(rp.productoId) === 'mlvn6m3v4jljiukjpdd') {
                inv[parse(rp.almacenDestinoId)] += a_cantidad;
            }
        }
        else if (op.includes('Transf. Interna') || op.includes('Transferencia entre Almacenes')) {
             if (parse(rp.productoIdActual) === 'mlvn6m3v4jljiukjpdd' || parse(rp.productoIdNuevo) === 'mlvn6m3v4jljiukjpdd') {
                 if (parse(rp.productoIdActual) === 'mlvn6m3v4jljiukjpdd') inv[parse(rp.almacenOrigenId)] -= a_cantidad;
                 if (parse(rp.productoIdNuevo) === 'mlvn6m3v4jljiukjpdd') inv[parse(rp.almacenDestinoId)] += a_cantidad;
             }
        }
        else if (op.includes('Decomiso')) {
            if (parse(rp.productoId) === 'mlvn6m3v4jljiukjpdd') inv[parse(rp.almacenOrigenId)] -= a_cantidad;
        }
        else if (op.includes('Fruta Demás')) {
            if (parse(rp.productoId) === 'mlvn6m3v4jljiukjpdd') inv[parse(rp.almacenDestinoId)] += a_cantidad;
        }
        else if (op === 'Reparación Sistema') {
             if (parse(rp.productoId) === 'mlvn6m3v4jljiukjpdd' && rp.balanceNuevo && rp.balanceNuevo.mapValue) {
                  Object.keys(rp.balanceNuevo.mapValue.fields).forEach(almId => {
                      inv[almId] = parseInt(parse(rp.balanceNuevo.mapValue.fields[almId]));
                  });
             }
        }
    });

    state.almacenes.forEach(a => {
        console.log(`${a.id} -> Balance: ${inv[a.id] || 0}`);
    });
}
main();
