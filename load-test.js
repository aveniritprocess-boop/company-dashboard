/* eslint-disable */
const http = require('http');

function makeRequest(id) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        http.get('http://localhost:3000/login', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const endTime = Date.now();
                resolve({ id, status: res.statusCode, time: endTime - startTime });
            });
        }).on('error', (err) => {
            reject({ id, error: err.message });
        });
    });
}

async function runTest() {
    console.log("Starting 30 concurrent connection tests...");
    const requests = [];
    for (let i = 1; i <= 30; i++) {
        requests.push(makeRequest(i));
    }

    try {
        const results = await Promise.all(requests);
        const successCount = results.filter(r => r.status === 200).length;
        const totalTime = results.reduce((acc, curr) => acc + curr.time, 0) / results.length;
        console.log(`\nTest Complete:`);
        console.log(`✅ Success: ${successCount}/30`);
        console.log(`⏱️ Average Response Time: ${totalTime.toFixed(2)}ms`);
        
        if (successCount === 30) {
            console.log("\n🚀 Concurrency stress test passed successfully!");
        } else {
            console.log("\n⚠️ Some requests failed.");
        }
    } catch (e) {
        console.error("Test failed:", e);
    }
}

runTest();
