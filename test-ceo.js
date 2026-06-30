const { initializeApp: initializeClient } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const clientApp = initializeClient(firebaseConfig);
const clientAuth = getAuth(clientApp);
const clientDb = getFirestore(clientApp);

async function runTest() {
    const adminEmail = 'avenir.itprocess@gmail.com';
    const adminPassword = 'Password123!';
    try {
        const result = await signInWithEmailAndPassword(clientAuth, adminEmail, adminPassword);
        const user = result.user;
        console.log('CEO Sign in successful!');
        
        const docRef = doc(clientDb, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log('CEO Document data:', docSnap.data());
        } else {
            console.log('No such document!');
        }
    } catch (err) {
        console.error('Failed:', err);
    }
}
runTest().then(()=>process.exit(0));
