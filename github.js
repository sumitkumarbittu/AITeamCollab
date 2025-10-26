// GitHub Integration
async function loadGitHubView() {
  const loadBtn = document.getElementById('load-github-btn');
  const statsContainer = document.getElementById('github-stats');
  const issuesContainer = document.getElementById('github-issues');
  const prsContainer = document.getElementById('github-prs');
  const changesContainer = document.getElementById('github-changes');
  
  const API_BASE = 'http://127.0.0.1:5001';

  const loadData = async () => {
    const owner = 'ArshCypherZ';
    const repo = 'CBIT';
    const repoUrl = 'https://github.com/ArshCypherZ/CBIT';
    
    try {
      console.log('Loading GitHub data for:', owner, repo);
      const statsRes = await fetch(`${API_BASE}/api/github/stats/${owner}/${repo}`);
      const stats = await statsRes.json();
        
        if (statsContainer) {
          statsContainer.innerHTML = `
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px;">
              <div class="stat-card" style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                <h4>⭐ Stars</h4>
                <p style="font-size: 24px; font-weight: bold; color: #3b82f6;">${stats.stars}</p>
              </div>
              <div class="stat-card" style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                <h4>🍴 Forks</h4>
                <p style="font-size: 24px; font-weight: bold; color: #10b981;">${stats.forks}</p>
              </div>
              <div class="stat-card" style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                <h4>📝 Commits</h4>
                <p style="font-size: 24px; font-weight: bold; color: #f59e0b;">${stats.commits_count}</p>
              </div>
              <div class="stat-card" style="background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center;">
                <h4>🐛 Issues</h4>
                <p style="font-size: 24px; font-weight: bold; color: #ef4444;">${stats.open_issues}</p>
              </div>
            </div>
          `;
        }
        
        // Load issues
        const issuesRes = await fetch(`${API_BASE}/api/github/sync-issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: repoUrl })
        });
        const issues = await issuesRes.json();
        
        if (issuesContainer) {
          issuesContainer.innerHTML = `
            <h3>Issues (${issues.tasks.length})</h3>
            <div class="items-list">
              ${issues.tasks.map(task => `
                <div class="item">
                  <div class="item-header">
                    <span class="item-title">${task.title}</span>
                    <span class="badge ${task.status === 'open' ? 'badge-high' : 'badge-completed'}">${task.status}</span>
                  </div>
                  <div class="item-meta"><a href="${task.url}" target="_blank">View on GitHub</a></div>
                </div>
              `).join('')}
            </div>
          `;
        }
        
        // Load PRs
        const prsRes = await fetch(`${API_BASE}/api/github/sync-prs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: repoUrl })
        });
        const prs = await prsRes.json();
        
        if (prsContainer) {
          prsContainer.innerHTML = `
            <h3>Pull Requests (${prs.milestones.length})</h3>
            <div class="items-list">
              ${prs.milestones.map(pr => `
                <div class="item">
                  <div class="item-header">
                    <span class="item-title">${pr.title}</span>
                    <span class="badge ${pr.status === 'open' ? 'badge-normal' : 'badge-completed'}">${pr.status}</span>
                  </div>
                  <div class="item-meta">by ${pr.author} | Branch: ${pr.branch} | <a href="${pr.url}" target="_blank">View on GitHub</a></div>
                </div>
              `).join('')}
            </div>
          `;
        }
        
        // Load webhook changes
        const changesRes = await fetch(`${API_BASE}/api/github/poll-webhook`);
        const changes = await changesRes.json();
        
        if (changesContainer) {
          const filteredEvents = changes.events.filter(e => e.changes && e.changes.length > 0);
          const uniqueEvents = [];
          const seen = new Set();
          
          for (const event of filteredEvents) {
            const key = `${event.event}-${event.user}-${JSON.stringify(event.changes)}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueEvents.push(event);
            }
          }
          
          changesContainer.innerHTML = uniqueEvents.length > 0 ? `
            <h3>Recent Changes (${uniqueEvents.length})</h3>
            <div class="items-list">
              ${uniqueEvents.slice(0, 10).map(change => `
                <div class="item">
                  <div class="item-header">
                    <span class="item-title">${change.event} by ${change.user}</span>
                    <span class="badge badge-normal">${new Date(change.timestamp).toLocaleString()}</span>
                  </div>
                  <div class="item-meta">
                    ${change.changes.map(c => `
                      <div>${c.message} (${c.added} ${c.removed} ${c.modified})</div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p>No changes yet</p>';
        }
        
    } catch (error) {
      console.error('GitHub integration error:', error);
      if (statsContainer) statsContainer.innerHTML = '<p>Error loading GitHub data</p>';
    }
  };
  
  if (loadBtn) {
    loadBtn.onclick = loadData;
  }
  
  // auto-refresh webhook changes every 30 seconds 
  setInterval(async () => {
    if (changesContainer) {
      try {
        const changesRes = await fetch(`${API_BASE}/api/github/poll-webhook`);
        const changes = await changesRes.json();
        
        const filteredEvents = changes.events.filter(e => e.changes && e.changes.length > 0);
        const uniqueEvents = [];
        const seen = new Set();
        
        for (const event of filteredEvents) {
          const key = `${event.event}-${event.user}-${JSON.stringify(event.changes)}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueEvents.push(event);
          }
        }
        
        changesContainer.innerHTML = uniqueEvents.length > 0 ? `
          <h3>Recent Changes (${uniqueEvents.length})</h3>
          <div class="items-list">
            ${uniqueEvents.slice(0, 10).map(change => `
              <div class="item">
                <div class="item-header">
                  <span class="item-title">${change.event} by ${change.user}</span>
                  <span class="badge badge-normal">${new Date(change.timestamp).toLocaleString()}</span>
                </div>
                <div class="item-meta">
                  ${change.changes.map(c => `
                    <div>${c.message} (${c.added} ${c.removed} ${c.modified})</div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p>No changes yet</p>';
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    }
  }, 30000);
}