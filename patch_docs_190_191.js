const admin = require('firebase-admin');

// 1. Configurar e Inicializar Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function patchDocs() {
    console.log("Iniciando parcheo de documentos...");
    const docsRef = db.collection('actividad');
    const q1 = await docsRef.where('numeroDocumento', '==', 'DOC-0190').get();
    const q2 = await docsRef.where('numeroDocumento', '==', 'DOC-0191').get();

    for (let doc of q1.docs) {
        let data = doc.data();
        let payload = data.rawPayload || {};
        await doc.ref.update({
            fechaOperacion: "2026-04-02",
            "rawPayload.fechaRecepcion": "2026-04-02",
            "rawPayload.fecha": "2026-04-02" // Just in case
        });
        console.log(`Documento DOC-0190 parcheado exitosamente. (ID: ${doc.id})`);
    }

    for (let doc of q2.docs) {
        let data = doc.data();
        let payload = data.rawPayload || {};
        await doc.ref.update({
            fechaOperacion: "2026-04-02",
            "rawPayload.fechaRecepcion": "2026-04-02",
            "rawPayload.fecha": "2026-04-02" // Just in case
        });
        console.log(`Documento DOC-0191 parcheado exitosamente. (ID: ${doc.id})`);
    }
    
    console.log("Finalizado!");
}

patchDocs().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
