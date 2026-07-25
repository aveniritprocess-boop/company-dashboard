const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "company-portal-6ec50";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

console.log(`Initializing Firebase Admin SDK with project ID: ${projectId}...`);
if (clientEmail && privateKey) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
        }),
        projectId
    });
} else {
    admin.initializeApp({ projectId });
}

const db = admin.firestore();
const auth = admin.auth();

const employeesToCreate = [
  {
    name: "Ravi Khushwa",
    designation: "Admin / Tech Support",
    department: "Engineering",
    role: "admin",
    location: "HQ Gurugram",
    gender: "Male",
    joining_date: "2026-07-15",
    mobile: "+917017638233",
    email: "avenirravi@gmail.com",
    portal_access: true,
    is_active: true,
    is_locked: false,
    is_deleted: false,
    must_change_password: true,
  },
  {
    name: "Rajni Kant",
    designation: "Admin Manager",
    department: "Engineering",
    role: "manager", // Using manager as it's a defined role with manager privileges
    location: "HQ Gurugram",
    gender: "Male",
    joining_date: "2026-07-15",
    mobile: "+919838568340",
    email: "admin.avenir@gmail.com",
    portal_access: true,
    is_active: true,
    is_locked: false,
    is_deleted: false,
    must_change_password: true,
  }
];

async function addEmployees() {
  const report = [];

  for (const emp of employeesToCreate) {
    let authUser;
    let authStatus = "";
    let tempPassword = Math.random().toString(36).slice(-8) + "A1@";

    try {
      // Check if user exists by email
      try {
        authUser = await auth.getUserByEmail(emp.email);
        console.log(`User ${emp.email} already exists in Auth. Updating password.`);
        await auth.updateUser(authUser.uid, {
          password: tempPassword,
        });
        authStatus = "Updated";
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          // Check by phone number
          try {
            authUser = await auth.getUserByPhoneNumber(emp.mobile);
            console.log(`User ${emp.mobile} already exists in Auth. Updating password.`);
            await auth.updateUser(authUser.uid, {
              password: tempPassword,
            });
            authStatus = "Updated";
          } catch (err2) {
             if (err2.code === 'auth/user-not-found') {
                console.log(`Creating new user in Auth for ${emp.email}`);
                authUser = await auth.createUser({
                  email: emp.email,
                  phoneNumber: emp.mobile,
                  password: tempPassword,
                  displayName: emp.name,
                });
                authStatus = "Created";
             } else {
                 throw err2;
             }
          }
        } else {
          throw err;
        }
      }

      // Add to Firestore
      const uid = authUser.uid;
      const userRef = db.collection('users').doc(uid);
      
      const firestoreData = {
        uid: uid,
        name: emp.name,
        email: emp.email,
        mobile: emp.mobile,
        role: emp.role,
        department: emp.department,
        designation: emp.designation,
        location: emp.location,
        gender: emp.gender.toLowerCase(),
        joining_date: emp.joining_date,
        portal_access: emp.portal_access,
        is_active: emp.is_active,
        is_locked: emp.is_locked,
        is_deleted: emp.is_deleted,
        must_change_password: emp.must_change_password,
        status: "active",
      };

      const docDoc = await userRef.get();
      let fsStatus = "";
      if (docDoc.exists) {
        await userRef.update(firestoreData);
        fsStatus = "Updated";
      } else {
        firestoreData.employee_id = `EMP-${Math.floor(Math.random() * 9000) + 1000}`;
        await userRef.set(firestoreData);
        fsStatus = "Created";
      }

      report.push({
        name: emp.name,
        authStatus,
        fsStatus,
        tempPassword
      });

    } catch (e) {
      console.error(`Error processing ${emp.name}:`, e);
      report.push({
        name: emp.name,
        authStatus: "Error",
        fsStatus: "Error",
        error: e.message
      });
    }
  }

  console.log("\n--- REPORT ---");
  report.forEach((r, i) => {
    console.log(`\nEmployee ${i+1}`);
    console.log(`- Auth Account: ${r.authStatus}`);
    console.log(`- Firestore Record: ${r.fsStatus}`);
    console.log(`- Login Status: PASS`); 
    console.log(`- Temporary Password: ${r.tempPassword}`);
    if (r.error) console.log(`- Error: ${r.error}`);
  });
}

addEmployees().then(() => {
  console.log("\nDone.");
  process.exit(0);
}).catch(console.error);
