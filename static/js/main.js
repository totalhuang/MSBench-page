/* MSBench project page. All content comes from data/*.json written by tools/build_data.py. */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const TR = { 'hard cut': '--cut', dissolve: '--dissolve', fade: '--fade', wipe: '--wipe' };
const trColor = t => css(TR[t] || '--cut');
const DIM = { VQ: '--vq', DQ: '--dq', SA: '--sa', CSC: '--csc' };
const TYPE = { CrossEntityMultiScene: 'Cross-entity · Multi-scene', CrossEntitySingleScene: 'Cross-entity · Single-scene',
  NocrossEntityMultiScene: 'No cross-entity · Multi-scene', NocrossEntitySingleScene: 'No cross-entity · Single-scene' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = v => v == null ? '–' : v.toFixed(1);
const charts = [];
const chart = (id, option) => { const c = echarts.init($(id), null, { renderer: 'svg' }); c.setOption(option); charts.push(c); return c; };
addEventListener('resize', () => charts.forEach(c => c.resize()));
const FONT = { fontFamily: 'Inter, sans-serif', color: '#3d4048' };

/* ---------- nav + lazy video playback ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > $('.hero').offsetHeight - 70);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const io = new IntersectionObserver(es => es.forEach(e => { e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause(); }), { threshold: .35 });

/* ---------- script text ---------- */
function rich(text, script) {
  const cap = Object.fromEntries(script.entities.map(e => [e.id, e.caption]));
  return esc(text).replace(/\[(entity\d+)\]/g, (_, id) => `<span class="ent" title="${esc(cap[id] || '')}">${id}</span>`)
    .replace(/\[(Scene\d+)\]/g, '<span class="scn">$1</span>');
}
function scriptCard(script, withContext = true) {
  const box = el('div');
  box.append(el('div', 'script-meta', [`${script.duration}s`, script.topic, TYPE[script.type], `${script.shots.length} shots`].map(t => `<span class="tag">${t}</span>`).join('')));
  if (withContext) {
    box.append(el('details', 'ctx', `<summary>Global context &amp; entities</summary>` +
      Object.entries(script.context).map(([k, v]) => `<p><b>${k}.</b> ${rich(v, script)}</p>`).join('') +
      script.entities.map(e => `<p><span class="ent">${e.id}</span> ${esc(e.caption)}</p>`).join('')));
  }
  script.shots.forEach((s, i) => {
    const c = s.camera;
    box.append(el('div', 'shot', `<div class="shot-head"><b>Shot ${i + 1}</b><span class="t">${s.start}–${s.end}s</span>` +
      `<span class="tag">${c.scale}</span><span class="tag">${c.angle}</span><span class="tag">${c.movement}</span></div><p>${rich(s.description, script)}</p>`));
    if (s.transition) box.append(el('div', 'trans', `<i class="dot" style="background:${trColor(s.transition.type)}"></i>${s.transition.type}` +
      (s.transition.duration ? ` · ${s.transition.duration}s` : '')));
  });
  return box;
}

/* ---------- video card with requested / detected timeline ---------- */
function videoCard(v, script, opt = {}) {
  const card = el('div', 'vcard');
  const video = el('video'); Object.assign(video, { src: v.src, muted: true, loop: true, playsInline: true, controls: true, preload: 'metadata' });
  const total = Math.max(script.duration, v.length || 0);
  const pct = t => `${100 * t / total}%`;
  const badge = opt.badge || `<span class="score">Final ${fmt(v.scores.final)}</span>`;
  card.append(video, el('div', 'vhead', `<b>${v.model}</b>${badge}`));
  if (!opt.badge) card.append(el('div', 'dims', Object.keys(DIM).map(d => `<span style="color:${css(DIM[d])}">${d} <i>${fmt(v.scores[d])}</i></span>`).join('')));
  const tl = el('div', 'tl');
  const req = el('div', 'tl-row'), det = el('div', 'tl-row det');
  script.shots.forEach((s, i) => {
    const seg = el('div', 'tl-seg', `S${i + 1}`); seg.style.left = pct(s.start); seg.style.width = pct(s.end - s.start); req.append(seg);
  });
  script.shots.forEach(s => {
    if (!s.transition) return;
    const d = s.transition.duration, m = el('div', 'tl-tr');
    m.style.left = pct(s.end - d / 2); m.style.width = pct(d); m.style.background = trColor(s.transition.type); m.title = `requested: ${s.transition.type}`; req.append(m);
  });
  v.detected.forEach(p => {
    const m = el('div', 'tl-tr'); m.style.left = pct(p.start); m.style.width = pct(p.end - p.start); m.style.background = trColor(p.type);
    m.title = `detected: ${p.type} @ ${p.start.toFixed(2)}s`; det.append(m);
  });
  const heads = [req, det].map(r => { const h = el('div', 'tl-head'); r.append(h); return h; });
  video.addEventListener('timeupdate', () => {
    heads.forEach(h => h.style.left = pct(video.currentTime));
    if (opt.onTime) opt.onTime(video.currentTime);
  });
  [req, det].forEach(r => r.addEventListener('click', e => {
    const b = r.getBoundingClientRect(); video.currentTime = Math.min(video.duration || total, total * (e.clientX - b.left) / b.width);
  }));
  tl.append(req, det, el('div', 'tl-lab', `<span>requested (top) · detected (bottom)</span><span>${total.toFixed(1)}s</span>`));
  card.append(tl); io.observe(video);
  return card;
}

/* ---------- overview: tiles + explorer ---------- */
function overview(ds, explorer) {
  $('#tiles').innerHTML = [[ds.n_scripts, 'structured mini-scripts'], [ds.n_shots, 'scripted shots'], [3, 'durations: 4s, 8s, 15s'],
    [ds.n_models, 'systems evaluated'], [ds.n_videos.toLocaleString(), 'videos scored'], [11, 'sub-metrics in 4 dimensions']]
    .map(([n, t]) => `<div class="tile"><b>${n}</b><span>${t}</span></div>`).join('');
  $('#legend').innerHTML = Object.keys(TR).map(t => `<span><i class="dot" style="background:${trColor(t)}"></i>${t}</span>`).join('') +
    '<span>Hover an <span class="ent">entity</span> tag to read its description.</span>';
  const chips = $('#explorer-chips');
  const show = i => {
    [...chips.children].forEach((c, j) => c.classList.toggle('on', i === j));
    const s = explorer[i], side = $('#explorer-script'), grid = $('#explorer-videos');
    side.replaceChildren(scriptCard(s)); grid.replaceChildren();
    const shots = [...side.querySelectorAll('.shot')];
    const onTime = t => shots.forEach((n, k) => n.classList.toggle('active', t >= s.shots[k].start && t < s.shots[k].end));
    s.videos.forEach(v => grid.append(videoCard(v, s, { onTime })));
  };
  explorer.forEach((s, i) => { const c = el('button', 'chip', `${s.duration}s · ${s.topic} · ${s.shots.length} shots`); c.onclick = () => show(i); chips.append(c); });
  show(2);
}

/* ---------- dataset charts ---------- */
function datasetCharts(ds) {
  const st = ds.stats, pal = ['#17181c', '#e2572b', '#2f6fed', '#0f9d7a', '#8a56d8', '#e0a020', '#c2417a', '#4b8fa8', '#7a8a3c', '#9a6b4f'];
  const node = n => ({ name: n, label: { formatter: TYPE[n] || n } });
  const names = [...st.duration.map(d => d[0]).sort((a, b) => parseInt(a) - parseInt(b)), ...st.type.map(d => d[0]), ...st.shots.map(d => d[0]).sort()];
  chart('#c-sankey', { color: pal, tooltip: { formatter: p => p.dataType === 'edge' ? `${TYPE[p.data.source] || p.data.source} → ${TYPE[p.data.target] || p.data.target}: <b>${p.data.value}</b>` : `${TYPE[p.name] || p.name}: <b>${p.value}</b>` },
    series: [{ type: 'sankey', left: 8, right: 110, top: 10, bottom: 10, nodeGap: 14, nodeWidth: 14, layoutIterations: 0, emphasis: { focus: 'adjacency' },
      data: names.map(node), links: ds.sankey, label: { ...FONT, fontSize: 12.5 }, lineStyle: { color: 'gradient', opacity: .28, curveness: .5 } }] });
  const bar = (rows, color) => ({ grid: { left: 8, right: 34, top: 6, bottom: 4, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#eee' } }, axisLabel: { ...FONT, fontSize: 11 } },
    yAxis: { type: 'category', inverse: true, data: rows.map(r => r[0]), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...FONT, fontSize: 12 } },
    series: [{ type: 'bar', data: rows.map(r => r[1]), itemStyle: { color, borderRadius: [0, 5, 5, 0] }, barMaxWidth: 20, label: { show: true, position: 'right', ...FONT, fontSize: 11 } }] });
  chart('#c-topic', bar(st.topic, css('--vq')));
  chart('#c-trans', { tooltip: { formatter: '{b}: <b>{c}</b> ({d}%)' }, series: [{ type: 'pie', radius: ['34%', '56%'], avoidLabelOverlap: false, startAngle: 120, itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
    label: { formatter: '{b}\n{c}', ...FONT, fontSize: 12.5 }, data: st.transition.map(([name, value]) => ({ name, value, itemStyle: { color: trColor(name) } })) }] });
  const cam = chart('#c-cam', bar(st.movement, css('--accent')));
  $('#cam-seg').onclick = e => { const k = e.target.dataset.k; if (!k) return;
    [...$('#cam-seg').children].forEach(b => b.classList.toggle('on', b === e.target)); cam.setOption(bar(st[k], css('--accent')), true); };

  const cf = ds.transition_confusion, cells = [];
  cf.rows.forEach((r, i) => r.pct.forEach((p, j) => cells.push([j, i, p])));
  chart('#c-conf', { grid: { left: 8, right: 10, top: 34, bottom: 6, containLabel: true }, tooltip: { formatter: p => `requested <b>${cf.requested[p.value[1]]}</b> → ${cf.generated[p.value[0]]}: <b>${p.value[2]}%</b>` },
    xAxis: { type: 'category', position: 'top', data: cf.generated.map(g => g === 'none' ? 'none' : g), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...FONT, fontSize: 12.5, interval: 0 } },
    yAxis: { type: 'category', inverse: true, data: cf.requested, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...FONT, fontSize: 12.5 } },
    visualMap: { show: false, min: 0, max: 65, inRange: { color: ['#fbf3ee', '#f3b79f', '#e2572b'] } },
    series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 }, label: { show: true, formatter: p => p.value[2].toFixed(0) + '%', ...FONT, fontSize: 13, fontWeight: 600 } }] });
  const acc = Object.fromEntries(cf.requested.map((k, i) => [k, cf.rows[i]]));
  $('#facts').innerHTML = [[`${acc['hard cut'].acc}%`, 'of requested hard cuts are generated as hard cuts.'],
    [`${Math.min(acc.dissolve.acc, acc.fade.acc, acc.wipe.acc)}–${Math.max(acc.dissolve.acc, acc.fade.acc, acc.wipe.acc)}%`, 'of requested dissolves, fades and wipes come out with the right type.'],
    [`${acc.wipe.pct[0]}%`, 'of requested wipes are rendered as a hard cut instead.'],
    [`${ds.human_srcc}%`, 'system-level Spearman correlation between the MSBench Final score and human pairwise preference.']]
    .map(([n, t]) => `<li><b>${n}</b>${t}</li>`).join('');
}

