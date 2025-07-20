(function() {
  const main = document.getElementById('main-content');
  const navFeed = document.getElementById('nav-feed');
  const navDash = document.getElementById('nav-dashboard');
  const navSummary = document.getElementById('nav-summary');

  function setActive(activeLink) {
    [navFeed, navDash, navSummary].forEach(link => {
      if (link) {
        link.classList.toggle('active', link === activeLink);
      }
    });
  }

  if (navFeed) {
    navFeed.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(navFeed);
      loadFeed();
    });
  }
  if (navDash) {
    navDash.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(navDash);
      loadDashboard();
    });
  }
  if (navSummary) {
    navSummary.addEventListener('click', (e) => {
      e.preventDefault();
      setActive(navSummary);
      loadSummary();
    });
  }

  function loadFeed() {
    if (!main) return;
    main.innerHTML = '<p>Loading trades...</p>';
    fetch('/api/trades')
      .then(res => res.json())
      .then(trades => {
        const grid = document.createElement('div');
        grid.className = 'trade-grid';
        trades.forEach(trade => {
          const card = document.createElement('div');
          card.className = 'trade-card';
          card.innerHTML = `
            <h3>${trade.symbol} - ${trade.strategy}</h3>
            <div class="details">
              <p><strong>Strike:</strong> ${trade.strike_info}</p>
              <p><strong>Entry:</strong> ${trade.entry}</p>
              <p><strong>Stop:</strong> ${trade.stop}</p>
              <p><strong>Target:</strong> ${trade.target}</p>
              <p><strong>Expiry:</strong> ${trade.expiry}</p>
              <p><strong>Confidence:</strong> ${'\u2B50'.repeat(trade.confidence_level)}</p>
            </div>
            <button data-id="${trade.id}">✅ I'm taking this</button>
          `;
          const btn = card.querySelector('button');
          btn.addEventListener('click', () => {
            confirmTrade(trade.id);
          });
          grid.appendChild(card);
        });
        main.innerHTML = '';
        main.appendChild(grid);
      })
      .catch(err => {
        console.error(err);
        main.textContent = 'Failed to load trades.';
      });
  }

  function confirmTrade(tradeId) {
    fetch('/api/user-trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId })
    })
      .then(res => res.json())
      .then(() => {
        alert('Trade confirmed!');
      })
      .catch(err => console.error(err));
  }

  function loadDashboard() {
    if (!main) return;
    main.innerHTML = '<p>Loading dashboard...</p>';
    fetch('/api/user-trades')
      .then(res => res.json())
      .then(trades => {
        const table = document.createElement('table');
        table.className = 'table';
        table.innerHTML = `
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Entry Time</th>
              <th>Strike</th>
              <th>Strategy</th>
              <th>Target</th>
              <th>Stop</th>
              <th>Status</th>
              <th>Outcome</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        trades.forEach(trade => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${trade.symbol}</td>
            <td>${new Date(trade.confirmed_at).toLocaleString()}</td>
            <td>${trade.strike_info}</td>
            <td>${trade.strategy}</td>
            <td>${trade.target}</td>
            <td>${trade.stop}</td>
            <td class="${trade.status === 'closed' ? 'status-closed' : 'status-open'}">${trade.status}</td>
            <td>${trade.outcome || ''}</td>
            <td></td>
          `;
          // add close button for open trades
          if (trade.status === 'open') {
            const actionTd = tr.lastElementChild;
            const btn = document.createElement('button');
            btn.textContent = 'Close';
            btn.addEventListener('click', () => {
              const outcome = prompt('Enter outcome (win/loss/neutral):');
              if (!outcome) return;
              closeTrade(trade.id, outcome);
            });
            actionTd.appendChild(btn);
          }
          tbody.appendChild(tr);
        });
        main.innerHTML = '';
        main.appendChild(table);
      })
      .catch(err => {
        console.error(err);
        main.textContent = 'Failed to load dashboard.';
      });
  }

  function closeTrade(id, outcome) {
    fetch('/api/user-trades/' + id + '/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome })
    })
      .then(res => res.json())
      .then(() => {
        loadDashboard();
      })
      .catch(err => console.error(err));
  }

  function loadSummary() {
    if (!main) return;
    main.innerHTML = '<p>Loading summary...</p>';
    fetch('/api/summary')
      .then(res => res.json())
      .then(summary => {
        const div = document.createElement('div');
        div.innerHTML = `
          <h2>Weekly Summary</h2>
          <p><strong>Total trades taken:</strong> ${summary.totalTaken}</p>
          <p><strong>Wins:</strong> ${summary.wins}</p>
          <p><strong>Losses:</strong> ${summary.losses}</p>
          <p><strong>Neutral:</strong> ${summary.neutral}</p>
          <p><strong>Win Rate:</strong> ${summary.winRate}%</p>
          <p><strong>Trades skipped that hit target:</strong> ${summary.skippedHitTarget}</p>
        `;
        main.innerHTML = '';
        main.appendChild(div);
      })
      .catch(err => {
        console.error(err);
        main.textContent = 'Failed to load summary.';
      });
  }

  // Initialize default view
  setActive(navFeed);
  loadFeed();
})();
