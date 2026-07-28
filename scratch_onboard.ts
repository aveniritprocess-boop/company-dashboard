import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as admin from 'firebase-admin';

let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const adminAuth = admin.auth();
const adminDb = admin.firestore();

async function run() {
  try {
    // find manager
    const managerSnap = await adminDb.collection('users').where('name', '==', 'Dinesh Pratap Singh').limit(1).get();
    let managerId = '';
    if (!managerSnap.empty) {
      managerId = managerSnap.docs[0].id;
    }
    
    console.log("Manager ID:", managerId);

    let uid = "";
    try {
      const userRecord = await adminAuth.createUser({
        email: 'avenir.rishi@gmail.com',
        password: 'Password123!',
        displayName: 'Rishivender pal Singh',
      });
      uid = userRecord.uid;
      console.log("Auth user created:", uid);
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
         console.log("User already exists in auth, fetching uid");
         const existingUser = await adminAuth.getUserByEmail('avenir.rishi@gmail.com');
         uid = existingUser.uid;
      } else {
         throw e;
      }
    }

    const userData = {
      email: 'avenir.rishi@gmail.com',
      name: 'Rishivender pal Singh',
      mobile: '9319730101',
      gender: 'male',
      designation: 'Sr.Tech Manager',
      role: 'employee',
      reporting_manager_id: managerId,
      department: 'Technical',
      employee_type: 'permanent',
      joining_date: '2026-07-28',
      is_active: true,
      portal_access: true,
      is_locked: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'system',
      created_by_name: 'System',
    };

    await adminDb.collection('users').doc(uid).set(userData);
    console.log("Firestore doc created");

    // set custom claims
    await adminAuth.setCustomUserClaims(uid, {
        role: 'employee',
        is_active: true,
        portal_access: true
    });
    console.log("Claims set");

  } catch (e) {
    console.error(e);
  }
}
run();
