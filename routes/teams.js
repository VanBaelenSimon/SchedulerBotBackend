// ./routes/teams.js
const express = require('express');
const router = express.Router();

const teamsController = require('../controllers/teamsController');

// Create a team
router.post('/', teamsController.createTeam);

// Get all teams in the Guild (Discord Server)
router.get('/:guildId', teamsController.getTeams);

// Get all members from your team
router.get('/:guildId/user/:userId', teamsController.getUserTeam);

// Delete a team (only if user is the creator)
router.delete('/:guildId/user/:userId', teamsController.deleteTeam);

// Add members to the team.
router.post('/add/:guildId/user/:userId', teamsController.addMembers);

// List availability (all)
router.get('/:guildId/user/:userId/availabilities', teamsController.listTeamAvailability);

module.exports = router;