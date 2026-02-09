const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['#3fb950', '#58a6ff', '#bc8cff', '#06b6d4', '#f0883e', '#db61a2'];
const COL_WIDTH = 210;
const ROW_HEIGHT = 52;
const PAD = 60;

class TeamsDashboardApp {
  constructor() {
    this.container = document.getElementById('flowContainer');
    this.nav = document.getElementById('sessionsNav');
    this.panel = document.getElementById('detailPanel');
    this.panelTitle = document.getElementById('panelTitle');
    this.panelMeta = document.getElementById('panelMeta');
    this.panelBody = document.getElementById('panelBody');
    this.panelClose = document.getElementById('panelClose');
    this.selectedNode = null;

    this.panelClose.addEventListener('click', () => this.closePanel());
    this.init();
  }

  async init() {
    try {
      const { sessions } = await (await fetch('/api/sessions')).json();
      this.sessions = sessions;
      this.renderNav();
      if (sessions.length > 0) this.loadSession(sessions[0].id);
    } catch (e) {
      this.container.innerHTML = '<div class="empty-state">Failed to load sessions</div>';
    }
  }

  renderNav() {
    if (!this.sessions.length) {
      this.nav.innerHTML = '<span class="no-sessions">No team sessions found</span>';
      return;
    }
    this.nav.innerHTML = this.sessions.map((s, i) => {
      const date = new Date(s.startTime);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const dur = s.duration ? this.formatDuration(s.duration) : '';
      const branch = s.gitBranch || '';
      return `<button class="session-card${i === 0 ? ' active' : ''}" data-id="${s.id}">
        <span class="session-card-label">${s.agentCount} agents${branch ? ' &middot; ' + branch : ''}</span>
        <span class="session-card-detail">${dateStr} ${timeStr}${dur ? ' &middot; ' + dur : ''}</span>
      </button>`;
    }).join('');
    this.nav.addEventListener('click', e => {
      const btn = e.target.closest('.session-card');
      if (!btn) return;
      this.nav.querySelectorAll('.session-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.closePanel();
      this.loadSession(btn.dataset.id);
    });
  }

  async loadSession(id) {
    this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    try {
      const [sRes, cRes, tRes] = await Promise.all([
        fetch(`/api/sessions/${id}`),
        fetch(`/api/sessions/${id}/communications`),
        fetch(`/api/sessions/${id}/tasks`)
      ]);
      this.data = {
        ...(await sRes.json()),
        communications: (await cRes.json()).communications,
        tasks: (await tRes.json()).tasks
      };
      // Update top bar subtitle
      const info = document.getElementById('sessionInfo');
      if (info) {
        const agents = Object.keys(this.data.agents || {}).length;
        const branch = this.data.gitBranch || '';
        const dur = this.data.duration ? this.formatDuration(this.data.duration) : '';
        const parts = [];
        parts.push(`${agents} ${agents === 1 ? 'agent' : 'agents'}`);
        if (branch) parts.push(`branch: ${branch}`);
        if (dur) parts.push(dur);
        info.textContent = parts.join(' · ');
      }
      this.renderFlow();
    } catch (e) {
      this.container.innerHTML = '<div class="empty-state">Failed to load session</div>';
    }
  }

  // ── Build flow graph ──────────────────────────────────────────────

  renderFlow() {
    const { agents, communications, tasks } = this.data;
    this.nodes = this.buildNodes(agents);
    this.edges = this.buildEdges(this.nodes, agents, communications);
    this.layoutNodes(this.nodes);
    this.container.innerHTML = '';
    const svg = this.renderSVG(this.nodes, this.edges);
    this.container.appendChild(svg);
    this.attachInteractions(this.nodes, agents, tasks, communications, this.edges);
  }

  buildNodes(agents) {
    const nodes = [];
    let ci = 0;

    // Categorize agents
    const named = [], leadSubs = [], subWorkers = {};
    for (const [id, a] of Object.entries(agents)) {
      if (id === 'lead') continue;
      const sp = a.spawnedBy === 'team-lead' ? 'Lead' : a.spawnedBy;
      if (!sp) named.push({ id, a });
      else if (sp === 'Lead') leadSubs.push({ id, a });
      else { (subWorkers[sp] = subWorkers[sp] || []).push({ id, a }); }
    }

    // START
    nodes.push({ id: 'start', name: 'START', type: 'terminal', color: '#58a6ff', children: ['lead'] });

    // Lead
    const leadKids = named.map(n => n.id).concat(leadSubs.map(n => n.id));
    nodes.push({ id: 'lead', name: 'Lead', type: 'lead', color: '#d57455', children: leadKids, parent: 'start' });

    // Named agents + their sub-workers
    for (const { id, a } of named) {
      const color = COLORS[ci++ % COLORS.length];
      const subs = subWorkers[a.name] || [];
      nodes.push({ id, name: a.name, type: 'agent', color, children: subs.map(s => s.id), parent: 'lead' });
      for (const s of subs) {
        nodes.push({ id: s.id, name: this.shortName(s.a.name), type: 'sub', color, children: [], parent: id });
      }
    }

    // Lead's unnamed sub-agents
    for (const { id, a } of leadSubs) {
      nodes.push({ id, name: this.shortName(a.name), type: 'sub', color: '#d57455', children: [], parent: 'lead' });
    }

    // END
    nodes.push({ id: 'end', name: 'END', type: 'terminal', color: '#58a6ff', children: [] });
    return nodes;
  }

  shortName(name) {
    // If name has a slash prefix (parent/id), show just the id part
    const parts = name.split('/');
    if (parts.length > 1) return parts[1];
    // If name is a task subject (long), truncate for the node
    if (name.length > 16) return name.substring(0, 14) + '..';
    return name;
  }

  buildEdges(nodes, agents, communications) {
    const tree = [], comms = [];
    // Tree edges (parent -> child)
    for (const n of nodes) {
      for (const cid of n.children || []) tree.push({ from: n.id, to: cid });
    }
    // Named agents -> END
    for (const n of nodes) {
      if (n.type === 'agent') tree.push({ from: n.id, to: 'end' });
    }

    // Name/ID lookup
    this.lookup = { 'team-lead': 'lead' };
    for (const [id, a] of Object.entries(agents)) { this.lookup[a.name] = id; this.lookup[id] = id; }

    // Aggregate communications into unique edges
    const map = new Map();
    for (const c of communications) {
      const from = this.lookup[c.from], to = this.lookup[c.to];
      if (!from || !to) continue;
      const key = `${from}->${to}`;
      if (!map.has(key)) map.set(key, { from, to, count: 0, types: [] });
      const e = map.get(key);
      e.count++;
      if (!e.types.includes(c.messageType)) e.types.push(c.messageType);
    }
    comms.push(...map.values());
    return { tree, comms };
  }

  // ── Tree layout ───────────────────────────────────────────────────

  layoutNodes(nodes) {
    const nm = new Map(nodes.map(n => [n.id, n]));

    function size(id) {
      const n = nm.get(id);
      if (!n || !n.children || !n.children.length) return 1;
      return n.children.reduce((s, c) => s + size(c), 0);
    }

    const total = size('start');
    const h = Math.max(total * ROW_HEIGHT, 280);

    function place(id, depth, y0, y1) {
      const n = nm.get(id);
      if (!n) return;
      n.x = PAD + depth * COL_WIDTH;
      n.y = (y0 + y1) / 2;
      n.depth = depth;
      if (n.type === 'terminal') { n.w = 80; n.h = 38; }
      else if (n.type === 'sub') { n.w = 120; n.h = 32; }
      else { n.w = 110; n.h = 40; }

      if (!n.children || !n.children.length) return;
      const sizes = n.children.map(c => size(c));
      const tot = sizes.reduce((a, b) => a + b, 0);
      let cur = y0;
      for (let i = 0; i < n.children.length; i++) {
        const end = cur + (sizes[i] / tot) * (y1 - y0);
        place(n.children[i], depth + 1, cur, end);
        cur = end;
      }
    }

    place('start', 0, 0, h);

    // Position END manually
    const end = nm.get('end');
    const maxD = Math.max(...nodes.filter(n => n.depth != null).map(n => n.depth));
    end.x = PAD + (maxD + 1) * COL_WIDTH;
    end.y = h / 2;
    end.depth = maxD + 1;
    end.w = 80;
    end.h = 38;

    this.svgW = end.x + end.w / 2 + PAD;
    this.svgH = h;
  }

  // ── SVG rendering ─────────────────────────────────────────────────

  renderSVG(nodes, edges) {
    const svg = this.el('svg', {
      viewBox: `${-PAD} ${-PAD} ${this.svgW + PAD} ${this.svgH + PAD * 2}`,
      class: 'flow-svg'
    });

    // Defs: arrow markers
    const defs = this.el('defs');
    defs.appendChild(this.marker('arrow-tree', '#30363d'));
    defs.appendChild(this.marker('arrow-comm', '#8b949e'));
    svg.appendChild(defs);

    const nm = new Map(nodes.map(n => [n.id, n]));

    // Tree edges
    for (const e of edges.tree) {
      const a = nm.get(e.from), b = nm.get(e.to);
      if (!a || !b || a.x == null || b.x == null) continue;
      svg.appendChild(this.edgePath(a, b, 'tree-edge', '#21262d', 1.5, 'url(#arrow-tree)'));
    }

    // Communication edges
    for (const e of edges.comms) {
      const a = nm.get(e.from), b = nm.get(e.to);
      if (!a || !b || a.x == null || b.x == null) continue;
      const color = a.color || '#8b949e';
      const path = this.edgePath(a, b, 'comm-edge', color, 2, 'url(#arrow-comm)', 0.5);
      path.dataset.from = e.from;
      path.dataset.to = e.to;
      svg.appendChild(path);
    }

    // Nodes (drawn last to be on top)
    for (const n of nodes) {
      if (n.x == null) continue;
      svg.appendChild(this.nodeEl(n));
    }

    return svg;
  }

  el(tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  marker(id, color) {
    const m = this.el('marker', { id, markerWidth: 8, markerHeight: 6, refX: 8, refY: 3, orient: 'auto' });
    m.appendChild(this.el('polygon', { points: '0 0, 8 3, 0 6', fill: color }));
    return m;
  }

  edgePath(a, b, cls, stroke, width, markerEnd, opacity) {
    const back = b.x < a.x;
    let x1, y1, x2, y2;
    if (back) {
      x1 = a.x - a.w / 2; y1 = a.y;
      x2 = b.x + b.w / 2; y2 = b.y;
    } else {
      x1 = a.x + a.w / 2; y1 = a.y;
      x2 = b.x - b.w / 2; y2 = b.y;
    }

    let d;
    if (back) {
      const off = -Math.max(50, Math.abs(x1 - x2) * 0.15);
      d = `M ${x1} ${y1} C ${x1 - 30} ${y1 + off}, ${x2 + 30} ${y2 + off}, ${x2} ${y2}`;
    } else {
      const cx = (x1 + x2) / 2;
      d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
    }

    const attrs = { d, fill: 'none', stroke, 'stroke-width': width, class: cls, 'marker-end': markerEnd };
    if (opacity) attrs['stroke-opacity'] = opacity;
    return this.el('path', attrs);
  }

  nodeEl(n) {
    const g = this.el('g', { class: `flow-node flow-node-${n.type}`, 'data-id': n.id, transform: `translate(${n.x},${n.y})` });
    const rx = n.type === 'terminal' ? n.h / 2 : n.type === 'sub' ? 6 : 8;
    g.appendChild(this.el('rect', {
      x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx, fill: n.color
    }));
    const t = this.el('text', {
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: '#fff', 'font-size': n.type === 'sub' ? 10 : 12,
      'font-weight': 600, 'font-family': '-apple-system, BlinkMacSystemFont, sans-serif'
    });
    t.textContent = n.name;
    g.appendChild(t);
    return g;
  }

  // ── Interactions ──────────────────────────────────────────────────

  attachInteractions(nodes, agents, tasks, communications, edges) {
    const allNodes = this.container.querySelectorAll('.flow-node');
    const allTreeEdges = this.container.querySelectorAll('.tree-edge');
    const allCommEdges = this.container.querySelectorAll('.comm-edge');

    allNodes.forEach(gEl => {
      const nid = gEl.dataset.id;
      if (nid === 'start' || nid === 'end') return;

      // Hover: highlight connected edges
      gEl.addEventListener('mouseenter', () => {
        allNodes.forEach(el => { if (el.dataset.id !== nid) el.classList.add('dimmed'); });
        allTreeEdges.forEach(el => el.classList.add('dimmed'));
        allCommEdges.forEach(el => {
          if (el.dataset.from === nid || el.dataset.to === nid) el.classList.add('highlighted');
          else el.classList.add('dimmed');
        });
      });

      gEl.addEventListener('mouseleave', () => {
        allNodes.forEach(el => el.classList.remove('dimmed'));
        allTreeEdges.forEach(el => el.classList.remove('dimmed'));
        allCommEdges.forEach(el => { el.classList.remove('highlighted'); el.classList.remove('dimmed'); });
      });

      // Click: open detail panel
      gEl.addEventListener('click', () => {
        this.openPanel(nid, agents, tasks, communications);
      });
    });

    // Click on flow background closes panel
    this.container.addEventListener('click', e => {
      if (e.target === this.container || e.target.closest('.flow-svg') === e.target) {
        this.closePanel();
      }
    });
  }

  // ── Detail panel ──────────────────────────────────────────────────

  openPanel(nid, agents, tasks, communications) {
    const agent = agents[nid];
    if (!agent) return;

    // Mark selected node
    if (this.selectedNode) {
      const prev = this.container.querySelector(`.flow-node[data-id="${this.selectedNode}"]`);
      if (prev) prev.classList.remove('selected');
    }
    this.selectedNode = nid;
    const nodeEl = this.container.querySelector(`.flow-node[data-id="${nid}"]`);
    if (nodeEl) nodeEl.classList.add('selected');

    // Get node color
    const rectEl = nodeEl ? nodeEl.querySelector('rect') : null;
    const color = rectEl ? rectEl.getAttribute('fill') : '#c9d1d9';

    // Title and meta
    this.panelTitle.textContent = agent.name;
    this.panelTitle.style.color = color;
    this.panelMeta.textContent = `${agent.eventCount} events · ${agent.messageCount} messages`;

    // Build lookups for communications
    const received = communications.filter(c => (this.lookup[c.to]) === nid);
    const sent = communications.filter(c => (this.lookup[c.from]) === nid);

    // Build interaction summary (unique agents this one communicated with)
    const interactionMap = new Map();
    for (const c of received) {
      const fromId = this.lookup[c.from];
      if (!interactionMap.has(fromId)) interactionMap.set(fromId, { received: 0, sent: 0 });
      interactionMap.get(fromId).received++;
    }
    for (const c of sent) {
      const toId = this.lookup[c.to];
      if (!interactionMap.has(toId)) interactionMap.set(toId, { received: 0, sent: 0 });
      interactionMap.get(toId).sent++;
    }

    // Agent tasks
    const agentTasks = tasks.filter(t =>
      t.createdBy === nid || t.owner === nid ||
      t.createdBy === agent.name || t.owner === agent.name
    );

    // Tools
    const tools = Object.entries(agent.toolsUsed || {}).sort((a, b) => b[1] - a[1]);

    // Build accordion sections
    let html = '';

    // 1. Interactions summary
    html += this.accordionSection('Interactions', interactionMap.size, () => {
      if (!interactionMap.size) return '<div class="empty-section">No interactions</div>';
      let items = '';
      for (const [agentId, counts] of interactionMap) {
        const a = agents[agentId];
        const name = a ? a.name : agentId;
        const nodeColor = this.getNodeColor(agentId);
        const total = counts.received + counts.sent;
        items += `<div class="interaction-item">
          <span class="interaction-dot" style="background:${nodeColor}"></span>
          <span class="interaction-name">${this.escapeHtml(name)}</span>
          <span class="interaction-count">${counts.received} in / ${counts.sent} out</span>
        </div>`;
      }
      return items;
    }, true);

    // 2. Received messages
    html += this.accordionSection('Received', received.length, () => {
      if (!received.length) return '<div class="empty-section">No messages received</div>';
      return received.map(c => {
        const text = this.getCommText(c.content);
        const preview = text ? text.substring(0, 80) : '';
        const full = this.escapeHtml(text || '');
        return `<div class="comm-item has-popup" data-fulltext="${full.replace(/"/g, '&quot;')}">
          <div class="comm-direction">from <span class="comm-agent" style="color:${this.getNodeColor(this.lookup[c.from])}">${this.escapeHtml(c.from)}</span><span class="comm-type-badge">${c.messageType}</span></div>
          ${preview ? `<div class="comm-preview">${this.escapeHtml(preview)}</div>` : ''}
        </div>`;
      }).join('');
    });

    // 3. Sent messages
    html += this.accordionSection('Sent', sent.length, () => {
      if (!sent.length) return '<div class="empty-section">No messages sent</div>';
      return sent.map(c => {
        const text = this.getCommText(c.content);
        const preview = text ? text.substring(0, 80) : '';
        const full = this.escapeHtml(text || '');
        return `<div class="comm-item has-popup" data-fulltext="${full.replace(/"/g, '&quot;')}">
          <div class="comm-direction">to <span class="comm-agent" style="color:${this.getNodeColor(this.lookup[c.to])}">${this.escapeHtml(c.to)}</span><span class="comm-type-badge">${c.messageType}</span></div>
          ${preview ? `<div class="comm-preview">${this.escapeHtml(preview)}</div>` : ''}
        </div>`;
      }).join('');
    });

    // 4. Tasks
    html += this.accordionSection('Tasks', agentTasks.length, () => {
      if (!agentTasks.length) return '<div class="empty-section">No tasks</div>';
      return agentTasks.map(t => {
        const st = t.latestStatus || 'pending';
        const icons = { completed: '&#10003;', in_progress: '&#9673;', pending: '&#9675;' };
        const icon = icons[st] || icons.pending;
        return `<div class="task-item">
          <span class="task-status status-${st}">${icon}</span>
          <span class="task-subject">${this.escapeHtml(t.subject || 'Unnamed')}</span>
        </div>`;
      }).join('');
    });

    // 5. Tools used
    html += this.accordionSection('Tools', tools.length, () => {
      if (!tools.length) return '<div class="empty-section">No tools used</div>';
      return tools.map(([name, count]) =>
        `<span class="tool-badge">${this.escapeHtml(name)}: ${count}</span>`
      ).join(' ');
    });

    this.panelBody.innerHTML = html;

    // Attach accordion toggle handlers
    this.panelBody.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('open');
      });
    });

    // Attach message hover popups
    this.panelBody.querySelectorAll('.comm-item.has-popup').forEach(item => {
      item.addEventListener('mouseenter', e => {
        const text = item.dataset.fulltext;
        if (!text) return;
        this.showMessagePopup(text, e);
      });
      item.addEventListener('mousemove', e => this.moveMessagePopup(e));
      item.addEventListener('mouseleave', () => this.hideMessagePopup());
    });

    // Open the panel
    this.panel.classList.add('open');
  }

  closePanel() {
    this.panel.classList.remove('open');
    if (this.selectedNode) {
      const prev = this.container.querySelector(`.flow-node[data-id="${this.selectedNode}"]`);
      if (prev) prev.classList.remove('selected');
      this.selectedNode = null;
    }
  }

  accordionSection(title, count, contentFn, openByDefault = false) {
    const chevron = `<svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`;
    return `<div class="accordion${openByDefault ? ' open' : ''}">
      <div class="accordion-header">
        ${chevron}
        <span>${title}</span>
        <span class="accordion-count">${count}</span>
      </div>
      <div class="accordion-body">${contentFn()}</div>
    </div>`;
  }

  showMessagePopup(text, event) {
    if (!this.popup) {
      this.popup = document.createElement('div');
      this.popup.className = 'message-popup';
      document.body.appendChild(this.popup);
    }
    this.popup.textContent = text;
    this.popup.classList.add('visible');
    this.moveMessagePopup(event);
  }

  moveMessagePopup(e) {
    if (!this.popup) return;
    const pad = 12;
    const maxW = 380;
    this.popup.style.maxWidth = maxW + 'px';
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const rect = this.popup.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - pad) x = e.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
    this.popup.style.left = x + 'px';
    this.popup.style.top = y + 'px';
  }

  hideMessagePopup() {
    if (this.popup) this.popup.classList.remove('visible');
  }

  getCommText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    return content.text || content.message || '';
  }

  getNodeColor(nodeId) {
    if (!this.nodes) return '#8b949e';
    const node = this.nodes.find(n => n.id === nodeId);
    return node ? node.color : '#8b949e';
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  formatDuration(ms) {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  }
}

new TeamsDashboardApp();
