/* Workflow demo engine — renders input, animated pipeline and result cards.
   Personal demo: all processing happens in the browser with sample data. */
(function () {
  const DEMOS = [
    { id: 'lead-qualifier', href: 'lead-qualifier.html', name: 'Lead Qualifier' },
    { id: 'invoice-capture', href: 'invoice-capture.html', name: 'Invoice Capture' },
    { id: 'meeting-actions', href: 'meeting-actions.html', name: 'Meeting → Tasks' },
    { id: 'support-triage', href: 'support-triage.html', name: 'Support Triage' },
  ];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pill = (text, tone = 'neutral') => `<span class="pill ${tone}">${esc(text)}</span>`;
  const kv = (pairs) => `<dl class="kv">${pairs.filter(Boolean).map(([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(v || '—')}</dd>`).join('')}</dl>`;
  const card = (app, where, body) => `<section class="card"><div class="card-h"><span class="app">${esc(app)}</span><span class="where">${esc(where || '')}</span></div><div class="card-b">${body}</div></section>`;
  const money = (n, cur = 'A$') => (n == null || isNaN(n)) ? '—' : `${cur}${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function nav(current) {
    const el = document.getElementById('nav');
    if (!el) return;
    el.innerHTML = DEMOS.map((d) => `<a href="${d.href}"${d.id === current ? ' aria-current="page"' : ''}>${esc(d.name)}</a>`).join('');
  }

  function init(cfg) {
    nav(cfg.id);
    const $ = (id) => document.getElementById(id);
    const chips = $('samples'), src = $('src'), meta = $('meta'), runBtn = $('run'), resetBtn = $('reset');
    const pipe = $('pipe'), results = $('results'), stats = $('stats');
    let current = 0, running = false;

    chips.innerHTML = cfg.samples.map((s, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="${i === 0}">${esc(s.label)}</button>`).join('');
    function load(i) {
      current = i;
      src.value = cfg.samples[i].text.trim();
      meta.textContent = cfg.samples[i].meta || '';
      chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(+c.dataset.i === i)));
      resetPipe();
    }
    chips.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b && !running) load(+b.dataset.i); });

    function resetPipe() {
      pipe.innerHTML = cfg.steps.map((s, i) => `
        <li class="node" data-i="${i}">
          <div class="dot" aria-hidden="true">${s.icon || i + 1}</div>
          <div class="node-t"><b>${esc(s.title)}</b><span class="tool${s.ai ? ' ai' : ''}">${esc(s.tool)}</span></div>
          <div class="node-d">${esc(s.desc)}</div>
          <div class="node-out"></div>
        </li>`).join('');
      results.innerHTML = `<div class="results-empty">Pick a sample (or paste your own text) and press <b>Run workflow</b>.<br>Results land here, the way they would in each connected app.</div>`;
      stats.innerHTML = `<span>Status <b>Waiting for trigger</b></span>`;
    }

    async function run() {
      if (running) return;
      running = true; runBtn.disabled = true; resetBtn.disabled = true;
      const text = src.value;
      const sample = cfg.samples[current];
      const t0 = performance.now();
      let out;
      try { out = cfg.process(text, sample); }
      catch (err) { console.error(err); out = { steps: [], cards: [card('Workflow', 'error', `<p>Something went wrong reading this input: ${esc(err.message)}</p>`)] }; }
      resetPipe();
      results.innerHTML = '';
      stats.innerHTML = `<span>Status <b>Running…</b></span>`;
      const nodes = [...pipe.querySelectorAll('.node')];
      const fast = reduced();
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i], s = cfg.steps[i], o = (out.steps || [])[i];
        if (o && o.skip) { n.classList.add('skipped'); n.querySelector('.node-out').textContent = o.text || 'Skipped'; n.classList.add('done'); continue; }
        n.classList.add('active');
        await sleep(fast ? 60 : (s.ai ? 850 : 420));
        n.classList.remove('active'); n.classList.add('done');
        n.querySelector('.dot').textContent = '✓';
        n.querySelector('.node-out').textContent = (o && (o.text ?? o)) || '';
      }
      for (const c of out.cards || []) {
        results.insertAdjacentHTML('beforeend', c);
        await sleep(fast ? 0 : 160);
      }
      const ms = Math.round(performance.now() - t0);
      const extra = (out.stats || []).map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join('');
      stats.innerHTML = `<span>Status <b>Completed</b></span><span>Steps <b>${nodes.length}</b></span><span>Run time <b>${(ms / 1000).toFixed(1)}s</b></span>${extra}`;
      if (cfg.after) cfg.after(results, out);
      running = false; runBtn.disabled = false; resetBtn.disabled = false;
    }

    runBtn.addEventListener('click', run);
    resetBtn.addEventListener('click', () => load(current));
    load(0);
    if (new URLSearchParams(location.search).has('autorun')) run();
  }

  /* Small text helpers shared by demos */
  const find = (text, re, g = 1) => { const m = text.match(re); return m ? (m[g] || '').trim() : ''; };
  const parseMoney = (s) => { if (!s) return null; const n = parseFloat(String(s).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
  const titleCase = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

  window.WD = { init, nav, esc, pill, kv, card, money, initials, find, parseMoney, titleCase, DEMOS };
})();
