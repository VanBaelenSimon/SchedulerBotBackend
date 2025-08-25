require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db } = require('./config/firebase');

const app = express();
app.use(express.json());
app.use(cors());

// Routes
app.use('/availability', require('./routes/availability'));
app.use('/teams', require('./routes/teams'));

// Health check
app.get('/', (req, res) => {
  res.send('Availability Backend is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));