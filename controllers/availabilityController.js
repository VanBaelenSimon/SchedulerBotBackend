const { db } = require('../config/firebase')

// Add availability
exports.addAvailability = async (req, res) => {
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
}

// List user availability
exports.listAvailability = async (req, res) => {
    try {
    const { guildId, userId, type } = req.query;
    let query = db.collection('availabilities');

    if (guildId) query = query.where('guildId', '==', guildId);
    if (userId) query = query.where('userId', '==', userId);
    if (type) query = query.where('type', '==', type);

    const snapshot = await query.get();
    const data = snapshot.docs.filter(a => {
      a.guildId === guildId
    })
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Remove availability
exports.removeAvailability = async (req, res) => {
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
}

// Compare availability
exports.compareAvailability = async (req, res) => {
    try {
    const { guildId } = req.params;
    const { type, threshold, userId } = req.query;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Missing required "type"' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing required "userId"' });
    }

    // 1) Find the team the requesting user belongs to
    const teamSnapshot = await db.collection('teams')
      .where('guildId', '==', guildId)
      .where('members', 'array-contains', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      // Not in a team → return no overlaps, but keep success = true to avoid breaking clients
      return res.json({ success: true, overlaps: [], teamName: null });
    }

    const teamDoc = teamSnapshot.docs[0].data();
    const teamName = teamDoc.teamName || null;
    const memberIds = Array.isArray(teamDoc.members) ? teamDoc.members : [];

    if (memberIds.length === 0) {
      return res.json({ success: true, overlaps: [], teamName });
    }

    // 2) Fetch availabilities for just those team members (chunk "in" queries to ≤10 IDs each)
    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const memberChunks = chunk(memberIds, 10);
    let availabilities = [];

    for (const mChunk of memberChunks) {
      const snap = await db.collection('availabilities')
        .where('guildId', '==', guildId)
        .where('type', '==', type)
        .where('userId', 'in', mChunk)
        .get();

      availabilities.push(...snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }

    if (availabilities.length === 0) {
      return res.json({ success: true, overlaps: [], teamName });
    }

    // 3) Original sweep-line logic, but scoped to team members only
    const users = new Set(availabilities.map(a => a.userId));
    const userCount = users.size;
    const required = Math.ceil(((parseInt(threshold) || 100) / 100) * userCount);

    let events = [];
    for (const a of availabilities) {
      const start = new Date(a.startUtc);
      const end = new Date(a.endUtc);
      events.push({ time: start, type: 'start', userId: a.userId, end });
      events.push({ time: end, type: 'end', userId: a.userId });
    }

    // Ensure ends are processed before starts when times tie
    events.sort((a, b) => a.time - b.time || (a.type === 'end' ? -1 : 1));

    let active = new Map();
    let overlaps = [];
    let currentStart = null;

    for (const ev of events) {
      if (ev.type === 'start') {
        active.set(ev.userId, ev.end);
        if (active.size >= required && !currentStart) {
          currentStart = ev.time;
        }
      } else {
        if (currentStart && active.size >= required) {
          const minEnd = Math.min(...Array.from(active.values()).map(d => d.getTime()));
          overlaps.push({
            startUtc: currentStart.toISOString(),
            endUtc: new Date(minEnd).toISOString(),
            users: [...active.keys()],
          });
          currentStart = null;
        }
        active.delete(ev.userId);
      }
    }

    res.json({ success: true, overlaps, teamName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}