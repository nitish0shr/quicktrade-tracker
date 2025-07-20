const http = require('http');
const https = require('https');
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

// Fetch real-time prices for a list of symbols from Yahoo Finance
// Returns a promise that resolves to an object mapping each symbol to its current price.
function fetchLivePrices(symbols) {
  return new Promise((resolve, reject) => {
    if (!symbols || symbols.length === 0) {
      return resolve({});
    }
    const apiUrl =
      'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' +
      symbols.join(',');
    https
      .get(apiUrl, resp => {
        let data = '';
        resp.on('data', chunk => (data += chunk.toString()));
        resp.on('end', () => {
          try {
            const json = JSON.parse(data);
            const result = {};
            if (json.quoteResponse && json.quoteResponse.result) {
              json.quoteResponse.result.forEach(item => {
                if (
                  item.symbol &&
                  typeof item.regularMarketPrice === 'number'
                ) {
                  result[item.symbol] = item.regularMarketPrice;
                }
              });
            }
            resolve(result);
          } catch (err) {
            // On parse error, resolve with empty map
            resolve({});
          }
        });
      })
      .on('error', err => {
        // On network error, resolve with empty map
        resolve({});
      });
  });
}

// Combine daily trade recommendations with live prices. For each trade, the current
// market price replaces the entry price and adjusts stop/target based on the
// difference defined in the static data. If no live price is available, the
// original entry/stop/target values are returned.
async function getLiveTrades() {
  const trades = loadTrades();
  const symbols = trades.map(t => t.symbol);
  const priceMap = await fetchLivePrices(symbols);
  return trades.map(trade => {
    const live = priceMap[trade.symbol];
    if (live && !isNaN(live)) {
      const entry = Number(trade.entry);
      const stop = Number(trade.stop);
      const target = Number(trade.target);
      const stopDiff = entry - stop;
      const targetDiff = target - entry;
      const liveEntry = live;
      const liveStop = live - stopDiff;
      const liveTarget = live + targetDiff;
      return Object.assign({}, trade, {
        currentPrice: live.toFixed(2),
        entry: liveEntry.toFixed(2),
        stop: liveStop.toFixed(2),
        target: liveTarget.toFixed(2)
      });
    }
    return trade;
  });
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
  // Return daily trade recommendations with live pricing
  if (parsed.pathname === '/api/trades' && method === 'GET') {
    setCorsHeaders();
    // Fetch live trades asynchronously; respond once resolved
    getLiveTrades()
      .then(trades => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(trades));
      })
      .catch(() => {
        // On error, fall back to static trades
        const trades = loadTrades();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(trades));
      });
    return;
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
