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
            error: 'Adzuna API credentials not configured.'
        });
    }

    try {
        const params = {
            app_id: ADZUNA_APP_ID,
            app_key: ADZUNA_APP_KEY,
            results_per_page: 20,
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

// Interactive HTML Frontend
app.get('/', (req, res) => {
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
            padding: 14px 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        header h1 { font-size: 1.5rem; color: #e74c3c; font-weight: 800; letter-spacing: -0.5px; }
        header span { color: #666; font-size: 0.88rem; }
        .controls {
            background: #fff;
            padding: 12px 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            border-bottom: 1px solid #eee;
            align-items: flex-end;
        }
        .ctrl-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            flex: 1;
            min-width: 130px;
        }
        .ctrl-group label {
            font-size: 0.72rem;
            font-weight: 700;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .controls input, .controls select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 0.88rem;
            outline: none;
            background: #fafafa;
            width: 100%;
        }
        .controls select:focus, .controls input:focus { border-color: #e74c3c; background: #fff; }
        .controls select:disabled { opacity: 0.5; cursor: not-allowed; }
        .ctrl-btn {
            padding: 8px 22px;
            background: #e74c3c;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 700;
            cursor: pointer;
            align-self: flex-end;
            white-space: nowrap;
            height: 36px;
        }
        .ctrl-btn:hover { background: #c0392b; }
        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 28px 20px;
        }
        .location-badge {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            padding: 5px 14px;
            font-size: 0.82rem;
            color: #555;
            margin-bottom: 18px;
            display: none;
        }
        .location-badge strong { color: #e74c3c; }
        .card-stack {
            position: relative;
            width: 100%;
            max-width: 420px;
            height: 490px;
            margin-bottom: 28px;
        }
        .job-card {
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            height: 100%;
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.11);
            padding: 26px;
            display: flex;
            flex-direction: column;
            cursor: grab;
            user-select: none;
            touch-action: none;
        }
        .job-card:active { cursor: grabbing; }
        .card-tag {
            display: inline-block;
            background: #fef0f0;
            color: #e74c3c;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 0.72rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .card-title {
            font-size: 1.22rem;
            font-weight: 800;
            color: #1a1a2e;
            margin-bottom: 5px;
            line-height: 1.3;
        }
        .card-company {
            font-size: 0.95rem;
            color: #e74c3c;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .card-location {
            font-size: 0.83rem;
            color: #999;
            margin-bottom: 12px;
        }
        .card-salary {
            font-size: 0.98rem;
            font-weight: 700;
            color: #27ae60;
            margin-bottom: 12px;
        }
        .card-desc {
            font-size: 0.84rem;
            color: #555;
            line-height: 1.6;
            flex: 1;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 7;
            -webkit-box-orient: vertical;
        }
        .card-footer {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .card-date { font-size: 0.78rem; color: #bbb; }
        .card-apply {
            font-size: 0.82rem;
            color: #e74c3c;
            text-decoration: none;
            font-weight: 700;
        }
        .card-apply:hover { text-decoration: underline; }
        .card-placeholder {
            position: absolute;
            top: 8px; left: 8px;
            width: calc(100% - 16px);
            height: calc(100% - 16px);
            background: #f5f5f5;
            border-radius: 15px;
            z-index: -1;
        }
        .like-overlay, .pass-overlay {
            position: absolute;
            top: 28px;
            font-size: 1.6rem;
            font-weight: 900;
            padding: 6px 16px;
            border-radius: 8px;
            opacity: 0;
            pointer-events: none;
            z-index: 10;
        }
        .like-overlay { right: 18px; color: #27ae60; border: 3px solid #27ae60; }
        .pass-overlay { left: 18px; color: #e74c3c; border: 3px solid #e74c3c; }
        .swipe-buttons {
            display: flex;
            gap: 28px;
            margin-bottom: 18px;
        }
        .btn-pass, .btn-like {
            width: 62px; height: 62px;
            border-radius: 50%;
            border: 3px solid;
            font-size: 1.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-pass { border-color: #e74c3c; color: #e74c3c; }
        .btn-like { border-color: #27ae60; color: #27ae60; }
        .btn-pass:hover, .btn-like:hover { transform: scale(1.1); box-shadow: 0 6px 18px rgba(0,0,0,0.1); }
        .stats {
            display: flex;
            gap: 22px;
            font-size: 0.83rem;
            color: #999;
        }
        .stats span strong { color: #333; }
        .loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            color: #999;
            font-size: 0.88rem;
            padding: 50px;
        }
        .spinner {
            width: 34px; height: 34px;
            border: 3px solid #eee;
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
        .empty-state .emoji { font-size: 2.8rem; margin-bottom: 10px; }
        .empty-btn {
            margin-top: 16px;
            padding: 10px 24px;
            background: #e74c3c;
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.88rem;
            font-weight: 700;
        }
        .liked-section { width: 100%; max-width: 420px; margin-top: 16px; }
        .liked-section h2 { font-size: 1rem; color: #333; margin-bottom: 10px; font-weight: 700; }
        .liked-list { display: flex; flex-direction: column; gap: 8px; }
        .liked-item {
            background: #fff;
            border-radius: 10px;
            padding: 12px 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .liked-item-info { flex: 1; }
        .liked-item-title { font-weight: 700; font-size: 0.88rem; color: #1a1a2e; }
        .liked-item-meta { font-size: 0.78rem; color: #999; margin-top: 2px; }
        .liked-item a { font-size: 0.8rem; color: #e74c3c; text-decoration: none; font-weight: 700; margin-left: 12px; white-space: nowrap; }
    </style>
</head>
<body>
    <header>
        <h1>Jobjo</h1>
        <span id="job-count-badge">🇬🇧 Live UK Jobs</span>
    </header>

    <div class="controls">
        <div class="ctrl-group">
            <label>Keywords</label>
            <input id="searchWhat" type="text" placeholder="Job title or skills..." />
        </div>
        <div class="ctrl-group">
            <label>Nation</label>
            <select id="nationSelect" onchange="onNationChange()">
                <option value="">— All UK —</option>
                <option value="england">🏴󠁧󠁢󠁥󠁮󠁧󠁿 England</option>
                <option value="scotland">🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scotland</option>
                <option value="wales">🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales</option>
                <option value="northern_ireland">Northern Ireland</option>
            </select>
        </div>
        <div class="ctrl-group">
            <label>Council / Area</label>
            <select id="councilSelect" disabled onchange="onCouncilChange()">
                <option value="">— Select nation first —</option>
            </select>
        </div>
        <button class="ctrl-btn" onclick="loadJobs()">Search</button>
    </div>

    <div class="main" id="main">
        <div class="location-badge" id="location-badge"></div>
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
                <span>👀 <strong id="stat-seen">0</strong> seen</span>
                <span>♥ <strong id="stat-liked">0</strong> liked</span>
                <span>✕ <strong id="stat-passed">0</strong> passed</span>
            </div>
        </div>
        <div id="empty-area" style="display:none">
            <div class="empty-state">
                <div class="emoji">🎉</div>
                <p>You've seen all jobs in this batch!</p>
                <button class="empty-btn" onclick="loadNextPage()">Load More Jobs</button>
            </div>
        </div>
        <div class="liked-section" id="liked-section" style="display:none">
            <h2>♥ Jobs you liked</h2>
            <div class="liked-list" id="liked-list"></div>
        </div>
    </div>

    <script>
    // ── UK Council Data ──────────────────────────────────────────────────────
    const COUNCILS = {
        england: [
            // North East
            { label: 'County Durham', where: 'Durham' },
            { label: 'Gateshead', where: 'Gateshead' },
            { label: 'Newcastle upon Tyne', where: 'Newcastle upon Tyne' },
            { label: 'North Tyneside', where: 'North Tyneside' },
            { label: 'Northumberland', where: 'Northumberland' },
            { label: 'South Tyneside', where: 'South Tyneside' },
            { label: 'Sunderland', where: 'Sunderland' },
            { label: 'Darlington', where: 'Darlington' },
            { label: 'Hartlepool', where: 'Hartlepool' },
            { label: 'Middlesbrough', where: 'Middlesbrough' },
            { label: 'Redcar and Cleveland', where: 'Redcar' },
            { label: 'Stockton-on-Tees', where: 'Stockton-on-Tees' },
            // North West
            { label: 'Bolton', where: 'Bolton' },
            { label: 'Bury', where: 'Bury' },
            { label: 'Cheshire East', where: 'Crewe' },
            { label: 'Cheshire West and Chester', where: 'Chester' },
            { label: 'Cumbria / Westmorland', where: 'Kendal' },
            { label: 'Cumberland', where: 'Carlisle' },
            { label: 'Halton', where: 'Runcorn' },
            { label: 'Knowsley', where: 'Knowsley' },
            { label: 'Lancashire', where: 'Preston' },
            { label: 'Liverpool', where: 'Liverpool' },
            { label: 'Manchester', where: 'Manchester' },
            { label: 'Oldham', where: 'Oldham' },
            { label: 'Rochdale', where: 'Rochdale' },
            { label: 'Salford', where: 'Salford' },
            { label: 'Sefton', where: 'Southport' },
            { label: 'St Helens', where: 'St Helens' },
            { label: 'Stockport', where: 'Stockport' },
            { label: 'Tameside', where: 'Ashton-under-Lyne' },
            { label: 'Trafford', where: 'Trafford' },
            { label: 'Warrington', where: 'Warrington' },
            { label: 'Wigan', where: 'Wigan' },
            { label: 'Wirral', where: 'Wirral' },
            // Yorkshire and Humber
            { label: 'Barnsley', where: 'Barnsley' },
            { label: 'Bradford', where: 'Bradford' },
            { label: 'Calderdale', where: 'Halifax' },
            { label: 'Doncaster', where: 'Doncaster' },
            { label: 'East Riding of Yorkshire', where: 'Beverley' },
            { label: 'Hull (Kingston upon Hull)', where: 'Hull' },
            { label: 'Kirklees', where: 'Huddersfield' },
            { label: 'Leeds', where: 'Leeds' },
            { label: 'North Yorkshire', where: 'Northallerton' },
            { label: 'Rotherham', where: 'Rotherham' },
            { label: 'Sheffield', where: 'Sheffield' },
            { label: 'Wakefield', where: 'Wakefield' },
            { label: 'York', where: 'York' },
            // East Midlands
            { label: 'Derby', where: 'Derby' },
            { label: 'Derbyshire', where: 'Chesterfield' },
            { label: 'Leicester', where: 'Leicester' },
            { label: 'Leicestershire', where: 'Loughborough' },
            { label: 'Lincoln', where: 'Lincoln' },
            { label: 'Lincolnshire', where: 'Lincolnshire' },
            { label: 'Northamptonshire', where: 'Northampton' },
            { label: 'Nottingham', where: 'Nottingham' },
            { label: 'Nottinghamshire', where: 'Mansfield' },
            { label: 'Rutland', where: 'Oakham' },
            // West Midlands
            { label: 'Birmingham', where: 'Birmingham' },
            { label: 'Coventry', where: 'Coventry' },
            { label: 'Dudley', where: 'Dudley' },
            { label: 'Herefordshire', where: 'Hereford' },
            { label: 'Sandwell', where: 'West Bromwich' },
            { label: 'Shropshire', where: 'Shrewsbury' },
            { label: 'Solihull', where: 'Solihull' },
            { label: 'Staffordshire', where: 'Stafford' },
            { label: 'Stoke-on-Trent', where: 'Stoke-on-Trent' },
            { label: 'Telford and Wrekin', where: 'Telford' },
            { label: 'Walsall', where: 'Walsall' },
            { label: 'Warwickshire', where: 'Warwick' },
            { label: 'Wolverhampton', where: 'Wolverhampton' },
            { label: 'Worcestershire', where: 'Worcester' },
            // East of England
            { label: 'Bedford', where: 'Bedford' },
            { label: 'Cambridgeshire', where: 'Cambridge' },
            { label: 'Central Bedfordshire', where: 'Luton' },
            { label: 'Essex', where: 'Chelmsford' },
            { label: 'Hertfordshire', where: 'Hertford' },
            { label: 'Norfolk', where: 'Norwich' },
            { label: 'Peterborough', where: 'Peterborough' },
            { label: 'Suffolk', where: 'Ipswich' },
            // London
            { label: 'Barking and Dagenham', where: 'Barking' },
            { label: 'Barnet', where: 'Barnet' },
            { label: 'Bexley', where: 'Bexley' },
            { label: 'Brent', where: 'Brent' },
            { label: 'Bromley', where: 'Bromley' },
            { label: 'Camden', where: 'Camden' },
            { label: 'City of London', where: 'City of London' },
            { label: 'Croydon', where: 'Croydon' },
            { label: 'Ealing', where: 'Ealing' },
            { label: 'Enfield', where: 'Enfield' },
            { label: 'Greenwich', where: 'Greenwich' },
            { label: 'Hackney', where: 'Hackney' },
            { label: 'Hammersmith and Fulham', where: 'Hammersmith' },
            { label: 'Haringey', where: 'Haringey' },
            { label: 'Harrow', where: 'Harrow' },
            { label: 'Havering', where: 'Romford' },
            { label: 'Hillingdon', where: 'Uxbridge' },
            { label: 'Hounslow', where: 'Hounslow' },
            { label: 'Islington', where: 'Islington' },
            { label: 'Kensington and Chelsea', where: 'Kensington' },
            { label: 'Kingston upon Thames', where: 'Kingston upon Thames' },
            { label: 'Lambeth', where: 'Lambeth' },
            { label: 'Lewisham', where: 'Lewisham' },
            { label: 'Merton', where: 'Wimbledon' },
            { label: 'Newham', where: 'Newham' },
            { label: 'Redbridge', where: 'Ilford' },
            { label: 'Richmond upon Thames', where: 'Richmond' },
            { label: 'Southwark', where: 'Southwark' },
            { label: 'Sutton', where: 'Sutton' },
            { label: 'Tower Hamlets', where: 'Tower Hamlets' },
            { label: 'Waltham Forest', where: 'Walthamstow' },
            { label: 'Wandsworth', where: 'Wandsworth' },
            { label: 'Westminster', where: 'Westminster' },
            // South East
            { label: 'Bracknell Forest', where: 'Bracknell' },
            { label: 'Brighton and Hove', where: 'Brighton' },
            { label: 'Buckinghamshire', where: 'High Wycombe' },
            { label: 'East Sussex', where: 'Eastbourne' },
            { label: 'Hampshire', where: 'Winchester' },
            { label: 'Isle of Wight', where: 'Newport Isle of Wight' },
            { label: 'Kent', where: 'Maidstone' },
            { label: 'Medway', where: 'Medway' },
            { label: 'Milton Keynes', where: 'Milton Keynes' },
            { label: 'Oxfordshire', where: 'Oxford' },
            { label: 'Portsmouth', where: 'Portsmouth' },
            { label: 'Reading', where: 'Reading' },
            { label: 'Slough', where: 'Slough' },
            { label: 'Southampton', where: 'Southampton' },
            { label: 'Surrey', where: 'Guildford' },
            { label: 'West Berkshire', where: 'Newbury' },
            { label: 'West Sussex', where: 'Chichester' },
            { label: 'Windsor and Maidenhead', where: 'Windsor' },
            { label: 'Wokingham', where: 'Wokingham' },
            // South West
            { label: 'Bath and North East Somerset', where: 'Bath' },
            { label: 'Bournemouth, Christchurch and Poole', where: 'Bournemouth' },
            { label: 'Bristol', where: 'Bristol' },
            { label: 'Cornwall', where: 'Truro' },
            { label: 'Devon', where: 'Exeter' },
            { label: 'Dorset', where: 'Dorchester' },
            { label: 'Gloucestershire', where: 'Gloucester' },
            { label: 'North Somerset', where: 'Weston-super-Mare' },
            { label: 'Plymouth', where: 'Plymouth' },
            { label: 'Somerset', where: 'Taunton' },
            { label: 'South Gloucestershire', where: 'South Gloucestershire' },
            { label: 'Swindon', where: 'Swindon' },
            { label: 'Torbay', where: 'Torquay' },
            { label: 'Wiltshire', where: 'Salisbury' },
        ],
        scotland: [
            { label: 'Aberdeen City', where: 'Aberdeen' },
            { label: 'Aberdeenshire', where: 'Aberdeenshire' },
            { label: 'Angus', where: 'Forfar' },
            { label: 'Argyll and Bute', where: 'Lochgilphead' },
            { label: 'Clackmannanshire', where: 'Alloa' },
            { label: 'Dumfries and Galloway', where: 'Dumfries' },
            { label: 'Dundee City', where: 'Dundee' },
            { label: 'East Ayrshire', where: 'Kilmarnock' },
            { label: 'East Dunbartonshire', where: 'Kirkintilloch' },
            { label: 'East Lothian', where: 'Haddington' },
            { label: 'East Renfrewshire', where: 'Giffnock' },
            { label: 'Edinburgh City', where: 'Edinburgh' },
            { label: 'Falkirk', where: 'Falkirk' },
            { label: 'Fife', where: 'Dunfermline' },
            { label: 'Glasgow City', where: 'Glasgow' },
            { label: 'Highland', where: 'Inverness' },
            { label: 'Inverclyde', where: 'Greenock' },
            { label: 'Midlothian', where: 'Dalkeith' },
            { label: 'Moray', where: 'Elgin' },
            { label: 'Na h-Eileanan Siar (Western Isles)', where: 'Stornoway' },
            { label: 'North Ayrshire', where: 'Irvine' },
            { label: 'North Lanarkshire', where: 'Motherwell' },
            { label: 'Orkney Islands', where: 'Kirkwall' },
            { label: 'Perth and Kinross', where: 'Perth' },
            { label: 'Renfrewshire', where: 'Paisley' },
            { label: 'Scottish Borders', where: 'Newtown St Boswells' },
            { label: 'Shetland Islands', where: 'Lerwick' },
            { label: 'South Ayrshire', where: 'Ayr' },
            { label: 'South Lanarkshire', where: 'Hamilton' },
            { label: 'Stirling', where: 'Stirling' },
            { label: 'West Dunbartonshire', where: 'Dumbarton' },
            { label: 'West Lothian', where: 'Livingston' },
        ],
        wales: [
            { label: 'Blaenau Gwent', where: 'Blaenau Gwent' },
            { label: 'Bridgend', where: 'Bridgend' },
            { label: 'Caerphilly', where: 'Caerphilly' },
            { label: 'Cardiff', where: 'Cardiff' },
            { label: 'Carmarthenshire', where: 'Carmarthen' },
            { label: 'Ceredigion', where: 'Aberystwyth' },
            { label: 'Conwy', where: 'Conwy' },
            { label: 'Denbighshire', where: 'Ruthin' },
            { label: 'Flintshire', where: 'Mold' },
            { label: 'Gwynedd', where: 'Caernarfon' },
            { label: 'Isle of Anglesey', where: 'Llangefni' },
            { label: 'Merthyr Tydfil', where: 'Merthyr Tydfil' },
            { label: 'Monmouthshire', where: 'Monmouth' },
            { label: 'Neath Port Talbot', where: 'Port Talbot' },
            { label: 'Newport', where: 'Newport' },
            { label: 'Pembrokeshire', where: 'Haverfordwest' },
            { label: 'Powys', where: 'Welshpool' },
            { label: 'Rhondda Cynon Taf', where: 'Pontypridd' },
            { label: 'Swansea', where: 'Swansea' },
            { label: 'Torfaen', where: 'Pontypool' },
            { label: 'Vale of Glamorgan', where: 'Barry' },
            { label: 'Wrexham', where: 'Wrexham' },
        ],
        northern_ireland: [
            { label: 'Antrim and Newtownabbey', where: 'Antrim' },
            { label: 'Ards and North Down', where: 'Newtownards' },
            { label: 'Armagh City, Banbridge and Craigavon', where: 'Armagh' },
            { label: 'Belfast', where: 'Belfast' },
            { label: 'Causeway Coast and Glens', where: 'Coleraine' },
            { label: 'Derry City and Strabane', where: 'Derry' },
            { label: 'Fermanagh and Omagh', where: 'Enniskillen' },
            { label: 'Lisburn and Castlereagh', where: 'Lisburn' },
            { label: 'Mid and East Antrim', where: 'Ballymena' },
            { label: 'Mid Ulster', where: 'Cookstown' },
            { label: 'Newry, Mourne and Down', where: 'Newry' },
        ],
    };

    // ── State ────────────────────────────────────────────────────────────────
    let jobs = [];
    let currentIndex = 0;
    let liked = [];
    let passed = 0;
    let currentPage = 1;
    let isDragging = false;
    let startX = 0;
    let currentWhere = '';

    // ── Dropdown logic ───────────────────────────────────────────────────────
    function onNationChange() {
        const nation = document.getElementById('nationSelect').value;
        const councilSel = document.getElementById('councilSelect');
        councilSel.innerHTML = '';

        if (!nation) {
            councilSel.innerHTML = '<option value="">— Select nation first —</option>';
            councilSel.disabled = true;
            currentWhere = '';
            return;
        }

        const all = document.createElement('option');
        all.value = '';
        all.textContent = '— All ' + getNationLabel(nation) + ' —';
        councilSel.appendChild(all);

        (COUNCILS[nation] || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.where;
            opt.textContent = c.label;
            councilSel.appendChild(opt);
        });

        councilSel.disabled = false;
        currentWhere = '';
        updateBadge(nation, '');
    }

    function onCouncilChange() {
        const nation = document.getElementById('nationSelect').value;
        currentWhere = document.getElementById('councilSelect').value;
        updateBadge(nation, currentWhere);
    }

    function getNationLabel(n) {
        return { england: 'England', scotland: 'Scotland', wales: 'Wales', northern_ireland: 'Northern Ireland' }[n] || 'UK';
    }

    function updateBadge(nation, where) {
        const badge = document.getElementById('location-badge');
        if (!nation) { badge.style.display = 'none'; return; }
        const councilLabel = where
            ? (COUNCILS[nation] || []).find(c => c.where === where)?.label || where
            : getNationLabel(nation);
        badge.innerHTML = 'Showing jobs in <strong>' + escHtml(councilLabel) + '</strong>';
        badge.style.display = 'inline-block';
    }

    // ── Job loading ──────────────────────────────────────────────────────────
    async function loadJobs() {
        currentPage = 1;
        liked = [];
        passed = 0;
        jobs = [];
        currentIndex = 0;
        document.getElementById('liked-section').style.display = 'none';
        await fetchPage();
    }

    async function loadNextPage() {
        currentPage++;
        await fetchPage();
    }

    async function fetchPage() {
        document.getElementById('loader').style.display = 'flex';
        document.getElementById('card-area').style.display = 'none';
        document.getElementById('empty-area').style.display = 'none';

        const what = document.getElementById('searchWhat').value;
        const where = currentWhere || (document.getElementById('nationSelect').value
            ? getNationLabel(document.getElementById('nationSelect').value)
            : '');

        try {
            const params = new URLSearchParams({ what, where, page: currentPage });
            const res = await fetch('/api/jobs/search?' + params);
            const data = await res.json();

            if (data.error) {
                document.getElementById('loader').innerHTML =
                    '<p style="color:#c0392b;text-align:center">' + escHtml(data.error) + '</p>';
                return;
            }

            jobs = data.jobs || [];
            currentIndex = 0;

            const badge = document.getElementById('job-count-badge');
            if (data.total) badge.textContent = '🇬🇧 ' + Number(data.total).toLocaleString('en-GB') + ' live jobs';

            document.getElementById('loader').style.display = 'none';
            document.getElementById('card-area').style.display = 'flex';
            renderCard();
        } catch (e) {
            document.getElementById('loader').innerHTML =
                '<p style="color:#c0392b">Failed to load jobs. Please try again.</p>';
        }
    }

    // ── Card rendering ───────────────────────────────────────────────────────
    function formatSalary(min, max) {
        if (!min && !max) return 'Salary not specified';
        const fmt = n => '£' + Math.round(n).toLocaleString('en-GB');
        if (min && max && min !== max) return fmt(min) + ' – ' + fmt(max) + ' /yr';
        if (min) return fmt(min) + ' /yr';
        if (max) return fmt(max) + ' /yr';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
                <a class="card-apply" href="\${job.redirect_url}" target="_blank" rel="noopener">Apply →</a>
            </div>
        \`;

        card.addEventListener('mousedown', dragStart);
        card.addEventListener('touchstart', dragStart, { passive: true });
        stack.appendChild(card);
        updateStats();
    }

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Drag / swipe ─────────────────────────────────────────────────────────
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
        card.style.transition = 'transform 0.28s ease';
        if (direction === 'right') {
            liked.push(job);
            card.style.transform = 'translateX(600px) rotate(20deg)';
        } else {
            passed++;
            card.style.transform = 'translateX(-600px) rotate(-20deg)';
        }
        currentIndex++;
        updateStats();
        setTimeout(renderCard, 260);
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
                <a href="\${j.redirect_url}" target="_blank" rel="noopener">Apply →</a>
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
