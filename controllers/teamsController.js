require('dotenv').config();
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const {
  batchDeleteAvailabilities,
} = require('../services/availabilityService');

// Create team
exports.createTeam = async (req, res) => {
  try {
    const { guildId, teamName, members, createdBy } = req.body;

    if (!guildId || !teamName || !members || members.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
    }

    const teamRef = await db.collection('teams').add({
      guildId,
      teamName,
      members,
      createdBy,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, id: teamRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all teams
exports.getTeams = async (req, res) => {
  try {
    const { guildId } = req.params;

    const snapshot = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .get();

    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get user team
exports.getUserTeam = async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const teamSnapshot = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .where('members', 'array-contains', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.json({ success: true, team: null });
    }

    const team = {
      id: teamSnapshot.docs[0].id,
      ...teamSnapshot.docs[0].data(),
    };
    res.json({ success: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete team
exports.deleteTeam = async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const teamSnapshot = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .where('createdBy', '==', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.status(403).json({
        success: false,
        error: 'You are not the creator of any team in this guild.',
      });
    }

    await db.collection('teams').doc(teamSnapshot.docs[0].id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Add members to team
exports.addMembers = async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { members } = req.body;

    if (!guildId || !members) {
      return res
        .status(400)
        .json({ success: false, error: 'guildId and members are required' });
    }

    const teamSnapshot = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .where('createdBy', '==', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.status(403).json({
        succes: false,
        error: 'You are not the creator of the team you are in.',
      });
    }

    const teamDoc = teamSnapshot.docs[0].ref;

    await teamDoc.update({
      members: FieldValue.arrayUnion(...members),
    });

    res.status(200).json({
      success: true,
      message: `Added member(s) to the team. Use '/team list' to view all members.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// List team availability
exports.listTeamAvailability = async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { type } = req.query;

    // Find the team where this user is a member
    const teamSnapshot = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .where('members', 'array-contains', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.json({ success: true, results: [] });
    }

    const team = teamSnapshot.docs[0].data();
    const memberIds = team.members || [];

    // Query availabilities of team members
    let query = db
      .collection('availabilities')
      .where('guildId', '==', guildId)
      .where('userId', 'in', memberIds);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    const results = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Clear the whole team's availability
exports.clearTeamAvailability = async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const teamSnapshopt = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .where('createdBy', '==', userId)
      .limit(1)
      .get();

    if (teamSnapshopt.empty) {
      return res.status(403).json({
        success: false,
        message: 'You are not the creator of any team in this guild.',
      });
    }
    const team = {
      id: teamSnapshopt.docs[0].id,
      ...teamSnapshopt.docs[0].data(),
    };

    const items = [];
    for (const memberId of team.members) {
      const availabilitySnapshot = await db
        .collection('availabilities')
        .where('guildId', '==', guildId)
        .where('userId', '==', memberId)
        .get();

      if (!availabilitySnapshot.empty) {
        const shortIds = availabilitySnapshot.docs.map(
          (doc) => doc.data().shortId
        );
        items.push({ userId: memberId, shortIds });
      }
    }

    if (items.length === 0) {
      return res.json(404).json({
        success: false,
        message: 'No availabilities found for team members.',
      });
    }

    const result = await batchDeleteAvailabilities(guildId, items);

    return res.status(200).json({
      success: true,
      message: `Cleared ${team.teamName}'s schedule.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Compare availability
exports.compareAvailability = async (req, res) => {
  try {
    const { guildId } = req.params;
    const { type, threshold, userId } = req.query;

    console.log(guildId, type, threshold, userId);

    if (!type) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required "type"' });
    }
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required "userId"' });
    }

    const teamSnapshot = await db
      .collection('teams')
      .where('guildId', '==', guildId)
      .where('members', 'array-contains', userId)
      .limit(1)
      .get();

    console.log(teamSnapshot);

    if (teamSnapshot.empty) {
      return res.json({ success: true, overlaps: [], teamName: null });
    }

    const teamDoc = teamSnapshot.docs[0].data();
    const teamName = teamDoc.teamName || null;
    const memberIds = Array.isArray(teamDoc.members) ? teamDoc.members : [];

    console.log({ teamDoc, teamName, memberIds });

    if (memberIds.length === 0) {
      return res.json({ success: true, overlaps: [], teamName });
    }

    const chunk = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
      return out;
    };

    const memberChunks = chunk(memberIds, 10);
    let availabilities = [];

    for (const mChunk of memberChunks) {
      const snap = await db
        .collection('availabilities')
        .where('guildId', '==', guildId)
        .where('type', '==', type)
        .where('userId', 'in', mChunk)
        .get();

      availabilities.push(
        ...snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    }

    if (availabilities.length === 0) {
      return res.json({ success: true, overlaps: [], teamName });
    }

    const users = new Set(availabilities.map((a) => a.userId));
    const userCount = users.size;
    const required = Math.ceil(
      ((parseInt(threshold) || 100) / 100) * userCount
    );

    let events = [];
    for (const a of availabilities) {
      const start = new Date(a.startUtc);
      const end = new Date(a.endUtc);
      events.push({ time: start, type: 'start', userId: a.userId, end });
      events.push({ time: end, type: 'end', userId: a.userId });
    }

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
          const minEnd = Math.min(
            ...Array.from(active.values()).map((d) => d.getTime())
          );
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
};
