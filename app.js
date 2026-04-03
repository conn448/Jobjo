// app.js
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs/gb/search';

// GET /api/jobs/search — fetch live UK jobs from Adzuna
app.get('/api/jobs/search', async (req, res) => {
    const { what = '', where = '', page = 1, category = '' } = req.query;

    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
        return res.status(503).json({
            error: 'Adzuna API credentials not configured. Please set ADZUNA_APP_ID and ADZUNA_APP_KEY.'
        });
    }

    try {
        const params = {
            app_id: ADZUNA_APP_ID,
            app_key: ADZUNA_APP_KEY,
            results_per_page: 20,
            page,
            content_type: 'application/json',
            'salary_include_unknown': 1,
            sort_by: 'date',
        };
        if (what) params['what'] = what;
        if (where) params['where'] = where;
        if (category) params['category'] = category;

        const response = await axios.get(`${ADZUNA_BASE}/${page}`, { params });
        const jobs = response.data.results.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company?.display_name || 'Unknown',
            location: job.location?.display_name || 'UK',
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            description: job.description,
            created: job.created,
            redirect_url: job.redirect_url,
            category: job.category?.label || '',
            contract_type: job.contract_type || '',
        }));
        res.json({ jobs, total: response.data.count });
    } catch (err) {
        console.error('Adzuna API error:', err.message);
        res.status(500).json({ error: 'Failed to fetch jobs from Adzuna.' });
    }
});

