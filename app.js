// app.js

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const { JSearch } = require('rapidapi-jsearch');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/jobs', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  profile: Object,
  applications: Array
});
const User = mongoose.model('User', UserSchema);

// JWT secret key
const JWT_SECRET = 'your_secret_key';

// Authentication middleware
const authenticateJWT = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.sendStatus(403);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Authentication endpoint
app.post('/api/auth', (req, res) => {
  const { username, password } = req.body;
  User.findOne({ username, password }, (err, user) => {
    if (err || !user) return res.sendStatus(403);
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token });
  });
});

// Job search endpoint
app.get('/api/jobs', authenticateJWT, (req, res) => {
  const jsearch = new JSearch({ apiKey: 'your_rapidapi_key' });
  jsearch.search({ query: 'developer' }).then(results => {
    res.json(results);
  }).catch(err => res.status(500).json({ error: err.message }));
});

// Profile management
app.get('/api/profile', authenticateJWT, (req, res) => {
  User.findById(req.user.id, (err, user) => {
    if (err || !user) return res.sendStatus(404);
    res.json(user);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
