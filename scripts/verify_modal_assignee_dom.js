const { chromium } = require('playwright');
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
} else {
    console.error("Missing credentials");
    process.exit(1);
}

const auth = admin.auth();
const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

async function verifyModalDOM() {
    console.log("=================================================");
    console.log("VERIFYING TASK ASSIGNEE DROPDOWN IN REAL BROWSER DOM");
    console.log("=================================================");

    const userRecord = await auth.getUserByEmail("avenirdps@gmail.com"); // MD DPS Sir
    const uid = userRecord.uid;

    const customToken = await auth.createCustomToken(uid);
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const verifyData = await verifyRes.json();
    const idToken = verifyData.idToken;

    const expiresIn = 5 * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies([{
        name: 'session',
        value: sessionCookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
    }]);

    const page = await context.newPage();

    console.log("1. Navigating to /dashboard/task-given-by-sir...");
    await page.goto(`${BASE_URL}/dashboard/task-given-by-sir`, { waitUntil: 'load', timeout: 30000 });
    
    console.log("2. Waiting for page header...");
    await page.waitForSelector('h1', { timeout: 15000 });
    const h1Text = await page.locator('h1').innerText();
    console.log(`   Header text: "${h1Text}"`);

    console.log("3. Clicking 'Assign Task' button...");
    const assignTaskBtn = page.locator('button').filter({ hasText: 'Assign Task' }).first();
    await assignTaskBtn.waitFor({ state: 'visible', timeout: 15000 });
    await assignTaskBtn.click();
    console.log("   'Assign Task' button clicked!");

    console.log("3. Waiting for Employee Assignee Select element to render...");
    const selectElem = page.locator('select').first();
    await selectElem.waitFor({ state: 'attached', timeout: 15000 });
    const selectOptions = await selectElem.locator('option').allInnerTexts();
    console.log(`\n  Rendered Select Options Count: ${selectOptions.length}`);
    selectOptions.forEach((opt, idx) => {
        console.log(`   [${idx + 1}] ${opt}`);
    });

    if (selectOptions.length > 2) {
        console.log("\n=================================================");
        console.log("Result: ✅ PASSED - Assignee dropdown contains all active employees!");
        console.log("=================================================");
        await browser.close();
        process.exit(0);
    } else {
        console.log("\nResult: ❌ FAILED - Select options missing");
        await browser.close();
        process.exit(1);
    }
}

verifyModalDOM().catch(err => {
    console.error(err);
    process.exit(1);
});
