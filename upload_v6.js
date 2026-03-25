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
        // Load the v4 reconstruction which has the correctly named almacenes and right porAlmacen balances
        const state = JSON.parse(fs.readFileSync('reconstructed_catalogs_v4.json', 'utf8'));
        
        // Exact numbers from the user's screenshot
        state.inventario.canastasLlenas = 7156;
        state.inventario.canastasVacias = 125;
        state.inventario.despachadasProductor = 1864;
        state.inventario.despachadasCliente = 4887;
        
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
            res.on('end', () => console.log('Upload Exact Snapshot HTTP', res.statusCode));
        });
        req.write(payload);
        req.end();
    } catch (e) {
        console.error("Error:", e);
    }
}
upload();
