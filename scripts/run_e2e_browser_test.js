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
const db = admin.firestore();

const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

async function runE2ETests() {
    console.log("==================================================");
    console.log("PLAYWRIGHT END-TO-END BUSINESS ROLE TEST SUITE");
    console.log("==================================================");

    const testAccounts = [
        { person: "Himanshu Sharma", email: "avenir.itprocess@gmail.com", businessDesignation: "CEO", appRole: "ceo" },
        { person: "Dinesh Pratap Singh", email: "avenirdps@gmail.com", businessDesignation: "MD", appRole: "md" },
        { person: "Ravi Khushwa", email: "avenirravi@gmail.com", businessDesignation: "Admin", appRole: "admin" },
        { person: "Himanshu Sharma", email: "himanshusharma34336@gmail.com", businessDesignation: "Admin", appRole: "admin" },
        { person: "Rajni Kant Singh", email: "admin.avenir@gmail.com", businessDesignation: "Manager", appRole: "manager" },
        { person: "Devraj Thakur", email: "devavenirgroup.2017@gmail.com", businessDesignation: "Manager", appRole: "employee" },
        { person: "Rishi Kametiya", email: "avenir.rishi@gmail.com", businessDesignation: "Technical Head", appRole: "employee" },
        { person: "Jyoti Raghav", email: "mktg@avenirgroup.in", businessDesignation: "Marketing Head + AGM", appRole: "employee" },
        { person: "Rupam Raghav", email: "avenirjjm@gmail.com", businessDesignation: "HR", appRole: "employee" },
    ];

    const browser = await chromium.launch({ headless: true });

    for (const acc of testAccounts) {
        console.log(`\n--------------------------------------------------`);
        console.log(`TESTING BUSINESS DESIGNATION: [${acc.person}] — ${acc.businessDesignation}`);
        console.log(`Email: ${acc.email} | Stored App Role: ${acc.appRole}`);
        console.log(`--------------------------------------------------`);

        const userRecord = await auth.getUserByEmail(acc.email);
        const uid = userRecord.uid;

        // Generate custom token and exchange for ID token using Firebase REST API
        const customToken = await auth.createCustomToken(uid);
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

        const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: customToken, returnSecureToken: true })
        });
        const verifyData = await verifyRes.json();
        const idToken = verifyData.idToken;

        // Create session cookie
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
        const networkFailures = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
                if (msg.text().includes('permission-denied') || msg.text().includes('FirebaseError') || msg.text().includes('403')) {
                    permissionErrors.push(msg.text());
                }
            }
        });

        page.on('response', response => {
            if (response.status() === 403 || response.status() === 500) {
                networkFailures.push(`${response.url()} [${response.status()}]`);
            }
        });

        // 1. Load Dashboard
        console.log(`  1. Navigating to /dashboard...`);
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const title = await page.title();
        console.log(`  Page Title: "${title}"`);

        const currentUrl = page.url();
        const isDashboardLoaded = currentUrl.includes('/dashboard');
        console.log(`  Dashboard Loaded Cleanly: ${isDashboardLoaded ? "✅ PASS" : "❌ FAIL"}`);

        // 2. CEO/MD Parity Routes
        if (acc.appRole === "md" || acc.appRole === "ceo") {
            const pagesToTest = [
                "/dashboard/employees",
                "/dashboard/task-given-by-sir",
                "/dashboard/locations",
                "/dashboard/monitoring",
                "/dashboard/backup",
                "/dashboard/progress"
            ];
            for (const p of pagesToTest) {
                await page.goto(`${BASE_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(1000);
                const isAccessGranted = page.url().includes(p);
                console.log(`    Access to ${p}: ${isAccessGranted ? "✅ GRANTED" : "❌ DENIED/REDIRECTED"}`);
            }
        }

        // 3. Quick Actions Hub & Create Task Modal Verification
        console.log(`  Testing Quick Actions & Create Task Modal on /dashboard...`);
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3500);

        try {
            const taskBtn = page.locator('button, a').filter({ hasText: /Create Task|New Task/i }).first();
            await taskBtn.waitFor({ state: 'visible', timeout: 20000 });
            console.log(`  Create Task Action Visible: ✅ PASS`);
        } catch (err) {
            console.log(`  Create Task Action Visible: ℹ️ Checking /dashboard/tasks fallback...`);
            await page.goto(`${BASE_URL}/dashboard/tasks`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3500);
            const fallbackBtn = page.locator('button, a').filter({ hasText: /Create Task|New Task/i }).first();
            await fallbackBtn.waitFor({ state: 'visible', timeout: 20000 });
            const isVisible = await fallbackBtn.isVisible();
            console.log(`  Task Board Navigation & Button: ${isVisible ? "✅ PASS" : "❌ FAIL"}`);
        }

        console.log(`  Permission Errors Count  : ${permissionErrors.length} ${permissionErrors.length === 0 ? "✅ PASS" : "❌ FAIL"}`);
        console.log(`  Network Failures Count   : ${networkFailures.length} ${networkFailures.length === 0 ? "✅ PASS" : "❌ FAIL"}`);

        await context.close();
    }

    await browser.close();
    console.log("\n==================================================");
    console.log("BUSINESS DESIGNATION E2E TESTING COMPLETE!");
    console.log("==================================================");
    process.exit(0);
}

runE2ETests().catch(err => {
    console.error(err);
    process.exit(1);
});
