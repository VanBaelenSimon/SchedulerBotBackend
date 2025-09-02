// ./controllers/authController.js
require('dotenv').config();
const frontendUrl =
  process.env.FRONTEND_URL || 'http://localhost:5173/callback';

exports.discordLogin = async (req, res) => {
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const scope = 'identify guilds';
  const responseType = 'code';

  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=${responseType}&scope=${encodeURIComponent(scope)}`;

  res.redirect(url);
};

exports.discordCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  try {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      scope: 'identify guilds',
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const { access_token, token_type } = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      hearders: { Authorization: `${token_type} ${access_token}` },
    });
    const user = await userResponse.json();

    const guildsResponse = await fetch(
      'https://discord.com/api/users/@me/guilds',
      {
        headers: { Authorization: `${token_type} ${access_token}` },
      }
    );
    const guilds = await guildsResponse.json();

    res.json({ user, guilds, access_token });
  } catch (error) {
    console.error(error);
    res.status(500).send('OAuth2 error');
  }
};

exports.discordFinalize = async (req, res) => {
  const jwt = require('jsonwebtoken');
  const { guildId, guildName, user } = req.body;

  if (!guildId || !guildName || !user)
    return res.status(400).send('Missing info');

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      guildId,
      guildName,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  res.json({ success: true });
};

exports.discordMe = async (req, res) => {
  const jwt = require('jsonwebtoken');

  const token = req.cookies.token;
  if (!token)
    return res.status(401).json({ success: false, error: 'Not logged in' });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: true, error: 'Invalid or expired token' });
  }
};

exports.discordLogout = async (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'lax' });
  res.json({ success: true, message: 'Logged out' });
};
