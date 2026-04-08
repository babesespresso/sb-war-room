const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf-8');
const keyIdMatch = env.match(/KALSHI_API_KEY=(.+)/);
const pkMatch = env.match(/KALSHI_PRIVATE_KEY="([^"]+)"/s);

const apiKeyId = keyIdMatch ? keyIdMatch[1].trim() : '';
const privateKey = pkMatch ? pkMatch[1].trim() : '';

function signRequest(pk, timestamp, method, pathStr) {
    const message = `${timestamp}${method}${pathStr}`;
    const signature = crypto.sign("sha256", Buffer.from(message), {
        key: pk,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
    });
    return signature.toString('base64');
}

async function request(method, pathStr) {
    const timestamp = Date.now().toString();
    const signature = signRequest(privateKey, timestamp, method, pathStr);
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.elections.kalshi.com',
            path: `/trade-api/v2${pathStr}`,
            method,
            headers: {
                'KALSHI-ACCESS-KEY': apiKeyId,
                'KALSHI-ACCESS-TIMESTAMP': timestamp,
                'KALSHI-ACCESS-SIGNATURE': signature,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
                else reject(new Error(`Status ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    try {
        console.log("=== REPUBLICAN NOMINEES (KXGOVCONOMR) ===");
        const rep = await request('GET', '/markets?series_ticker=KXGOVCONOMR');
        rep.markets.forEach(m => console.log(`  ${m.yes_sub_title} | Price: ${m.last_price_dollars} | Ticker: ${m.ticker}`));
        
        console.log("\n=== DEMOCRATIC NOMINEES (KXGOVCONOMD) ===");
        const dem = await request('GET', '/markets?series_ticker=KXGOVCONOMD');
        dem.markets.forEach(m => console.log(`  ${m.yes_sub_title} | Price: ${m.last_price_dollars} | Ticker: ${m.ticker}`));
    } catch (e) {
        console.log("Error:", e.message);
    }
}
run();
