// ═══════════════════════════════════════════
// SpinWheel — Full-Featured Application
// ═══════════════════════════════════════════
(function () {
  'use strict';

  // ───── Color Themes ─────
  const THEMES = {
    vivid: ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#A855F7', '#F97316', '#14B8A6', '#6366F1', '#E879F9'],
    ocean: ['#0EA5E9', '#06B6D4', '#0891B2', '#38BDF8', '#22D3EE', '#0284C7', '#155E75', '#67E8F9', '#0369A1', '#0E7490', '#164E63', '#A5F3FC'],
    sunset: ['#F97316', '#EF4444', '#F59E0B', '#FB923C', '#DC2626', '#EA580C', '#D97706', '#FBBF24', '#B91C1C', '#F87171', '#FCA5A5', '#FCD34D'],
    forest: ['#10B981', '#059669', '#34D399', '#047857', '#6EE7B7', '#065F46', '#14B8A6', '#A7F3D0', '#0D9488', '#0F766E', '#064E3B', '#115E59'],
    candy: ['#F472B6', '#A78BFA', '#FB7185', '#C084FC', '#E879F9', '#F0ABFC', '#818CF8', '#FDA4AF', '#F9A8D4', '#D8B4FE', '#FBCFE8', '#DDD6FE'],
    neon: ['#22D3EE', '#A855F7', '#F43F5E', '#10B981', '#FBBF24', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4', '#F59E0B', '#6366F1'],
    earth: ['#92400E', '#B45309', '#A16207', '#854D0E', '#78350F', '#D97706', '#CA8A04', '#B91C1C', '#9A3412', '#6D28D9', '#065F46', '#1E3A5F'],
    pastel: ['#FCA5A5', '#93C5FD', '#A7F3D0', '#FDE68A', '#DDD6FE', '#FBCFE8', '#BFDBFE', '#BBF7D0', '#FEF08A', '#E9D5FF', '#FDA4AF', '#99F6E4'],
    mono: ['#475569', '#64748B', '#94A3B8', '#334155', '#CBD5E1', '#1E293B', '#7C8BA1', '#5B6B82', '#3E5068', '#A4B3C7', '#8494A7', '#4A5568'],
  };

  const DEFAULT_ENTRIES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah'];

  // ───── State ─────
  const state = {
    wheels: [],       // Array of wheel data objects
    activeWheel: 0,   // Index
    settings: {
      speed: 5,
      duration: 5,
      manualStop: false,
      randomAngle: true,
      confetti: true,
      sound: true,
      theme: 'vivid',
      bgColor: '#0a0a1a',
    },
    // Transient
    angle: 0,
    isSpinning: false,
    animId: null,
    spinCount: 0,
    mysteryWheel: false,
    mysteryResult: false,
    resultTitleIndex: 0,
  };

  function createWheelData(name, empty) {
    return {
      name: name || 'Wheel 1',
      entries: empty ? [] : DEFAULT_ENTRIES.map((n, i) => ({
        id: genId(),
        name: n,
        weight: 1,
        label: '',
        color: '',
        hidden: false,
      })),
      mode: 'normal',           // normal | elimination | accumulation
      showWeight: false,
      showLabel: false,
      showColor: false,
      title: 'SpinWheel',
      desc: 'Spin the wheel to pick a random result!',
      resultTitles: ['🎉 Winner!'],
      history: [],
      scores: {},
    };
  }

  function genId() {
    return Math.random().toString(36).slice(2, 10);
  }

  function currentWheel() {
    return state.wheels[state.activeWheel];
  }

  function visibleEntries() {
    return currentWheel().entries.filter(e => !e.hidden);
  }

  // ───── DOM ─────
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const canvas = $('#wheelCanvas');
  const ctx = canvas.getContext('2d');

  // ───── Audio ─────
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playTick() {
    if (!state.settings.sound || !audioCtx) return;
    try {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(700 + Math.random() * 500, audioCtx.currentTime);
      g.gain.setValueAtTime(0.07, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      o.start(); o.stop(audioCtx.currentTime + 0.04);
    } catch { }
  }
  function playWin() {
    if (!state.settings.sound || !audioCtx) return;
    try {
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.type = 'sine'; o.frequency.setValueAtTime(f, audioCtx.currentTime + i * .1);
        g.gain.setValueAtTime(0, audioCtx.currentTime + i * .1);
        g.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + i * .1 + .02);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * .1 + .25);
        o.start(audioCtx.currentTime + i * .1);
        o.stop(audioCtx.currentTime + i * .1 + .25);
      });
    } catch { }
  }

  // ═══════ CANVAS RENDERING ═══════
  function setCanvasSize() {
    const cont = $('#wheelContainer');
    const s = Math.min(cont.offsetWidth, cont.offsetHeight);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = s * dpr; canvas.height = s * dpr;
    canvas.style.width = s + 'px'; canvas.style.height = s + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function getThemeColors() {
    return THEMES[state.settings.theme] || THEMES.vivid;
  }

  function drawWheel() {
    const s = parseInt(canvas.style.width) || 460;
    const cx = s / 2, cy = s / 2, r = cx - 6;
    const entries = visibleEntries();
    const colors = getThemeColors();
    ctx.clearRect(0, 0, s, s);

    if (entries.length === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#161640'; ctx.fill();
      ctx.strokeStyle = 'rgba(139,92,246,.25)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#606080'; ctx.font = '500 15px Inter,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Add entries to spin!', cx, cy);
      return;
    }

    // Compute weighted angles
    const w = currentWheel();
    const totalWeight = entries.reduce((sum, e) => sum + (w.showWeight ? Math.max(e.weight, 0.1) : 1), 0);
    let cumAngle = state.angle;

    entries.forEach((entry, i) => {
      const weight = w.showWeight ? Math.max(entry.weight, 0.1) : 1;
      const slice = (weight / totalWeight) * Math.PI * 2;
      const startA = cumAngle;
      const endA = cumAngle + slice;
      const col = (w.showColor && entry.color) ? entry.color : colors[i % colors.length];

      // Slice
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startA, endA); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.2; ctx.stroke();

      // Text
      ctx.save(); ctx.translate(cx, cy);
      ctx.rotate(startA + slice / 2);
      const textR = r * 0.62;
      const maxW = r * 0.42;
      const fontSize = Math.min(13, Math.max(8, 150 / entries.length));
      ctx.fillStyle = '#fff'; ctx.font = `600 ${fontSize}px Inter,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 2;

      let displayText = state.mysteryWheel ? '?' : (w.showLabel && entry.label ? entry.label : entry.name);
      while (ctx.measureText(displayText).width > maxW && displayText.length > 1) displayText = displayText.slice(0, -1);
      if (displayText !== (state.mysteryWheel ? '?' : (w.showLabel && entry.label ? entry.label : entry.name)) && !state.mysteryWheel) displayText += '…';

      ctx.fillText(displayText, textR, 0);
      ctx.restore();

      cumAngle = endA;
    });

    // Outer ring
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 3.5; ctx.stroke();

    // Segment dots
    cumAngle = state.angle;
    entries.forEach((entry, i) => {
      const weight = w.showWeight ? Math.max(entry.weight, 0.1) : 1;
      const slice = (weight / totalWeight) * Math.PI * 2;
      const dx = cx + Math.cos(cumAngle) * r;
      const dy = cy + Math.sin(cumAngle) * r;
      ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
      cumAngle += slice;
    });
  }

  // ═══════ SPINNING ═══════
  function getWinnerIndex() {
    const entries = visibleEntries();
    if (entries.length === 0) return -1;
    const w = currentWheel();
    const totalWeight = entries.reduce((sum, e) => sum + (w.showWeight ? Math.max(e.weight, 0.1) : 1), 0);
    const pointer = -Math.PI / 2;
    let normAngle = ((pointer - state.angle) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
    let cum = 0;
    for (let i = 0; i < entries.length; i++) {
      const weight = w.showWeight ? Math.max(entries[i].weight, 0.1) : 1;
      cum += (weight / totalWeight) * Math.PI * 2;
      if (normAngle < cum) return i;
    }
    return entries.length - 1;
  }

  let manualStopRequested = false;

  function spin() {
    const entries = visibleEntries();
    if (state.isSpinning || entries.length < 2) return;
    initAudio();

    state.isSpinning = true;
    $('#btnSpin').classList.add('spinning');
    state.spinCount++;
    updateSpinCounter();

    if (state.settings.manualStop) {
      // Manual stop mode
      manualStopRequested = false;
      const btn = $('#btnSpin');
      btn.classList.remove('spinning');
      btn.classList.add('manual-stop');
      $('#spinBtnText').textContent = 'STOP';

      const speed = (state.settings.speed / 10) * 0.2 + 0.05;
      const startTime = performance.now();
      let lastSeg = -1;

      function animateManual(now) {
        if (manualStopRequested) {
          // Decelerate
          decelerateSpin();
          return;
        }
        state.angle += speed;
        const seg = getWinnerIndex();
        if (seg !== lastSeg) { playTick(); tickPointer(); lastSeg = seg; }
        drawWheel();
        state.animId = requestAnimationFrame(animateManual);
      }
      state.animId = requestAnimationFrame(animateManual);
    } else {
      autoSpin();
    }
  }

  function autoSpin() {
    const dur = state.settings.duration * 1000;
    const speedMult = state.settings.speed / 5;
    const totalRot = Math.PI * 2 * (4 + Math.random() * 6) * speedMult;
    const startAngle = state.settings.randomAngle ? state.angle + Math.random() * Math.PI * 2 : state.angle;
    state.angle = startAngle;
    const start = performance.now();
    let lastSeg = -1;

    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      state.angle = startAngle + totalRot * eased;

      const seg = getWinnerIndex();
      if (seg !== lastSeg) { playTick(); tickPointer(); lastSeg = seg; }
      drawWheel();

      if (progress < 1) {
        state.animId = requestAnimationFrame(animate);
      } else {
        finishSpin();
      }
    }
    state.animId = requestAnimationFrame(animate);
  }

  function decelerateSpin() {
    const dur = 2000;
    const startAngle = state.angle;
    const remainRot = Math.PI * 2 * (1 + Math.random() * 2);
    const start = performance.now();
    let lastSeg = -1;

    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      state.angle = startAngle + remainRot * eased;

      const seg = getWinnerIndex();
      if (seg !== lastSeg) { playTick(); tickPointer(); lastSeg = seg; }
      drawWheel();

      if (progress < 1) {
        state.animId = requestAnimationFrame(animate);
      } else {
        finishSpin();
      }
    }
    state.animId = requestAnimationFrame(animate);
  }

  function finishSpin() {
    state.isSpinning = false;
    const btn = $('#btnSpin');
    btn.classList.remove('spinning', 'manual-stop');
    $('#spinBtnText').textContent = 'SPIN';

    const wi = getWinnerIndex();
    const entries = visibleEntries();
    if (wi >= 0 && wi < entries.length) {
      const winner = entries[wi];
      if (state.mysteryResult) {
        showMysteryReveal(winner);
      } else {
        showResult(winner);
      }
    }
  }

  function tickPointer() {
    const ptr = $('#wheelPointer');
    ptr.classList.remove('tick');
    void ptr.offsetWidth;
    ptr.classList.add('tick');
  }

  function stopManual() {
    if (state.settings.manualStop && state.isSpinning && !manualStopRequested) {
      manualStopRequested = true;
    }
  }

  // ═══════ RESULTS ═══════
  function showResult(winner) {
    const w = currentWheel();

    // Result title cycling
    const titles = w.resultTitles.filter(t => t.trim());
    const title = titles.length > 0 ? titles[state.resultTitleIndex % titles.length] : '🎉 Winner!';
    state.resultTitleIndex++;

    $('#resultSubtitle').textContent = title;
    $('#resultName').textContent = winner.name;
    $('#resultLabelText').textContent = w.showLabel && winner.label ? `Label: ${winner.label}` : '';

    // Mode info
    const modeInfo = $('#resultModeInfo');
    if (w.mode === 'elimination') {
      modeInfo.textContent = 'This entry will be hidden from the wheel.';
    } else if (w.mode === 'accumulation') {
      const count = (w.scores[winner.name] || 0) + 1;
      modeInfo.textContent = `Count: ${count}`;
    } else {
      modeInfo.textContent = '';
    }

    // Action button text
    const actionBtn = $('#btnActionMode');
    if (w.mode === 'normal') actionBtn.textContent = 'DONE';
    else if (w.mode === 'elimination') actionBtn.textContent = 'HIDE CHOICE';
    else actionBtn.textContent = `ADD COUNT`;

    // Add to history
    w.history.unshift({
      name: winner.name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: w.mode,
    });
    if (w.history.length > 50) w.history.pop();

    // Add to scores
    w.scores[winner.name] = (w.scores[winner.name] || 0) + 1;

    // Store winner ref
    state._lastWinner = winner;

    // Show
    playWin();
    $('#resultModal').classList.add('visible');
    if (state.settings.confetti) spawnConfetti();

    updateResultsUI();
    save();
  }

  function showMysteryReveal(winner) {
    state._pendingWinner = winner;
    $('#mysteryReveal').classList.add('visible');
  }

  function revealMystery() {
    $('#mysteryReveal').classList.remove('visible');
    if (state._pendingWinner) {
      showResult(state._pendingWinner);
      state._pendingWinner = null;
    }
  }

  function hideResult() {
    $('#resultModal').classList.remove('visible');
  }

  function doActionMode() {
    const w = currentWheel();
    const winner = state._lastWinner;
    if (!winner) { hideResult(); return; }

    if (w.mode === 'elimination') {
      winner.hidden = true;
      renderEntries();
      drawWheel();
    }
    // accumulation is already counted
    hideResult();
    save();
  }

  function spawnConfetti() {
    const c = $('#confettiContainer');
    c.innerHTML = '';
    const colors = getThemeColors();
    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = '-10px';
      p.style.animationDelay = Math.random() * .4 + 's';
      p.style.animationDuration = (2 + Math.random() * 2) + 's';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      p.style.width = (5 + Math.random() * 8) + 'px';
      p.style.height = (5 + Math.random() * 8) + 'px';
      c.appendChild(p);
    }
  }

  // ═══════ ENTRIES UI ═══════
  function renderEntries() {
    const w = currentWheel();
    const list = $('#entriesList');
    list.innerHTML = '';

    w.entries.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'entry-row' + (entry.hidden ? ' hidden-entry' : '');
      row.dataset.id = entry.id;

      let html = `<span class="entry-drag" title="Drag to reorder">⠿</span>`;

      if (w.showColor) {
        const c = entry.color || getThemeColors()[idx % getThemeColors().length];
        html += `<div class="entry-color-group">`;
        html += `<input type="color" class="entry-color-dot" value="${c}" data-idx="${idx}" title="Pick color">`;
        html += `<button class="entry-color-reset${entry.color ? '' : ' hidden'}" data-idx="${idx}" title="Reset to theme color">↺</button>`;
        html += `</div>`;
      }

      if (w.showWeight) {
        html += `<input type="number" class="entry-weight-input" value="${entry.weight}" min="0.1" step="0.1" data-idx="${idx}" title="Weight">`;
      }

      html += `<input type="text" class="entry-name-input" value="${escHtml(entry.name)}" data-idx="${idx}">`;

      if (w.showLabel) {
        html += `<input type="text" class="entry-label-input" value="${escHtml(entry.label)}" data-idx="${idx}" placeholder="Label">`;
      }

      html += `<div class="entry-actions">`;
      html += `<button class="entry-action-btn" data-action="duplicate" data-idx="${idx}" title="Duplicate">⧉</button>`;
      html += `<button class="entry-action-btn" data-action="toggle" data-idx="${idx}" title="${entry.hidden ? 'Show' : 'Hide'}">${entry.hidden ? '👁' : '👁‍🗨'}</button>`;
      html += `<button class="entry-action-btn delete" data-action="delete" data-idx="${idx}" title="Delete">✕</button>`;
      html += `</div>`;

      row.innerHTML = html;
      list.appendChild(row);
    });

    updateEntryCount();
    setupEntryListeners();
  }

  function setupEntryListeners() {
    // Name edit
    $$('.entry-name-input').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        currentWheel().entries[idx].name = e.target.value;
        drawWheel(); save();
      });
    });

    // Weight edit
    $$('.entry-weight-input').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        currentWheel().entries[idx].weight = parseFloat(e.target.value) || 1;
        drawWheel(); updateEntryCount(); save();
      });
    });

    // Label edit
    $$('.entry-label-input').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        currentWheel().entries[idx].label = e.target.value;
        drawWheel(); save();
      });
    });

    // Color edit
    $$('.entry-color-dot').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.dataset.idx);
        currentWheel().entries[idx].color = e.target.value;
        // Show reset button when color is set
        const resetBtn = e.target.parentElement.querySelector('.entry-color-reset');
        if (resetBtn) resetBtn.classList.remove('hidden');
        drawWheel(); save();
      });
    });

    // Color reset
    $$('.entry-color-reset').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        currentWheel().entries[idx].color = '';
        renderEntries(); drawWheel(); save();
      });
    });

    // Action buttons
    $$('.entry-action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        const action = e.currentTarget.dataset.action;
        const w = currentWheel();

        if (action === 'delete') {
          w.entries.splice(idx, 1);
        } else if (action === 'duplicate') {
          const dup = { ...w.entries[idx], id: genId() };
          w.entries.splice(idx + 1, 0, dup);
        } else if (action === 'toggle') {
          w.entries[idx].hidden = !w.entries[idx].hidden;
        }

        renderEntries(); drawWheel(); save();
      });
    });

    // Drag & drop reorder
    const list = $('#entriesList');
    let dragIdx = null;

    list.querySelectorAll('.entry-drag').forEach((handle, idx) => {
      const row = handle.parentElement;
      row.draggable = true;
      handle.addEventListener('mousedown', () => { row.draggable = true; });

      row.addEventListener('dragstart', e => {
        dragIdx = idx;
        row.style.opacity = '.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        dragIdx = null;
      });
      row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        const w = currentWheel();
        const [moved] = w.entries.splice(dragIdx, 1);
        w.entries.splice(idx, 0, moved);
        renderEntries(); drawWheel(); save();
      });
    });
  }

  function addEntry(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;
    lines.forEach(line => {
      currentWheel().entries.push({
        id: genId(),
        name: line,
        weight: 1,
        label: '',
        color: '',
        hidden: false,
      });
    });
    renderEntries(); drawWheel(); save();
  }

  function updateEntryCount() {
    const w = currentWheel();
    const vis = visibleEntries();
    $('#entryCount').textContent = `${vis.length} / ${w.entries.length} entries`;

    const tw = $('#totalWeight');
    if (w.showWeight) {
      const total = vis.reduce((s, e) => s + Math.max(e.weight, 0.1), 0);
      tw.style.display = '';
      tw.textContent = `Total weight: ${total.toFixed(1)}`;
    } else {
      tw.style.display = 'none';
    }
  }

  function updateSpinCounter() {
    $('#spinCounter').innerHTML = `Spins: <strong>${state.spinCount}</strong>`;
  }

  // ═══════ RESULTS UI ═══════
  function updateResultsUI() {
    const w = currentWheel();

    // History
    const hl = $('#historyList');
    if (w.history.length === 0) {
      hl.innerHTML = '<li class="history-empty">No results yet. Spin the wheel!</li>';
    } else {
      hl.innerHTML = w.history.map((h, i) => {
        let badge = '';
        if (h.mode === 'elimination') badge = '<span class="history-badge badge-elim">HIDDEN</span>';
        else if (h.mode === 'accumulation') badge = `<span class="history-badge badge-acc">+1</span>`;
        return `<li class="history-item"><span class="history-num">${i + 1}</span><span class="history-name">${escHtml(h.name)}</span>${badge}<span class="history-time">${h.time}</span></li>`;
      }).join('');
    }

    // Scores
    const sl = $('#scoresList');
    const sorted = Object.entries(w.scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      sl.innerHTML = '<li class="history-empty">No scores yet.</li>';
    } else {
      const max = sorted[0][1];
      sl.innerHTML = sorted.map(([name, count]) => {
        const pct = (count / max) * 100;
        return `<li class="score-item"><span class="score-name">${escHtml(name)}</span><div class="score-bar-wrap"><div class="score-bar" style="width:${pct}%"></div></div><span class="score-count">${count}</span></li>`;
      }).join('');
    }
  }

  // ═══════ WHEEL TABS ═══════
  function renderWheelTabs() {
    const container = $('#wheelTabs');
    container.innerHTML = '';
    state.wheels.forEach((w, i) => {
      const btn = document.createElement('button');
      btn.className = 'wheel-tab' + (i === state.activeWheel ? ' active' : '');
      btn.dataset.index = i;
      btn.textContent = w.name;

      // Double-click to rename
      btn.addEventListener('dblclick', () => {
        const name = prompt('Rename wheel:', w.name);
        if (name && name.trim()) {
          w.name = name.trim();
          renderWheelTabs();
          save();
        }
      });

      // Right-click to delete
      btn.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (state.wheels.length <= 1) return;
        if (confirm(`Delete "${w.name}"?`)) {
          state.wheels.splice(i, 1);
          if (state.activeWheel >= state.wheels.length) state.activeWheel = state.wheels.length - 1;
          switchWheel(state.activeWheel);
          save();
        }
      });

      btn.addEventListener('click', () => switchWheel(i));
      container.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'wheel-tab-add';
    addBtn.textContent = '+';
    addBtn.title = 'New Wheel';
    addBtn.addEventListener('click', () => {
      if (state.wheels.length >= 5) { alert('Maximum 5 wheels'); return; }
      state.wheels.push(createWheelData('Wheel ' + (state.wheels.length + 1), true));
      switchWheel(state.wheels.length - 1);
      save();
    });
    container.appendChild(addBtn);
  }

  function switchWheel(idx) {
    state.activeWheel = idx;
    state.angle = 0;
    state.spinCount = 0;
    state.resultTitleIndex = 0;
    const w = currentWheel();

    // Sync UI
    renderWheelTabs();
    renderEntries();
    syncModeUI();
    syncToggles();
    updateTitleArea();
    updateResultsUI();
    updateSpinCounter();
    setCanvasSize();
    drawWheel();
  }

  // ═══════ SYNC UI ═══════
  function syncModeUI() {
    const w = currentWheel();
    $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === w.mode));
  }

  function syncToggles() {
    const w = currentWheel();
    $('#chkWeight').checked = w.showWeight;
    $('#chkLabel').checked = w.showLabel;
    $('#chkColor').checked = w.showColor;
  }

  function updateTitleArea() {
    const w = currentWheel();
    $('#wheelTitle').textContent = w.title || 'SpinWheel';
    $('#wheelDesc').textContent = w.desc || '';
  }

  function syncSettingsUI() {
    const s = state.settings;
    $('#setSpeed').value = s.speed; $('#valSpeed').textContent = 'Lv' + s.speed;
    $('#setDuration').value = s.duration; $('#valDuration').textContent = s.duration + 's';
    $('#setManualStop').checked = s.manualStop;
    $('#setRandomAngle').checked = s.randomAngle;
    $('#setConfetti').checked = s.confetti;
    $('#setSound').checked = s.sound;
    $('#setBgColor').value = s.bgColor;
    $$('.theme-swatch').forEach(b => b.classList.toggle('active', b.dataset.theme === s.theme));
  }

  // ═══════ SAVE / LOAD ═══════
  function save() {
    try {
      localStorage.setItem('spinwheel_v2', JSON.stringify({
        wheels: state.wheels,
        activeWheel: state.activeWheel,
        settings: state.settings,
      }));
    } catch { }
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem('spinwheel_v2'));
      if (d) {
        if (d.wheels?.length) state.wheels = d.wheels;
        if (typeof d.activeWheel === 'number') state.activeWheel = d.activeWheel;
        if (d.settings) Object.assign(state.settings, d.settings);
      }
    } catch { }
    if (state.wheels.length === 0) state.wheels.push(createWheelData());
    if (state.activeWheel >= state.wheels.length) state.activeWheel = 0;
  }

  // ═══════ EVENTS ═══════
  function bindEvents() {
    // Spin
    $('#btnSpin').addEventListener('click', () => {
      if (state.settings.manualStop && state.isSpinning) {
        stopManual();
      } else {
        spin();
      }
    });
    canvas.addEventListener('click', () => {
      if (state.settings.manualStop && state.isSpinning) stopManual();
      else spin();
    });

    // Result modal
    $('#btnActionMode').addEventListener('click', doActionMode);
    $('#btnSpinAgain').addEventListener('click', () => {
      hideResult();
      setTimeout(spin, 250);
    });
    $('#resultModal').addEventListener('click', e => { if (e.target === $('#resultModal')) hideResult(); });

    // Add entry
    const addInput = $('#addEntryInput');
    $('#btnAddEntry').addEventListener('click', () => {
      if (addInput.value.trim()) { addEntry(addInput.value); addInput.value = ''; addInput.focus(); }
    });
    addInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (addInput.value.trim()) { addEntry(addInput.value); addInput.value = ''; }
      }
    });
    // Paste support: multi-line
    addInput.addEventListener('paste', e => {
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      if (paste.includes('\n')) {
        e.preventDefault();
        addEntry(paste);
        addInput.value = '';
      }
    });

    // Toolbar
    $('#btnShuffle').addEventListener('click', () => {
      const w = currentWheel();
      for (let i = w.entries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [w.entries[i], w.entries[j]] = [w.entries[j], w.entries[i]];
      }
      renderEntries(); drawWheel(); save();
    });

    $('#btnSort').addEventListener('click', () => {
      currentWheel().entries.sort((a, b) => a.name.localeCompare(b.name));
      renderEntries(); drawWheel(); save();
    });

    $('#btnMystery').addEventListener('click', () => {
      state.mysteryWheel = !state.mysteryWheel;
      $('#btnMystery').classList.toggle('active', state.mysteryWheel);
      drawWheel();
    });

    $('#btnClearAll').addEventListener('click', () => {
      if (confirm('Clear all entries?')) {
        currentWheel().entries = [];
        renderEntries(); drawWheel(); save();
      }
    });

    // Mode buttons
    $$('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentWheel().mode = btn.dataset.mode;
        syncModeUI(); save();
      });
    });

    // Toggles
    $('#chkWeight').addEventListener('change', e => {
      currentWheel().showWeight = e.target.checked;
      renderEntries(); drawWheel(); save();
    });
    $('#chkLabel').addEventListener('change', e => {
      currentWheel().showLabel = e.target.checked;
      renderEntries(); drawWheel(); save();
    });
    $('#chkColor').addEventListener('change', e => {
      currentWheel().showColor = e.target.checked;
      renderEntries(); drawWheel(); save();
    });

    // Sidebar tabs
    $$('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.sidebar-tab').forEach(t => t.classList.remove('active'));
        $$('.sidebar-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        $(`#panel${cap(tab.dataset.panel)}`).classList.add('active');
        if (tab.dataset.panel === 'results') updateResultsUI();
      });
    });

    // Results sub tabs
    $$('.results-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.results-tab').forEach(t => t.classList.remove('active'));
        $$('.results-view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        $(`#view${cap(tab.dataset.view)}`).classList.add('active');
      });
    });

    $('#btnClearResults').addEventListener('click', () => {
      const w = currentWheel();
      w.history = [];
      w.scores = {};
      // Unhide all entries
      w.entries.forEach(e => e.hidden = false);
      updateResultsUI();
      renderEntries();
      drawWheel();
      save();
    });

    // Settings
    $('#btnSettings').addEventListener('click', () => {
      syncSettingsUI();
      $('#settingsModal').classList.add('visible');
    });
    $('#btnCloseSettings').addEventListener('click', () => $('#settingsModal').classList.remove('visible'));
    $('#settingsModal').addEventListener('click', e => { if (e.target === $('#settingsModal')) $('#settingsModal').classList.remove('visible'); });

    $('#setSpeed').addEventListener('input', e => { state.settings.speed = parseInt(e.target.value); $('#valSpeed').textContent = 'Lv' + e.target.value; save(); });
    $('#setDuration').addEventListener('input', e => { state.settings.duration = parseInt(e.target.value); $('#valDuration').textContent = e.target.value + 's'; save(); });
    $('#setManualStop').addEventListener('change', e => { state.settings.manualStop = e.target.checked; save(); });
    $('#setRandomAngle').addEventListener('change', e => { state.settings.randomAngle = e.target.checked; save(); });
    $('#setConfetti').addEventListener('change', e => { state.settings.confetti = e.target.checked; save(); });
    $('#setSound').addEventListener('change', e => { state.settings.sound = e.target.checked; save(); });
    $('#setBgColor').addEventListener('input', e => {
      state.settings.bgColor = e.target.value;
      document.body.style.background = e.target.value;
      save();
    });

    $$('.theme-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        state.settings.theme = btn.dataset.theme;
        $$('.theme-swatch').forEach(b => b.classList.toggle('active', b === btn));
        drawWheel(); save();
      });
    });

    // Reset settings to defaults
    $('#btnResetSettings').addEventListener('click', () => {
      state.settings = {
        speed: 5,
        duration: 5,
        manualStop: false,
        randomAngle: true,
        confetti: true,
        sound: true,
        theme: 'vivid',
        bgColor: '#0a0a1a',
      };
      document.body.style.background = '#0a0a1a';
      syncSettingsUI();
      drawWheel();
      save();
    });

    // Title edit
    $('#btnEditTitle').addEventListener('click', () => {
      const w = currentWheel();
      $('#inputTitle').value = w.title;
      $('#inputDesc').value = w.desc;
      $('#inputResultTitles').value = w.resultTitles.join('\n');
      $('#titleModal').classList.add('visible');
    });
    $('#btnCloseTitleModal').addEventListener('click', () => $('#titleModal').classList.remove('visible'));
    $('#titleModal').addEventListener('click', e => { if (e.target === $('#titleModal')) $('#titleModal').classList.remove('visible'); });
    $('#btnSaveTitles').addEventListener('click', () => {
      const w = currentWheel();
      w.title = $('#inputTitle').value.trim();
      w.desc = $('#inputDesc').value.trim();
      w.resultTitles = $('#inputResultTitles').value.split('\n').map(l => l.trim()).filter(l => l);
      if (w.resultTitles.length === 0) w.resultTitles = ['🎉 Winner!'];
      state.resultTitleIndex = 0;
      updateTitleArea();
      $('#titleModal').classList.remove('visible');
      save();
    });

    // Fullscreen
    $('#btnFullscreen').addEventListener('click', () => {
      document.body.classList.toggle('fullscreen-mode');
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      } else {
        document.exitFullscreen().catch(() => { });
      }
      setTimeout(() => { setCanvasSize(); drawWheel(); }, 300);
    });

    // Mystery reveal
    $('#mysteryReveal').addEventListener('click', revealMystery);

    // Keyboard
    document.addEventListener('keydown', e => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (state.settings.manualStop && state.isSpinning) stopManual();
        else spin();
      }
      if (e.key === 'Escape') {
        $('#settingsModal').classList.remove('visible');
        $('#titleModal').classList.remove('visible');
        hideResult();
        if ($('#mysteryReveal').classList.contains('visible')) revealMystery();
      }
      if (e.key === 'Enter' && $('#mysteryReveal').classList.contains('visible')) {
        revealMystery();
      }
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (state.settings.manualStop && state.isSpinning) stopManual();
        else spin();
      }
    });

    // Resize
    window.addEventListener('resize', () => { setCanvasSize(); drawWheel(); });
  }

  // ═══════ UTILS ═══════
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function escHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  // ═══════ INIT ═══════
  function init() {
    load();
    // Apply bg color
    if (state.settings.bgColor && state.settings.bgColor !== '#0a0a1a') {
      document.body.style.background = state.settings.bgColor;
    }

    renderWheelTabs();
    renderEntries();
    syncModeUI();
    syncToggles();
    updateTitleArea();
    updateResultsUI();
    updateSpinCounter();

    setCanvasSize();
    drawWheel();
    bindEvents();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
