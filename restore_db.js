const fs = require('fs');
const https = require('https');

async function restore() {
    console.log("Reading output_rest_utf8.json...");
    try {
        let dataStr = fs.readFileSync('output_rest_utf8.json', 'utf8');
        // Strip BOM if present
        if (dataStr.charCodeAt(0) === 0xFEFF) {
            dataStr = dataStr.slice(1);
        }
        
        const backupData = JSON.parse(dataStr);

        const payload = JSON.stringify({
            fields: backupData.fields
        });

        console.log("Restoring mainState to Firebase via REST...");

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
                    console.log(resData.substring(0, 100) + "...");
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
        console.error("Error during restore: ", e.message);
    }
}

restore();
