const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const {
  batchDeleteAvailabilities,
} = require('../services/availabilityService');

// Add availability
exports.addAvailability = async (req, res) => {
  try {
    const { guildId, userId, type, startUtc, endUtc } = req.body;
    if (!guildId || !userId || !type || !startUtc || !endUtc) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
    }

    // Find max shortId for this user in this guild
    const snapshot = await db
      .collection('availabilities')
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
};

// List user availability
exports.listAvailability = async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    let query = db.collection('availabilities');

    if (guildId) query = query.where('guildId', '==', guildId);
    if (userId) query = query.where('userId', '==', userId);

    const snapshot = await query.get();
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Remove availability
exports.removeAvailability = async (req, res) => {
  try {
    const { guildId, userId, shortId } = req.params;

    const snapshot = await db
      .collection('availabilities')
      .where('guildId', '==', guildId)
      .where('userId', '==', userId)
      .where('shortId', '==', parseInt(shortId))
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res
        .status(404)
        .json({ success: false, error: 'Availability not found' });
    }

    await db.collection('availabilities').doc(snapshot.docs[0].id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.batchDelete = async (req, res) => {
  try {
    const { guildId, items } = req.body;

    if (!guildId || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
    }
    const results = await batchDeleteAvailabilities(guildId, items);
    res.json({ success: true, results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};
