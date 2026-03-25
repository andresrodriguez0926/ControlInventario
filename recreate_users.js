const admin = require('firebase-admin');

// Ensure we don't initialize twice
if (!admin.apps.length) {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function main() {
    console.log("Conectando a Firestore...");
    
    // 1. Obtener todas las actividades
    const snapshot = await db.collection('actividad').get();
    const actividades = [];
    snapshot.forEach(doc => {
        actividades.push(doc.data());
    });
    
    console.log(`Leídas ${actividades.length} actividades.`);
    
    // 2. Extraer usuarios únicos
    const userSet = new Set();
    actividades.forEach(a => {
        if (a.usuario) {
            userSet.add(a.usuario.trim().toLowerCase());
        }
    });
    
    console.log(`Usuarios únicos detectados:`, Array.from(userSet));
    
    // 3. Obtener usuarios actuales de mainState
    const stateDocRef = db.collection('appData').doc('mainState');
    const doc = await stateDocRef.get();
    
    if (!doc.exists) {
        console.error("No se encontró mainState!");
        return;
    }
    
    const state = doc.data();
    const usuariosActuales = state.usuarios || [];
    
    // 4. Determinar cuáles faltan
    const namesExistentes = new Set(usuariosActuales.map(u => (u.usuario || '').trim().toLowerCase()));
    
    let added = 0;
    
    userSet.forEach(userName => {
        if (!namesExistentes.has(userName)) {
            // Añadir usuario
            const modulos = [
                "decomiso",
                "clientes",
                "productores",
                "almacenes",
                "productos",
                "canastas-demas",
                "dashboard-semanal"
            ];
            
            console.log(`Creando usuario faltante: ${userName}`);
            usuariosActuales.push({
                id: 'usr_' + Date.now() + Math.floor(Math.random() * 1000),
                usuario: userName,
                password: "123456",
                rol: "empleado", // Asumimos rol restringido
                modulosBloqueados: modulos // Bloquear todos los módulos sensibles por defecto (catálogos, etc)
            });
            added++;
        }
    });
    
    if (added > 0) {
        console.log(`Se agregarán ${added} usuarios.`);
        await stateDocRef.update({ usuarios: usuariosActuales });
        console.log("Usuarios actualizados correctamente en mainState.");
    } else {
        console.log("Todos los usuarios de la actividad ya existen en mainState.");
    }
}

main().catch(console.error);
