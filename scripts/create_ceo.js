const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, setDoc, doc, updateDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createOrElevateUser(email, role) {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);

    if (!snap.empty) {
        const userDoc = snap.docs[0];
        await updateDoc(doc(db, "users", userDoc.id), {
            role: role
        });
        console.log(`User ${email} found and elevated to ${role}. UID: ${userDoc.id}`);
    } else {
        // Need to create a new user document
        // Firebase auth UID might be different, but we can generate a random one for now,
        // or just use email as the document ID as a fallback. It's better to wait for auth,
        // but the login logic says:
        // const userDoc = await getDoc(doc(db, "users", user.uid));
        // This requires the doc ID to be the Firebase Auth UID!
        console.log("User not found in Firestore. If this user hasn't signed up yet, they will fail to log in because the Firestore document ID must match their Firebase Auth UID.");
        console.log("Please sign in with Google once to create the Firebase Auth user, even if it fails with 'not registered'. Then I can find the UID in Firebase console or list_users script, and create the Firestore document.");
    }
    process.exit(0);
}

createOrElevateUser("avenir.itprocess@gmail.com", "ceo");
