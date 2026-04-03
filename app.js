require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = express();

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Job application schema and model
const applicationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now }
});
const Application = mongoose.model('Application', applicationSchema);

// Middleware for JWT authentication
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Signup endpoint
app.post('/signup', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).send('User created');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const user = await User.findOne({ username: req.body.username });
    if (!user || user.password !== req.body.password) {
        return res.status(401).send('Invalid credentials');
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token });
});

// Profile management endpoints
app.get('/profile', authenticateToken, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json(user);
});

app.post('/profile', authenticateToken, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, req.body);
        res.send('Profile updated');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// Fetch real jobs from RapidAPI JSearch
app.get('/fetchJobs', async (req, res) => {
    const options = {
        method: 'GET',
        url: 'https://jsearch.p.rapidapi.com/search',
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY
        },
        params: {
            query: req.query.query,
            location: req.query.location
        }
    };
    try {
        const response = await axios.request(options);
        res.json(response.data);
    } catch (error) {
        res.status(500).send('Error fetching jobs');
    }
});

// Job application submission endpoint
app.post('/apply', authenticateToken, async (req, res) => {
    try {
        const application = new Application({ userId: req.user.id, jobId: req.body.jobId });
        await application.save();
        res.status(201).send('Application submitted');
    } catch (err) {
        res.status(400).send(err.message);
    }
});

// Root route serving HTML frontend
app.get('/', (req, res) => {
    res.send(`<html><body>
        <h1>Job Swiping Application</h1>
        <div id='job-list'></div>
        <script>
            // Implement job swiping functionality here
        </script>
    </body></html>`);
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});