const fs = require('fs');
const https = require('https');

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

async function upload() {
    try {
        const state = JSON.parse(fs.readFileSync('reconstructed_catalogs_v4.json', 'utf8'));
        
        // Restore actual global totals from output_rest_utf8.json
        state.inventario.canastasLlenas = 9656;
        state.inventario.canastasVacias = 18;
        state.inventario.despachadasProductor = 4358;
        state.inventario.despachadasCliente = 0;
        
        const firestoreData = { fields: {} };
        for (let k in state) firestoreData.fields[k] = toFirestore(state[k]);
        
        const payload = JSON.stringify(firestoreData);
        const urlObj = new URL('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState');
        const options = {
            hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };

        const req = https.request(options, (res) => {
            let resData = ''; res.on('data', d => { resData += d; });
            res.on('end', () => console.log('Upload Final HTTP', res.statusCode));
        });
        req.write(payload);
        req.end();
    } catch (e) {
        console.error("Error:", e);
    }
}
upload();
