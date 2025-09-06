// ./routes/availability.js
const express = require('express');
const router = express.Router();

const availabilityController = require('../controllers/availabilityController');

// Add availability
router.post('/', availabilityController.addAvailability);

// List availability (individual)
router.get('/:guildId/:userId', availabilityController.listAvailability);

// Remove availability by shortId
router.delete(
  '/:guildId/:userId/:shortId',
  availabilityController.removeAvailability
);

// Compare availability
router.get('/:guildId/compare', availabilityController.compareAvailability);

// Export routes
module.exports = router;
