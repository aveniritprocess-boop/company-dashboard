require('dotenv').config({ path: '.env.local' });
console.log("Starts with quotes?", process.env.FIREBASE_PRIVATE_KEY.startsWith('"'));
console.log("Ends with quotes?", process.env.FIREBASE_PRIVATE_KEY.endsWith('"'));
console.log("Has literal \\n?", process.env.FIREBASE_PRIVATE_KEY.includes('\\n'));
console.log("Has real newlines?", process.env.FIREBASE_PRIVATE_KEY.includes('\n'));