// GET /api/jobs/categories — fetch available categories
app.get('/api/jobs/categories', async (req, res) => {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
        return res.status(503).json({ error: 'Adzuna API credentials not configured.' });
    }
    try {
        const response = await axios.get('https://api.adzuna.com/v1/api/jobs/gb/categories', {
            params: { app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY }
        });
        res.json(response.data.results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// POST /api/jobs/match — skill-based job matching
app.post('/api/jobs/match', async (req, res) => {
    const { skills = [] } = req.body;
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
        return res.status(503).json({ error: 'Adzuna API credentials not configured.' });
    }
    try {
        const what = skills.join(' ');
        const params = {
            app_id: ADZUNA_APP_ID,
            app_key: ADZUNA_APP_KEY,
            results_per_page: 10,
            what,
            sort_by: 'relevance',
            'salary_include_unknown': 1,
        };
        const response = await axios.get(`${ADZUNA_BASE}/1`, { params });
        const jobs = response.data.results.map(job => ({
            id: job.id,
            title: job.title,
            company: job.company?.display_name || 'Unknown',
            location: job.location?.display_name || 'UK',
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            description: job.description,
            redirect_url: job.redirect_url,
        }));
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to match jobs.' });
    }
});

// Interactive HTML Frontend for Job Swiping
app.get('/', (req, res) => {
    const hasCredentials = !!(ADZUNA_APP_ID && ADZUNA_APP_KEY);
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jobjo — UK Job Swiper</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f0f2f5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        header {
            background: #fff;
            padding: 16px 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        header h1 { font-size: 1.6rem; color: #e74c3c; font-weight: 800; }
        header span { color: #666; font-size: 0.9rem; }
        .controls {
            background: #fff;
            padding: 14px 24px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            border-bottom: 1px solid #eee;
        }
        .controls input, .controls select {
            padding: 8px 14px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 0.9rem;
            outline: none;
            flex: 1;
            min-width: 120px;
        }
        .controls input:focus, .controls select:focus { border-color: #e74c3c; }
        .controls button {
            padding: 8px 20px;
            background: #e74c3c;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
        }
        .controls button:hover { background: #c0392b; }
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 30px 20px;
        }
        .setup-banner {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 16px 24px;
            border-radius: 12px;
            max-width: 560px;
            width: 100%;
            margin-bottom: 20px;
            font-size: 0.92rem;
            line-height: 1.6;
        }
        .setup-banner a { color: #e74c3c; font-weight: 600; }
        .card-stack {
            position: relative;
            width: 100%;
            max-width: 420px;
            height: 480px;
            margin-bottom: 30px;
        }
        .job-card {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            height: 100%;
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.12);
            padding: 28px;
            display: flex;
            flex-direction: column;
            cursor: grab;
            transition: transform 0.1s ease;
            user-select: none;
        }
        .job-card:active { cursor: grabbing; }
        .job-card.swiping-left { transform: rotate(-8deg) translateX(-30px); }
        .job-card.swiping-right { transform: rotate(8deg) translateX(30px); }
        .card-tag {
            display: inline-block;
            background: #fef0f0;
            color: #e74c3c;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .card-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 6px;
            line-height: 1.3;
        }
        .card-company {
            font-size: 1rem;
            color: #e74c3c;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .card-location {
            font-size: 0.88rem;
            color: #888;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .card-salary {
            font-size: 1rem;
            font-weight: 700;
            color: #27ae60;
            margin-bottom: 14px;
        }
        .card-desc {
            font-size: 0.86rem;
            color: #555;
            line-height: 1.6;
            flex: 1;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
        }
        .card-footer {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .card-date { font-size: 0.8rem; color: #aaa; }
        .card-apply {
            font-size: 0.82rem;
            color: #e74c3c;
            text-decoration: none;
            font-weight: 600;
        }
        .card-apply:hover { text-decoration: underline; }
        .card-placeholder {
            position: absolute;
            top: 8px; left: 8px;
            width: calc(100% - 16px);
            height: calc(100% - 16px);
            background: #f8f8f8;
            border-radius: 16px;
            z-index: -1;
            box-shadow: 0 4px 15px rgba(0,0,0,0.06);
        }
        .swipe-buttons {
            display: flex;
            gap: 24px;
            margin-bottom: 20px;
        }
        .btn-pass, .btn-like {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: 3px solid;
            font-size: 1.6rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s, box-shadow 0.15s;
            background: #fff;
        }
        .btn-pass { border-color: #e74c3c; color: #e74c3c; }
        .btn-like { border-color: #27ae60; color: #27ae60; }
        .btn-pass:hover, .btn-like:hover {
            transform: scale(1.12);
            box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        .stats {
            display: flex;
            gap: 24px;
            font-size: 0.85rem;
            color: #888;
            margin-top: 4px;
        }
        .stats span strong { color: #1a1a2e; }
        .liked-section {
            width: 100%;
            max-width: 420px;
            margin-top: 10px;
        }
        .liked-section h2 {
            font-size: 1.05rem;
            color: #333;
            margin-bottom: 12px;
            font-weight: 700;
        }
        .liked-list { display: flex; flex-direction: column; gap: 10px; }
        .liked-item {
            background: #fff;
            border-radius: 10px;
            padding: 14px 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .liked-item-info { flex: 1; }
        .liked-item-title { font-weight: 600; font-size: 0.9rem; color: #1a1a2e; }
        .liked-item-meta { font-size: 0.8rem; color: #888; margin-top: 2px; }
        .liked-item a {
            font-size: 0.82rem;
            color: #e74c3c;
            text-decoration: none;
            font-weight: 600;
            white-space: nowrap;
            margin-left: 12px;
        }
        .loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            color: #888;
            font-size: 0.9rem;
            padding: 40px;
        }
        .spinner {
            width: 36px; height: 36px;
            border: 3px solid #f0f0f0;
            border-top-color: #e74c3c;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #888;
        }
        .empty-state .emoji { font-size: 3rem; margin-bottom: 12px; }
        .like-overlay, .pass-overlay {
            position: absolute;
            top: 30px;
            font-size: 2rem;
            font-weight: 900;
            padding: 8px 18px;
            border-radius: 10px;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s;
            z-index: 10;
        }
        .like-overlay { right: 20px; color: #27ae60; border: 3px solid #27ae60; }
        .pass-overlay { left: 20px; color: #e74c3c; border: 3px solid #e74c3c; }
    </style>
</head>
<body>
    <header>
        <h1>Jobjo</h1>
        <span>🇬🇧 Live UK Jobs</span>
    </header>
    <div class="controls">
        <input id="searchWhat" type="text" placeholder="Job title or keywords..." />
        <input id="searchWhere" type="text" placeholder="Location (e.g. London)" />
        <button onclick="loadJobs()">Search</button>
    </div>
    <div class="main" id="main">
        ${!hasCredentials ? `<div class="setup-banner">
            ⚠️ <strong>API credentials needed</strong> to load live UK jobs.<br>
            Get your free key at <a href="https://developer.adzuna.com" target="_blank">developer.adzuna.com</a>,
            then add <code>ADZUNA_APP_ID</code> and <code>ADZUNA_APP_KEY</code> to your environment secrets.
        </div>` : ''}
        <div class="loader" id="loader">
            <div class="spinner"></div>
            Loading live UK jobs...
        </div>
        <div id="card-area" style="display:none; flex-direction:column; align-items:center; width:100%">
            <div class="card-stack" id="card-stack">
                <div class="card-placeholder"></div>
            </div>
            <div class="swipe-buttons">
                <button class="btn-pass" onclick="swipe('left')" title="Pass">✕</button>
                <button class="btn-like" onclick="swipe('right')" title="Like">♥</button>
            </div>
            <div class="stats">
                <span>👀 Seen: <strong id="stat-seen">0</strong></span>
                <span>♥ Liked: <strong id="stat-liked">0</strong></span>
                <span>✕ Passed: <strong id="stat-passed">0</strong></span>
            </div>
        </div>
        <div id="empty-area" style="display:none">
            <div class="empty-state">
                <div class="emoji">🎉</div>
                <p>You've seen all jobs in this batch!</p>
                <br>
                <button onclick="loadJobs()" style="padding:10px 24px; background:#e74c3c; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:0.9rem;">Load More</button>
            </div>
        </div>
        <div class="liked-section" id="liked-section" style="display:none">
            <h2>♥ Jobs you liked</h2>
            <div class="liked-list" id="liked-list"></div>
        </div>
    </div>

    <script>
        let jobs = [];
        let currentIndex = 0;
        let liked = [];
        let passed = 0;
        let page = 1;
        let isDragging = false;
        let startX = 0;

        async function loadJobs() {
            document.getElementById('loader').style.display = 'flex';
            document.getElementById('card-area').style.display = 'none';
            document.getElementById('empty-area').style.display = 'none';

            const what = document.getElementById('searchWhat').value;
            const where = document.getElementById('searchWhere').value;

            try {
                const params = new URLSearchParams({ what, where, page });
                const res = await fetch('/api/jobs/search?' + params);
                const data = await res.json();

                if (data.error) {
                    document.getElementById('loader').innerHTML = '<p style="color:#c0392b; text-align:center">' + data.error + '</p>';
                    return;
                }

                jobs = data.jobs || [];
                currentIndex = 0;
                page++;

                document.getElementById('loader').style.display = 'none';
                document.getElementById('card-area').style.display = 'flex';
                renderCard();
            } catch (e) {
                document.getElementById('loader').innerHTML = '<p style="color:#c0392b">Failed to load jobs. Please try again.</p>';
            }
        }

        function formatSalary(min, max) {
            if (!min && !max) return 'Salary not specified';
            const fmt = n => '£' + Math.round(n).toLocaleString('en-GB');
            if (min && max) return fmt(min) + ' – ' + fmt(max) + ' /yr';
            if (min) return fmt(min) + '+ /yr';
            if (max) return 'Up to ' + fmt(max) + ' /yr';
        }

        function formatDate(dateStr) {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        function renderCard() {
            const stack = document.getElementById('card-stack');
            stack.innerHTML = '<div class="card-placeholder"></div>';

            if (currentIndex >= jobs.length) {
                document.getElementById('card-area').style.display = 'none';
                document.getElementById('empty-area').style.display = 'block';
                updateLikedSection();
                return;
            }

            const job = jobs[currentIndex];
            const card = document.createElement('div');
            card.className = 'job-card';
            card.id = 'current-card';
            card.innerHTML = \`
                <span class="like-overlay" id="like-overlay">LIKE</span>
                <span class="pass-overlay" id="pass-overlay">PASS</span>
                \${job.category ? '<span class="card-tag">' + escHtml(job.category) + '</span>' : ''}
                <div class="card-title">\${escHtml(job.title)}</div>
                <div class="card-company">\${escHtml(job.company)}</div>
                <div class="card-location">📍 \${escHtml(job.location)}</div>
                <div class="card-salary">\${formatSalary(job.salary_min, job.salary_max)}</div>
                <div class="card-desc">\${escHtml(job.description || 'No description available.')}</div>
                <div class="card-footer">
                    <span class="card-date">\${formatDate(job.created)}</span>
                    <a class="card-apply" href="\${job.redirect_url}" target="_blank">Apply →</a>
                </div>
            \`;

            // Touch/mouse drag
            card.addEventListener('mousedown', dragStart);
            card.addEventListener('touchstart', dragStart, { passive: true });

            stack.appendChild(card);
            updateStats();
        }

        function escHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g,'&amp;')
                .replace(/</g,'&lt;')
                .replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;');
        }

        function dragStart(e) {
            isDragging = true;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchmove', dragMove, { passive: true });
            document.addEventListener('touchend', dragEnd);
        }

        function dragMove(e) {
            if (!isDragging) return;
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
            const card = document.getElementById('current-card');
            if (!card) return;
            card.style.transform = 'translateX(' + x + 'px) rotate(' + (x * 0.05) + 'deg)';
            const likeO = document.getElementById('like-overlay');
            const passO = document.getElementById('pass-overlay');
            if (x > 40) {
                likeO.style.opacity = Math.min((x - 40) / 60, 1);
                passO.style.opacity = 0;
            } else if (x < -40) {
                passO.style.opacity = Math.min((-x - 40) / 60, 1);
                likeO.style.opacity = 0;
            } else {
                likeO.style.opacity = 0;
                passO.style.opacity = 0;
            }
        }

        function dragEnd(e) {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('touchend', dragEnd);
            const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) - startX;
            if (x > 80) swipe('right');
            else if (x < -80) swipe('left');
            else {
                const card = document.getElementById('current-card');
                if (card) card.style.transform = '';
                const likeO = document.getElementById('like-overlay');
                const passO = document.getElementById('pass-overlay');
                if (likeO) likeO.style.opacity = 0;
                if (passO) passO.style.opacity = 0;
            }
        }

        function swipe(direction) {
            const card = document.getElementById('current-card');
            if (!card) return;
            const job = jobs[currentIndex];

            if (direction === 'right') {
                liked.push(job);
                card.style.transition = 'transform 0.3s ease';
                card.style.transform = 'translateX(600px) rotate(20deg)';
            } else {
                passed++;
                card.style.transition = 'transform 0.3s ease';
                card.style.transform = 'translateX(-600px) rotate(-20deg)';
            }

            currentIndex++;
            updateStats();
            setTimeout(renderCard, 280);
        }

        function updateStats() {
            document.getElementById('stat-seen').textContent = currentIndex;
            document.getElementById('stat-liked').textContent = liked.length;
            document.getElementById('stat-passed').textContent = passed;
        }

        function updateLikedSection() {
            const section = document.getElementById('liked-section');
            const list = document.getElementById('liked-list');
            if (liked.length === 0) { section.style.display = 'none'; return; }
            section.style.display = 'block';
            list.innerHTML = liked.map(j => \`
                <div class="liked-item">
                    <div class="liked-item-info">
                        <div class="liked-item-title">\${escHtml(j.title)}</div>
                        <div class="liked-item-meta">\${escHtml(j.company)} · \${escHtml(j.location)}</div>
                    </div>
                    <a href="\${j.redirect_url}" target="_blank">Apply →</a>
                </div>
            \`).join('');
        }

        // Auto-load on startup
        loadJobs();
    </script>
</body>
</html>`);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
