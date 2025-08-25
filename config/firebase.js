const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

module.exports = { db, FieldValue};