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
    console.log("Reading reconstructed_catalogs_v2.json...");
    try {
        const dataStr = fs.readFileSync('reconstructed_catalogs_v2.json', 'utf8');
        const state = JSON.parse(dataStr);

        const firestoreData = { fields: {} };
        for (let k in state) {
            firestoreData.fields[k] = toFirestore(state[k]);
        }

        const payload = JSON.stringify(firestoreData);

        console.log("Uploading mainState to Firebase via REST...");

        const urlObj = new URL('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState');

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let resData = '';
            res.on('data', d => { resData += d; });
            res.on('end', () => {
                if(res.statusCode >= 200 && res.statusCode < 300) {
                    console.log("Restore Success! HTTP " + res.statusCode);
                } else {
                    console.error("Restore Failed! HTTP " + res.statusCode);
                    console.error(resData);
                }
            });
        });

        req.on('error', (e) => {
            console.error("HTTP Request Error: ", e);
        });

        req.write(payload);
        req.end();

    } catch (e) {
        console.error("Error during upload: ", e.message);
    }
}

upload();
