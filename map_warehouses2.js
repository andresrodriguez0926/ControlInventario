const fs = require('fs');

const state = JSON.parse(fs.readFileSync('reconstructed_perfect_v8.json', 'utf8'));

// Hardcoded logic from exact matches or structural matches:
const explicitMap = {
    'mlvmybjcopppr4b1idl': 'RAMPA',
    'mlvnqiv8iyrmwg0iur': 'MADURACION DE PLATANO',
    'mlvru4xnr4yhyruzkfi': 'FRIZZER 1',
    'mlwngydii9tu3h2cb48': 'FRIZZER 13',
    'mlwnheqbtza2jmia8n9': 'FRIZZER 15',
    'mlwnfrh5s3dn3epyj2': 'FRIZZER 10',
    'mlwnhmmorsp4lczz1qj': 'FRIZZER 16',
    'mlwnh7m8bv6d3gediym': 'FRIZZER 14',
    'mlwngnyo0h3314p50bx6': 'FRIZZER 12',
    'mlwnfgt0kjfczvuxlr': 'FRIZZER 9',
    'mlwng60bcv5gfxc77wc': 'FRIZZER 11',
    'mlwneodsksjj2pkcmb': 'FRIZZER 8',
    'mlwnf53vr7jrh5hr01': 'FRIZZER 7',
    'mlvrtm1im7if67sho1b': 'FRIZZER 5'
};

const remainingNames = ['Almacen Auxiliar 1', 'Almacen Auxiliar 2'];

state.almacenes.forEach(a => {
    if (explicitMap[a.id]) {
        a.nombre = explicitMap[a.id];
    } else {
        a.nombre = remainingNames.shift() || ('Almacen ' + a.id);
    }
});

console.log(state.almacenes.map(a => `${a.id} -> ${a.nombre}`).join('\n'));

fs.writeFileSync('reconstructed_perfect_v9.json', JSON.stringify(state, null, 2));

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
const finalPayload = JSON.stringify(firestoreData);

const urlObj = new URL('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState');
const options = {
    hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(finalPayload) }
};
const req = https.request(options, (res) => {
    res.on('data', () => {});
    res.on('end', () => console.log('Upload Names Match HTTP', res.statusCode));
});
req.write(finalPayload);
req.end();