/* ---------- evaluation ---------- */
function evaluation(dims) {
  const tabs = $('#dim-tabs'), chips = $('#metric-chips'), panel = $('#metric-panel');
  const showMetric = (d, k) => {
    [...chips.children].forEach((c, j) => c.classList.toggle('on', j === k));
    const m = d.metrics[k], top = el('div', 'metric-top');
    top.append(el('div', null, `<h3>${m.name} <span class="tag">${m.id}</span></h3><p>${m.text}</p>`),
      el('div', 'agree', m.human.map(h => `<div><b>${h.srcc.toFixed(1)}</b>${h.name} video SRCC</div><div><b>${h.model.toFixed(1)}</b>${h.name} system SRCC</div>`).join('')));
    const pair = el('div', 'pair');
    for (const tag of ['high', 'low']) {
      const v = m.examples[tag];
      pair.append(videoCard(v, m.script, { badge: `<span class="score ${tag === 'high' ? 'hi' : 'lo'}">${m.id} ${fmt(v.score)}</span>` }));
    }
    const det = el('details', null, '<summary>Show the script behind this pair</summary>'); det.append(scriptCard(m.script));
    panel.replaceChildren(top, pair, det);
  };
  const showDim = i => {
    const d = dims[i];
    [...tabs.children].forEach((c, j) => c.classList.toggle('on', i === j));
    $('#dim-blurb').textContent = d.blurb; chips.replaceChildren();
    d.metrics.forEach((m, k) => { const c = el('button', 'chip', m.name); c.onclick = () => showMetric(d, k); chips.append(c); });
    showMetric(d, 0);
  };
  dims.forEach((d, i) => { const b = el('button', 'dim-tab', `<b>${d.name}</b><small>${d.metrics.map(m => m.id).join(' · ')}</small>`);
    b.style.setProperty('--c', css(DIM[d.id])); b.onclick = () => showDim(i); tabs.append(b); });
  showDim(2);
}

