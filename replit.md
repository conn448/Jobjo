# Jobjo

A Node.js/Express job swiping and matching application.

## Architecture

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Entry point**: `app.js`
- **Port**: 5000 (bound to 0.0.0.0)

## Key Files

- `app.js` - Main application server with routes and HTML frontend
- `package.json` - Project dependencies and scripts
- `.env` - Environment variables (PORT, MONGODB_URI, JWT_SECRET, RAPIDAPI_KEY)

## Features

- `GET /` - Interactive HTML job swiping frontend
- `GET /api/jobs/search` - Public job search endpoint
- `POST /api/jobs/match` - Skill-based job matching endpoint

## Dependencies

- express, mongoose, jsonwebtoken, axios, cors, helmet, express-rate-limit, multer, dotenv

## Running

```bash
npm run dev
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token signing
- `RAPIDAPI_KEY` - RapidAPI key for external job data
- `NODE_ENV` - Environment (development/production)
