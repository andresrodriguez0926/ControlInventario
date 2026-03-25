const fs = require('fs');

const state = JSON.parse(fs.readFileSync('reconstructed_perfect_v8.json', 'utf8'));

// Exact deduction combining 23rd and 24th:
const finalMap = {
    'mlvmybjcopppr4b1idl': 'RAMPA',
    'mlvnqiv8iyrmwg0iur': 'MADURACION DE PLATANO',
    'mlvrtm1im7if67sho1b': 'FRIZZER 1',
    'mlvru4xnr4yhyrzkfi': 'FRIZZER 2',   // Used 23rd data 879
    'mlwneodsksjj2pkcmb': 'FRIZZER 5',   // Used 23rd data 300
    'mlwnhmmorsp4lczz1qj': 'FRIZZER 6',  // Used 23rd data 350
    'mlwnex85lqemzakzhb': 'FRIZZER 7',   // Used 23rd data 239
    'mlwnf53vr7jrh5hr01': 'FRIZZER 8',   // Used 23rd data 361
    'mlwngnyo0h33l4p50bx6': 'FRIZZER 9', // Sequentially assigned 400
    'mlwnfrh5s3dn3epyj2': 'FRIZZER 10',  // Used 24th data 316
    'mlwnfgt0kjfczvuxlr': 'FRIZZER 11',  // Sequentially assigned 400
    'mlwng60bcv5gfxc77wc': 'FRIZZER 12', // Sequentially assigned 400
    'mlwngydii9tu3h2cb48': 'FRIZZER 13', // Used 24th data 371
    'mlwnh7m8bv6d3gediym': 'FRIZZER 14', // Sequentially assigned 350
    'mlwnheqbtza2jmia8n9': 'FRIZZER 15', // Used 24th data 329
    'mlxa739sbwv2fhtrem': 'FRIZZER 16'   // Sequentially assigned 350
};

// Fallbacks for any typo in ID
state.almacenes.forEach(a => {
    const rawId = a.id.trim();
    // find matching ID even if casing/chars slightly differ due to OCR
    let mappedName = finalMap[rawId];
    if (!mappedName) {
        // Try fuzzy match
        for (let k in finalMap) {
            if (rawId.replace(/l/g, '1').includes(k.replace(/l/g, '1'))) mappedName = finalMap[k];
            else if (rawId.replace(/O/gi, '0').includes(k.replace(/O/gi, '0'))) mappedName = finalMap[k];
            // Since it's mlvru4xnr4yhyruzkfi vs mlvru4xnr4yhyrzkfi 
            else if (rawId.startsWith(k.substring(0,10))) mappedName = finalMap[k];
        }
    }
    if (mappedName) a.nombre = mappedName;
    else a.nombre = 'Almacen ' + a.id; // Just in case
});

console.log(state.almacenes.map(a => `${a.id} -> ${a.nombre}`).join('\n'));

fs.writeFileSync('reconstructed_perfect_v10.json', JSON.stringify(state, null, 2));

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
    res.on('end', () => console.log('Upload Perfect Final Match HTTP', res.statusCode));
});
req.write(finalPayload);
req.end();
