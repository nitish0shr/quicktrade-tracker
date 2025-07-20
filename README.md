# QuickTrade Tracker

QuickTrade Tracker is a minimal full‑stack web application designed for active options traders. It allows you to view daily trade recommendations, confirm which trades you’re taking, track their status, and review a weekly summary of your performance. The project is built with a lightweight custom Node.js server and a simple vanilla JavaScript frontend for ease of setup in constrained environments.

> **Note**: This repository demonstrates the core functionality without external package dependencies. It uses the Node.js built‑in `http` module and stores data in JSON files. You can extend or replace these components (e.g. swap the storage layer to PostgreSQL or integrate Express) when network access allows installing additional packages.

## Features

- **Daily Trade Feed** – Displays 10 dummy trade ideas per day with key details (symbol, strategy, strike, premiums, expiry, entry/stop/target levels and confidence rating). Each card has a **“I’m Taking This”** button.

- **Confirm Trades** – When you confirm a trade, it’s recorded with a timestamp and stored in `server/data/userTrades.json`.

- **Dashboard** – View all confirmed trades with columns for symbol, strategy, strike, entry time, status (open/closed), outcome (win/loss/neutral), target, stop loss and optional notes. Close trades directly from the dashboard and set an outcome/notes.

- **Weekly Summary** – Automatically compiles statistics for the current week (Sunday–Saturday): number of trades taken, wins, losses, neutral outcomes, win rate and the number of recommendations skipped.

## Folder Structure

```
quicktrade-tracker/
├── server/
│   ├── index.js         # Node.js server (no external dependencies)
│   └── data/
│       ├── trades.json  # Dummy daily trade ideas (10 sample trades)
│       └── userTrades.json # Stores user‑confirmed trades
├── client/
│   ├── index.html       # Frontend UI
│   ├── styles.css       # Basic styling (inspired by Tailwind)
│   └── script.js        # Client‑side logic (fetches API, updates DOM)
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** (v14 or higher) installed on your machine.

> If you wish to use a real database (e.g. PostgreSQL or SQLite) or a framework such as Express/React, you can replace the current server and client implementations accordingly. The current setup avoids external dependencies to make local development simple when package installation is restricted.

### Running Locally

1. **Clone the repository** and change into its directory:

   ```bash
   git clone <repo-url>
   cd quicktrade-tracker
   ```

2. **Start the server** (runs on port `3000` by default):

   ```bash
   cd server
   node index.js
   ```

   The server serves both the API and the static frontend files.

3. **Open the application** in your browser:

   Navigate to [http://localhost:3000](http://localhost:3000) to see the Daily Feed. Use the navigation buttons at the top to switch between the feed, your dashboard, and the weekly summary.

4. **Confirm trades** by clicking **“✅ I’m Taking This”**. They will appear on your Dashboard and be saved to `data/userTrades.json`.

5. **Close trades** from the Dashboard. You can set the outcome (`win`, `loss` or `neutral`) and add optional notes. This updates the stored data.

6. **View your weekly performance** on the Summary page. Statistics reset every Sunday.

### Deployment

Because this project uses only Node.js built‑ins and serves static files, deployment is straightforward. Any Node.js‑compatible platform (Heroku, Render, Vercel functions, etc.) can host the backend. To deploy:

1. Ensure the `PORT` environment variable is set if required by your host.
2. Copy the contents of the `server` and `client` folders to your server environment.
3. Run `node server/index.js` as the start command.

If you later introduce a real database, set up the appropriate connection strings and update the CRUD functions in `server/index.js`.

## Extending the App

- **Use Express** – Install Express (`npm install express`) and replace the custom HTTP server with proper routing. Express makes it easier to handle middleware (body‑parsers, logging, authentication) and route structures.
- **Connect a Database** – Replace the JSON file storage with PostgreSQL or SQLite by integrating `pg` or `better-sqlite3`. Update the CRUD operations accordingly.
- **React Frontend** – Swap the vanilla JS frontend with React and Tailwind CSS. This involves running `create-react-app`, moving the current API calls into React components and deploying the built static files.
- **Real‑time Alerts** (Phase 2) – Add a webhook endpoint (e.g. `/api/webhook`) to receive TradingView alerts and push notifications to the browser using WebSockets or Server‑Sent Events.

## License

This project is provided under the MIT License. Feel free to modify and adapt it to your needs.
