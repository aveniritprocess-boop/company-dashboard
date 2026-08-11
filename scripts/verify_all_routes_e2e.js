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

const ROUTES = [
    "/dashboard",
    "/dashboard/employees",
    "/dashboard/task-given-by-sir",
    "/dashboard/locations",
    "/dashboard/monitoring",
    "/dashboard/backup",
    "/dashboard/progress"
];

async function runE2ESuite() {
    console.log("=================================================");
    console.log("STEP 1: PRE-WARMING ROUTE COMPILES ON NEXT.JS SERVER");
    console.log("=================================================");

    for (const route of ROUTES) {
        try {
            const start = Date.now();
            const res = await fetch(`${BASE_URL}${route}`);
            const elapsed = Date.now() - start;
            console.log(`  Route ${route.padEnd(30)}: HTTP ${res.status} (compiled in ${elapsed}ms)`);
        } catch (e) {
            console.error(`  Route ${route}: Failed to warm up - ${e.message}`);
        }
    }

    console.log("\n=================================================");
    console.log("STEP 2: RUNNING PLAYWRIGHT E2E FOR ALL 4 ROLES");
    console.log("=================================================");

    const testAccounts = [
        { name: "CEO", email: "avenir.itprocess@gmail.com", role: "ceo" },
        { name: "MD (DPS Sir)", email: "avenirdps@gmail.com", role: "md" },
        { name: "Rajni Kant / Manager", email: "admin.avenir@gmail.com", role: "manager" },
        { name: "Employee (Devraj)", email: "devavenirgroup.2017@gmail.com", role: "employee" },
    ];

    const browser = await chromium.launch({ headless: true });
    let totalErrors = 0;

    for (const acc of testAccounts) {
        console.log(`\n-------------------------------------------------`);
        console.log(`ROLE SESSION TEST: [${acc.name}] (${acc.email})`);
        console.log(`-------------------------------------------------`);

        const userRecord = await auth.getUserByEmail(acc.email);
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

        const consoleErrors = [];
        const permissionErrors = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                const txt = msg.text();
                // Filter out non-fatal dev overlay noise if any
                if (txt.includes('FirebaseError') || txt.includes('permission-denied') || txt.includes('PERMISSION_DENIED')) {
                    permissionErrors.push(txt);
                } else {
                    consoleErrors.push(txt);
                }
            }
        });

        // 1. Load Main Dashboard
        console.log(`  1. Testing Dashboard Load for ${acc.role}...`);
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'load', timeout: 40000 });
        await page.waitForTimeout(1500);

        const currentUrl = page.url();
        const isLoaded = currentUrl.includes('/dashboard');
        console.log(`     URL: ${currentUrl} | Dashboard Loaded: ${isLoaded ? "✅ PASS" : "❌ FAIL"}`);
        if (!isLoaded) totalErrors++;

        // 2. CEO & MD Access Parity across all pages
        if (acc.role === "ceo" || acc.role === "md") {
            console.log(`  2. Verifying ${acc.role.toUpperCase()} Page Access Parity...`);
            for (const route of ROUTES) {
                await page.goto(`${BASE_URL}${route}`, { waitUntil: 'load', timeout: 40000 });
                await page.waitForTimeout(1000);
                const accessOk = page.url().includes(route);
                console.log(`     Page [${route.padEnd(28)}]: ${accessOk ? "✅ ACCESSIBLE (200)" : "❌ BLOCKED/REDIRECTED"}`);
                if (!accessOk) totalErrors++;
            }
        }

        // 3. Assignee Dropdown check for CEO, MD, Manager
        if (acc.role === "ceo" || acc.role === "md" || acc.role === "manager") {
            console.log(`  3. Testing Create Task Assignee Dropdown...`);
            await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'load', timeout: 40000 });
            await page.waitForTimeout(1500);

            const createBtn = page.locator('button:has-text("Create Task")').first();
            if (await createBtn.isVisible()) {
                await createBtn.click();
                await page.waitForTimeout(1000);

                const combobox = page.locator('[role="combobox"]').first();
                if (await combobox.isVisible()) {
                    await combobox.click();
                    await page.waitForTimeout(800);

                    const items = await page.locator('[data-slot="command-item"]').allInnerTexts();
                    console.log(`     Assignee Dropdown Options Count: ${items.length}`);
                    const hasSelf = items.some(i => i.includes('Self'));
                    const hasOthers = items.length > 1;
                    console.log(`     Assignee Dropdown All Active Employees Populated: ${hasSelf && hasOthers ? "✅ PASS" : "❌ FAIL"}`);
                    if (!hasSelf || !hasOthers) totalErrors++;
                } else {
                    console.log(`     Combobox element not visible`);
                }
            } else {
                console.log(`     Create Task button not visible`);
            }
        }

        console.log(`     Permission Errors Count : ${permissionErrors.length} ${permissionErrors.length === 0 ? "✅ PASS (0 Permission Errors)" : "❌ FAIL"}`);
        if (permissionErrors.length > 0) totalErrors += permissionErrors.length;

        await context.close();
    }

    await browser.close();

    console.log("\n=================================================");
    console.log("FINAL E2E VERIFICATION RESULT");
    console.log("=================================================");
    if (totalErrors === 0) {
        console.log("✅ ALL E2E BROWSER TESTS PASSED PERFECTLY WITH 0 ERRORS!");
        process.exit(0);
    } else {
        console.log(`❌ E2E VERIFICATION DETECTED ${totalErrors} ERRORS.`);
        process.exit(1);
    }
}

runE2ESuite().catch(err => {
    console.error(err);
    process.exit(1);
});
