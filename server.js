const express = require('express');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');

const app = express();
app.use(express.json());
app.use(cors());

// Init Firebase
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

// --- Routes --- //

// Add availability
app.post('/availability', async (req, res) => {
  try {
    const { guildId, userId, type, startUtc, endUtc } = req.body;
    if (!guildId || !userId || !type || !startUtc || !endUtc) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Find max shortId for this user in this guild
    const snapshot = await db.collection('availabilities')
      .where('guildId', '==', guildId)
      .where('userId', '==', userId)
      .orderBy('shortId', 'desc')
      .limit(1)
      .get();

    let newShortId = 1;
    if (!snapshot.empty) {
      newShortId = snapshot.docs[0].data().shortId + 1;
    }

    const docRef = await db.collection('availabilities').add({
      guildId,
      userId,
      type,
      startUtc,
      endUtc,
      shortId: newShortId,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, id: docRef.id, shortId: newShortId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List availability
app.get('/availability/:guildId/:userId/:type', async (req, res) => {
  try {
    const { guildId, userId, type } = req.query;
    let query = db.collection('availabilities');

    if (guildId) query = query.where('guildId', '==', guildId);
    if (userId) query = query.where('userId', '==', userId);
    if (type) query = query.where('type', '==', type);

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove availability by shortId
app.delete('/availability/:guildId/:userId/:shortId', async (req, res) => {
  try {
    const { guildId, userId, shortId } = req.params;

    const snapshot = await db.collection('availabilities')
      .where('guildId', '==', guildId)
      .where('userId', '==', userId)
      .where('shortId', '==', parseInt(shortId))
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ success: false, error: 'Availability not found' });
    }

    await db.collection('availabilities').doc(snapshot.docs[0].id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Health check
app.get('/', (req, res) => {
  res.send('Availability Backend is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
