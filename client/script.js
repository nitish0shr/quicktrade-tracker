// Utility to set the year in the footer
(function updateYear() {
  const yearSpan = document.getElementById('year');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }
})();

// Elements
const feedBtn = document.getElementById('feedBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const summaryBtn = document.getElementById('summaryBtn');
const viewContainer = document.getElementById('view-container');

// Set active navigation state
function setActive(button) {
  [feedBtn, dashboardBtn, summaryBtn].forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
}

// Render feed page
async function renderFeed() {
  setActive(feedBtn);
  viewContainer.innerHTML = '<p>Loading trade ideas…</p>';
  try {
    const res = await fetch('/api/trades');
    const trades = await res.json();
    let html = '<div class="trade-grid">';
    trades.forEach(trade => {
      html += `
        <div class="trade-card">
          <div>
            <h3>${trade.symbol} – ${trade.strategy}</h3>
            <p class="details">
              <strong>Strike:</strong> ${trade.strike_info}<br>
              <strong>Premium:</strong> $${trade.premium}<br>
              <strong>Expiry:</strong> ${trade.expiry}<br>
              <strong>Current Price:</strong> $${trade.currentPrice || trade.entry}<br>
              <strong>Entry:</strong> $${trade.entry}<br>
              <strong>Stop Loss:</strong> $${trade.stop}<br>
              <strong>Target:</strong> $${trade.target}<br>
              <strong>Confidence:</strong> ${'⭐'.repeat(trade.confidence_level)}
            </p>
          </div>
          <button data-id="${trade.id}">✅ I’m Taking This</button>
        </div>`;
    });
    html += '</div>';
    viewContainer.innerHTML = html;
    // Bind confirm buttons
    const buttons = viewContainer.querySelectorAll('button[data-id]');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.textContent = 'Confirming…';
        try {
          const res = await fetch(`/api/trades/${id}/confirm`, {
            method: 'POST'
          });
          const result = await res.json();
          if (res.ok) {
            btn.textContent = 'Confirmed ✅';
            btn.disabled = true;
          } else {
            alert(result.error || 'Error confirming trade');
            btn.textContent = '✅ I’m Taking This';
            btn.disabled = false;
          }
        } catch (err) {
          alert('Network error');
          btn.textContent = '✅ I’m Taking This';
          btn.disabled = false;
        }
      });
    });
  } catch (error) {
    viewContainer.innerHTML = '<p>Error loading trades.</p>';
  }
}

// Render dashboard
async function renderDashboard() {
  setActive(dashboardBtn);
  viewContainer.innerHTML = '<p>Loading your trades…</p>';
  try {
    const res = await fetch('/api/user-trades');
    const trades = await res.json();
    if (!trades.length) {
      viewContainer.innerHTML = '<p>No trades confirmed yet.</p>';
      return;
    }
    let html = '<div class="table-container"><table id="dashboard-table">';
    html += '<tr><th>Symbol</th><th>Strategy</th><th>Strike</th><th>Entry Time</th><th>Status</th><th>Outcome</th><th>Target</th><th>Stop</th><th>Notes</th><th>Actions</th></tr>';
    trades.forEach(trade => {
      const date = new Date(trade.confirmed_at).toLocaleString();
      html += `<tr data-id="${trade.id}">
        <td>${trade.symbol}</td>
        <td>${trade.strategy}</td>
        <td>${trade.strike_info}</td>
        <td>${date}</td>
        <td>${trade.status}</td>
        <td>${trade.outcome}</td>
        <td>$${trade.target}</td>
        <td>$${trade.stop}</td>
        <td>${trade.notes || ''}</td>
        <td>`;
      if (trade.status === 'open') {
        html += `<button class="close-btn" data-id="${trade.id}">Close</button>`;
      }
      html += '</td></tr>';
    });
    html += '</table></div>';
    viewContainer.innerHTML = html;
    // Bind close buttons
    const closeButtons = viewContainer.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        // Ask user for outcome and notes
        const outcome = prompt('Enter outcome (win, loss, neutral):', 'win');
        if (!outcome) return;
        const notes = prompt('Add notes (optional):', '');
        btn.disabled = true;
        btn.textContent = 'Closing…';
        fetch(`/api/user-trades/${id}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome: outcome.toLowerCase(), notes })
        }).then(async response => {
          const data = await response.json();
          if (response.ok) {
            btn.textContent = 'Closed';
            btn.disabled = true;
            // Update row in table
            const row = btn.closest('tr');
            row.children[4].textContent = data.status;
            row.children[5].textContent = data.outcome;
            row.children[8].textContent = data.notes;
            row.children[9].innerHTML = '';
          } else {
            alert(data.error || 'Error closing trade');
            btn.textContent = 'Close';
            btn.disabled = false;
          }
        }).catch(() => {
          alert('Network error');
          btn.textContent = 'Close';
          btn.disabled = false;
        });
      });
    });
  } catch (err) {
    viewContainer.innerHTML = '<p>Error loading dashboard.</p>';
  }
}

// Render summary
async function renderSummary() {
  setActive(summaryBtn);
  viewContainer.innerHTML = '<p>Loading summary…</p>';
  try {
    const res = await fetch('/api/summary');
    const summary = await res.json();
    const html = `
      <h2>Weekly Summary</h2>
      <ul>
        <li><strong>Total Trades Taken:</strong> ${summary.totalTaken}</li>
        <li><strong>Wins:</strong> ${summary.wins}</li>
        <li><strong>Losses:</strong> ${summary.losses}</li>
        <li><strong>Neutral:</strong> ${summary.neutral}</li>
        <li><strong>Win Rate:</strong> ${summary.winRate}%</li>
        <li><strong>Trades Skipped That Hit Target:</strong> ${summary.skippedHitTarget}</li>
      </ul>
      <p>
        ${summary.totalTaken === 0 ? 'You haven’t taken any trades this week. Consider reviewing the trade feed daily to find opportunities.' : ''}
        ${summary.winRate < 50 && summary.totalTaken > 0 ? 'Review your trading strategies; your win rate is below 50%.' : ''}
        ${summary.skippedHitTarget > 0 ? 'You skipped some trades that might have hit target. Consider adjusting your selection criteria.' : ''}
      </p>`;
    viewContainer.innerHTML = html;
  } catch (err) {
    viewContainer.innerHTML = '<p>Error loading summary.</p>';
  }
}

// Event listeners
feedBtn.addEventListener('click', renderFeed);
dashboardBtn.addEventListener('click', renderDashboard);
summaryBtn.addEventListener('click', renderSummary);

// Initial view
renderFeed();
