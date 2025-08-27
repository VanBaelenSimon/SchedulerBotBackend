require('dotenv').config();
const { db } = require('../config/firebase')
const { FieldValue } = require('firebase-admin/firestore');

// Create team
exports.createTeam = async (req, res) => {
    try {
        const { guildId, teamName, members, createdBy } = req.body;

        if (!guildId || !teamName || !members || members.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
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
}

// Get all teams
exports.getTeams = async (req, res) => {
    try {
    const { guildId } = req.params;

    const snapshot = await db.collection('teams')
      .where('guildId', '==', guildId)
      .get();

    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Get user team
exports.getUserTeam = async (req, res) => {
    try {
    const { guildId, userId } = req.params;

    const teamSnapshot = await db.collection('teams')
      .where('guildId', '==', guildId)
      .where('members', 'array-contains', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.json({ success: true, team: null });
    }

    const team = { id: teamSnapshot.docs[0].id, ...teamSnapshot.docs[0].data() };
    res.json({ success: true, team });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Delete team
exports.deleteTeam = async (req, res) => {
  try {
    const { guildId, userId } = req.params;

    const teamSnapshot = await db.collection('teams')
      .where('guildId', '==', guildId)
      .where('createdBy', '==', userId)
      .limit(1)
      .get();

    if (teamSnapshot.empty) {
      return res.status(403).json({ success: false, error: 'You are not the creator of any team in this guild.' });
    }

    await db.collection('teams').doc(teamSnapshot.docs[0].id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Add members to team
exports.addMembers = async (req, res) => {
    try {
        const { guildId, userId } = req.params;
        const { members } = req.body
        
        if (!guildId || !members) {
        return res.status(400).json({success: false, error: 'guildId and members are required'})
        }

        const teamSnapshot = await db.collection('teams')
        .where('guildId', '==', guildId)
        .where('createdBy', '==', userId)
        .limit(1)
        .get();

        if (teamSnapshot.empty) {
        return res.status(403).json({ succes: false, error: 'You are not the creator of the team you are in.'})
        }
        
        const teamDoc = teamSnapshot.docs[0].ref;

        await teamDoc.update({
        members: FieldValue.arrayUnion(...members)
        });

        res.status(200).json({ success: true, message: `Added member(s) to the team. Use '/team list' to view all members.`})
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
}

// List team availability
exports.listTeamAvailability = async (req, res) => {
try {
    const { guildId, userId } = req.params;
    const { type } = req.query;

    // Find the team where this user is a member
    const teamSnapshot = await db.collection('teams')
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
    let query = db.collection('availabilities')
      .where('guildId', '==', guildId)
      .where('userId', 'in', memberIds);

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
}

exports.clearTeamAvailability = async (req, res) => {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
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
        message: 'You are not the creator of any team in this guild.',
      });
    }
    const team = {
      id: teamSnapshot.docs[0].id,
      ...teamSnapshot.docs[0].data(),
    };
    const teamMembers = team.members;
    for (const memberId of teamMembers) {
      const availabilitySnapshot = await db
        .collection('availabilities')
        .where('guildId', '==', guildId)
        .where('userId', '==', memberId)
        .get();

      if (availabilitySnapshot.empty) {
        return res.status(403).json({
          success: false,
          message:
            'Team members do not have any availabilties set within this guild.',
        });
      }
      
      for (const doc of availabilitySnapshot.docs) {
        const availability = {id: doc.id, ...doc.data()};        
        const res = await fetch(
          `${API_URL}/availability/${guildId}/${availability.userId}/${availability.shortId}`,
          {
            method: 'DELETE',
          }
        );
      }
    }
    res
      .status(200)
      .json({ success: true, message: `Cleared ${team.teamName}'s schedule.` });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to clear schedule command' });
  }
}