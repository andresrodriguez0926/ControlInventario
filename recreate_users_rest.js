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

function fetchMainState() {
    return new Promise((resolve, reject) => {
        https.get('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState', (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Status Code: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

function parseFirestoreObj(value) {
    if (!value) return null;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
    if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.nullValue !== undefined) return null;
    if (value.arrayValue !== undefined) return (value.arrayValue.values || []).map(parseFirestoreObj);
    if (value.mapValue !== undefined) {
        const obj = {};
        const fields = value.mapValue.fields || {};
        for (const k in fields) {
            obj[k] = parseFirestoreObj(fields[k]);
        }
        return obj;
    }
    return null;
}

function patchMainState(stateObj) {
    return new Promise((resolve, reject) => {
        const firestoreData = { fields: {} };
        for (let k in stateObj) firestoreData.fields[k] = toFirestore(stateObj[k]);
        
        const payload = JSON.stringify(firestoreData);
        const urlObj = new URL('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState');
        const options = {
            hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };

        const req = https.request(options, (res) => {
            let resData = ''; res.on('data', d => { resData += d; });
            res.on('end', () => {
                if (res.statusCode === 200) resolve();
                else reject(new Error('PATCH Failed ' + res.statusCode + ': ' + resData));
            });
        });
        req.write(payload);
        req.end();
    });
}

async function run() {
    try {
        const userSet = new Set();
        
        console.log("Loading activity from actividad.json...");
        const actCachePath = 'actividad.json';
        if (fs.existsSync(actCachePath)) {
            const actCache = JSON.parse(fs.readFileSync(actCachePath, 'utf8'));
            const docs = actCache.documents || (Array.isArray(actCache) ? actCache : []);
            
            for (const doc of docs) {
                const fields = doc.fields || doc;
                let uname = null;
                if (fields.usuario && fields.usuario.stringValue) {
                    uname = fields.usuario.stringValue;
                } else if (fields.usuario && typeof fields.usuario === 'string') {
                    uname = fields.usuario;
                }
                
                if (uname) {
                    uname = uname.trim().toLowerCase();
                    if (uname.length > 2) userSet.add(uname);
                }
            }
        } else {
            console.log("actividad.json not found!");
        }

        console.log(`Identificados ${userSet.size} usuarios únicos:`, Array.from(userSet));
        
        console.log("Fetching live mainState...");
        const rawState = await fetchMainState();
        const mainState = parseFirestoreObj({ mapValue: rawState });
        
        let usuariosActuales = mainState.usuarios || [];
        const existingNames = new Set(usuariosActuales.map(u => (u.usuario || '').trim().toLowerCase()));
        
        let added = 0;
        const modulos = [
            "decomiso",
            "clientes",
            "productores",
            "almacenes",
            "productos",
            "canastas-demas",
            "dashboard-semanal"
        ];
        
        // Remove admin user from the "add" list to avoid corrupting it
        existingNames.add('admin');
        
        for (const u of userSet) {
            if (!existingNames.has(u) && u !== 'admin' && u.length > 2) {
                console.log(`+ Agregando usuario perdido: ${u}`);
                usuariosActuales.push({
                    id: 'usr_' + Date.now() + Math.floor(Math.random() * 1000),
                    usuario: u,
                    password: "123456",
                    rol: "empleado",
                    modulosBloqueados: modulos
                });
                added++;
            }
        }
        
        if (added > 0) {
            mainState.usuarios = usuariosActuales;
            console.log(`Upload actualizando mainState con ${usuariosActuales.length} usuarios totales...`);
            await patchMainState(mainState);
            console.log("ÉXITO!");
        } else {
            console.log("No hay usuarios faltantes.");
        }
        
    } catch(e) {
        console.error(e);
    }
}

run();
