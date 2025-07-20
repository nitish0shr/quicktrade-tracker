const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Paths to data and client directories
const DATA_DIR = path.join(__dirname, 'data');
const CLIENT_DIR = path.join(__dirname, '../client');
const tradesFile = path.join(DATA_DIR, 'trades.json');
const userTradesFile = path.join(DATA_DIR, 'userTrades.json');

// Utility to load daily trade recommendations
function loadTrades() {
  const raw = fs.readFileSync(tradesFile, 'utf-8');
  return JSON.parse(raw);
}

// Load confirmed trades from file, if exists; otherwise return empty array
function loadUserTrades() {
  if (!fs.existsSync(userTradesFile)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(userTradesFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading user trades:', err);
    return [];
  }
}

// Persist confirmed trades to disk
function saveUserTrades(trades) {
  fs.writeFileSync(userTradesFile, JSON.stringify(trades, null, 2));
}

// Compute weekly summary for the current week (Sun-Sat)
function computeWeeklySummary() {
  const trades = loadUserTrades();
  if (!trades.length) {
    return {
      totalTaken: 0,
      wins: 0,
      losses: 0,
      neutral: 0,
      winRate: 0,
      skippedHitTarget: 0
    };
  }
  const now = new Date();
  const startOfWeek = new Date(now);
  // set to most recent Sunday (assuming Sunday start); adjust to local timezone
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  let totalTaken = 0;
  let wins = 0;
  let losses = 0;
  let neutral = 0;
  // trades skipped and hit target: simple heuristic: difference between recommended trades and taken trades
  const totalRecommendations = loadTrades().length;
  trades.forEach(trade => {
    const confirmedAt = new Date(trade.confirmed_at);
    if (confirmedAt >= startOfWeek && confirmedAt < endOfWeek) {
      totalTaken++;
      if (trade.status === 'closed') {
        if (trade.outcome === 'win') wins++;
        else if (trade.outcome === 'loss') losses++;
        else neutral++;
      }
    }
  });
  const skippedHitTarget = Math.max(totalRecommendations - totalTaken, 0);
  const winRate = totalTaken ? Math.round((wins / totalTaken) * 100) : 0;
  return { totalTaken, wins, losses, neutral, winRate, skippedHitTarget };
}

// Determine content type based on file extension
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.js': return 'text/javascript';
    case '.css': return 'text/css';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

// Serve static files from client directory
function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // prevent directory traversal
  filePath = filePath.split('?')[0];
  const resolvedPath = path.join(CLIENT_DIR, filePath);
  if (resolvedPath.indexOf(CLIENT_DIR) !== 0) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(resolvedPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const contentType = getContentType(resolvedPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const method = req.method;
  // Handle CORS preflight and set headers
  const setCorsHeaders = () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };
  if (method === 'OPTIONS') {
    setCorsHeaders();
    res.writeHead(204);
    return res.end();
  }

  // API endpoints
  if (parsed.pathname === '/api/trades' && method === 'GET') {
    setCorsHeaders();
    const trades = loadTrades();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(trades));
  }

  // Confirm a trade by ID: POST /api/trades/:id/confirm
  if (method === 'POST' && /^\/api\/trades\/\d+\/confirm$/.test(parsed.pathname)) {
    setCorsHeaders();
    const parts = parsed.pathname.split('/');
    const id = parseInt(parts[3]);
    const trades = loadTrades();
    const selected = trades.find(t => t.id === id);
    if (!selected) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Trade not found' }));
    }
    let userTrades = loadUserTrades();
    if (userTrades.find(t => t.id === id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Trade already confirmed' }));
    }
    const newTrade = Object.assign({}, selected, {
      confirmed_at: new Date().toISOString(),
      status: 'open',
      outcome: 'pending',
      notes: ''
    });
    userTrades.push(newTrade);
    saveUserTrades(userTrades);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(newTrade));
  }

  // Return list of confirmed trades: GET /api/user-trades
  if (parsed.pathname === '/api/user-trades' && method === 'GET') {
    setCorsHeaders();
    const userTrades = loadUserTrades();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(userTrades));
  }

  // Close a trade: POST /api/user-trades/:id/close with JSON body { outcome: 'win'|'loss'|'neutral', notes?: string }
  if (method === 'POST' && /^\/api\/user-trades\/\d+\/close$/.test(parsed.pathname)) {
    setCorsHeaders();
    const parts = parsed.pathname.split('/');
    const id = parseInt(parts[3]);
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const { outcome = 'neutral', notes = '' } = payload;
        let userTrades = loadUserTrades();
        const index = userTrades.findIndex(t => t.id === id);
        if (index === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Trade not found' }));
        }
        userTrades[index].status = 'closed';
        userTrades[index].outcome = outcome;
        userTrades[index].notes = notes;
        userTrades[index].closed_at = new Date().toISOString();
        saveUserTrades(userTrades);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(userTrades[index]));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Weekly summary: GET /api/summary
  if (parsed.pathname === '/api/summary' && method === 'GET') {
    setCorsHeaders();
    const summary = computeWeeklySummary();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(summary));
  }

  // Serve static content from client directory
  serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
