require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);

// Middleware
app.use(cookieParser());

// Routes
app.use('/availability', require('./routes/availability'));
app.use('/teams', require('./routes/teams'));
app.use('/auth', require('./routes/authRoutes'));

// Health check
app.get('/', (req, res) => {
  res.send('Availability Backend is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
