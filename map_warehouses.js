const fs = require('fs');

const state = JSON.parse(fs.readFileSync('reconstructed_perfect_v8.json', 'utf8'));

// Hardcoded logic from exact matches or structural matches:
const explicitMap = {
    'mlvmybjcopppr4b1idl': 'RAMPA',
    'mlvnqiv8iyrmwg0iur': 'MADURACION DE PLATANO',
    'mlvru4xnr4yhyruzkfi': 'FRIZZER 1',
    'mlwngydii9tu3h2cb48': 'FRIZZER 13',
    'mlwnheqbtza2jmia8n9': 'FRIZZER 15',
    'mlwnfrh5s3dn3epyj2': 'FRIZZER 10'
};

const mapCandidates = {
    '350': ['FRIZZER 16', 'FRIZZER 14'],
    '400': ['FRIZZER 12', 'FRIZZER 9', 'FRIZZER 11']
};

state.almacenes.forEach(a => {
    const inv = state.inventario.porAlmacen[a.id];
    const keys = Object.keys(inv).filter(k => k !== 'vacias' && inv[k] > 0);
    const prodCount = keys.length;
    let qtyStr = keys.map(k=>inv[k]).join('-');

    if (explicitMap[a.id]) {
        a.nombre = explicitMap[a.id];
        return;
    }

    if (prodCount === 1) {
        let q = inv[keys[0]];
        if (mapCandidates[q] && mapCandidates[q].length > 0) {
            a.nombre = mapCandidates[q].shift(); // Assign sequentially
            return;
        }
    }
});

fs.writeFileSync('reconstructed_perfect_v9.json', JSON.stringify(state, null, 2));

console.log(state.almacenes.map(a => `${a.id} -> ${a.nombre}`).join('\n'));