/* ---------- leaderboard ---------- */
function leaderboard(lb) {
  const groupOf = c => c === 'Final' ? null : ['AS', 'PS'].includes(c) ? 'VQ' : ['DD', 'PP'].includes(c) ? 'DQ' : c.startsWith('CS') ? 'CSC' : ['VQ', 'DQ', 'SA', 'CSC'].includes(c) ? c : 'SA';
  const state = { split: 'base', view: 'dims', sort: 'Final', dir: -1, groups: new Set(lb.groups), picked: new Set(['seedance2.0', 'veo', 'wan2.2', 'holocine']) };
  const hex = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const radar = chart('#c-radar', {});
  const drawRadar = rows => {
    const sel = rows.filter(m => state.picked.has(m.id)), pal = ['#e2572b', '#2f6fed', '#0f9d7a', '#8a56d8', '#e0a020', '#17181c', '#c2417a', '#4b8fa8'];
    radar.setOption({ color: pal, legend: { bottom: 0, textStyle: { ...FONT, fontSize: 12 }, itemWidth: 12, itemHeight: 8 }, tooltip: {},
      radar: { center: ['50%', '45%'], radius: '62%', indicator: ['VQ', 'DQ', 'SA', 'CSC'].map(name => ({ name, max: 100, min: 20 })), axisName: { ...FONT, fontWeight: 600, fontSize: 13 },
        splitArea: { areaStyle: { color: ['#fff', '#faf8f4'] } }, splitLine: { lineStyle: { color: '#e6e3dd' } }, axisLine: { lineStyle: { color: '#e6e3dd' } } },
      series: [{ type: 'radar', symbolSize: 5, areaStyle: { opacity: .08 }, lineStyle: { width: 2 },
        data: sel.map(m => ({ name: m.name, value: ['VQ', 'DQ', 'SA', 'CSC'].map(d => m.scores[state.split][d]) })) }] }, true);
  };
  const draw = () => {
    const cols = state.view === 'dims' ? ['VQ', 'DQ', 'SA', 'CSC', 'Final'] : lb.columns.filter(c => !['VQ', 'DQ', 'SA', 'CSC'].includes(c));
    const rows = lb.models.filter(m => m.scores[state.split] && state.groups.has(m.group));
    const ranked = [...rows].sort((a, b) => b.scores[state.split].Final - a.scores[state.split].Final);
    const rank = new Map(ranked.map((m, i) => [m.id, i + 1]));
    rows.sort((a, b) => state.dir * ((a.scores[state.split][state.sort] ?? -1) - (b.scores[state.split][state.sort] ?? -1)));
    const ext = Object.fromEntries(cols.map(c => { const v = rows.map(m => m.scores[state.split][c]).filter(x => x != null); return [c, [Math.min(...v), Math.max(...v)]]; }));
    let head = '';
    if (state.view === 'all') {
      const spans = []; cols.forEach(c => { const g = groupOf(c); spans.length && spans.at(-1)[0] === g ? spans.at(-1)[1]++ : spans.push([g, 1]); });
      head = `<tr><th colspan="3" class="grp" style="background:#fdfcfa"></th>${spans.map(([g, n]) => g ? `<th class="grp" colspan="${n}" style="background:${css(DIM[g])}">${g}</th>` : '<th class="grp" style="background:#fdfcfa"></th>').join('')}</tr>`;
    }
    head += `<tr><th class="l"></th><th class="l">#</th><th class="l">Model</th>${cols.map(c => `<th data-c="${c}" class="${c === state.sort ? 'sorted' : ''}">${c}${c === state.sort ? (state.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr>`;
    const body = rows.map(m => {
      const s = m.scores[state.split], ci = m.ci && m.ci[state.split];
      return `<tr><td><input type="checkbox" data-m="${m.id}" ${state.picked.has(m.id) ? 'checked' : ''} aria-label="Compare ${m.name}"></td><td class="rank">${rank.get(m.id)}</td>` +
        `<td class="model"><b>${m.name}</b>${m.open ? '<span class="badge">open</span>' : ''}<small>${m.group}</small></td>` +
        cols.map(c => {
          const v = s[c], g = groupOf(c), [lo, hi] = ext[c], a = v == null || hi === lo ? 0 : .06 + .34 * (v - lo) / (hi - lo);
          const bg = hex(g ? css(DIM[g]) : '#e2572b', a);
          return `<td class="num ${c === 'Final' ? 'final' : ''}"><span style="background:${bg}">${fmt(v)}</span>${c === 'Final' && ci && state.view === 'dims' ? `<span class="ci">[${fmt(ci[0])}, ${fmt(ci[1])}]</span>` : ''}</td>`;
        }).join('') + '</tr>';
    }).join('');
    $('#lb-table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
    $('.lb-wrap').classList.toggle('all', state.view === 'all');
    $('#lb-note').textContent = (state.split === '15s' ? 'The 15s split has 50 scripts and covers the nine systems that support 15-second generation. ' : '') +
      'Brackets under Final are 95% bootstrap confidence intervals. -V columns are validity rates; the paired column is the score on valid videos.';
    drawRadar(rows); radar.resize();
  };
  const seg = (id, items, key) => { const box = $(id);
    if (items) box.innerHTML = items.map(([k, t]) => `<button data-k="${k}" class="${k === state[key] ? 'on' : ''}">${t}</button>`).join('');
    box.onclick = e => { const k = e.target.dataset.k; if (!k) return; state[key] = k; [...box.children].forEach(b => b.classList.toggle('on', b === e.target)); draw(); }; };
  seg('#lb-split', Object.entries(lb.splits), 'split'); seg('#lb-view', null, 'view');
  lb.groups.forEach(g => { const c = el('button', 'chip on', g); c.onclick = () => { state.groups.has(g) ? state.groups.delete(g) : state.groups.add(g); c.classList.toggle('on'); draw(); }; $('#lb-groups').append(c); });
  $('#lb-table').addEventListener('click', e => {
    const th = e.target.closest('th[data-c]');
    if (th) { const c = th.dataset.c; state.sort === c ? state.dir *= -1 : (state.sort = c, state.dir = -1); draw(); }
  });
  $('#lb-table').addEventListener('change', e => { const m = e.target.dataset.m; if (!m) return; e.target.checked ? state.picked.add(m) : state.picked.delete(m); draw(); });
  draw();
}

/* ---------- boot ---------- */
Promise.all(['dataset', 'explorer', 'metrics', 'leaderboard'].map(n => fetch(`data/${n}.json`).then(r => r.json())))
  .then(([ds, ex, mt, lb]) => { overview(ds, ex); datasetCharts(ds); evaluation(mt); leaderboard(lb); });
