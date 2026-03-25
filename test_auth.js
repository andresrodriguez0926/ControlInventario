const https = require('https');

https.get('https://firestore.googleapis.com/v1/projects/control-de-inventario-fbc21/databases/(default)/documents/appData/mainState', (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log("SUCCESS: Access is open.");
        } else {
            console.log(`ERROR ${res.statusCode}: ${data}`);
        }
    });
}).on('error', err => {
    console.log("Error: " + err.message);
});
