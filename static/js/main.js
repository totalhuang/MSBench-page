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

}

/* ---------- findings: the five findings of the paper (Sec. 5.3), one slide each ---------- */
const GC = { 'Conventional T2V': '#d1495b', 'Native Multi-shot T2V': '#00798c', 'Multi-shot Specialist': '#5c4d7d' };
const AX = { axisTick: { show: false }, axisLine: { show: false } };
const VAL = { splitLine: { lineStyle: { color: '#efece6' } }, axisLabel: { ...FONT, fontSize: 11 } };
const NAMEAX = { nameLocation: 'middle', nameTextStyle: { ...FONT, fontSize: 12, color: '#646872' } };
const segHTML = items => `<span class="seg">${items.map(([k, t], i) => `<button data-k="${k}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</span>`;

function findings(ds) {
  const f = ds.findings, by = (rows, id) => rows.find(r => r.id === id);
  const c1 = f.c1, c2 = f.c2, sig = c1.filter(r => r.sig);
  const k26 = by(c2, 'kling'), k30 = by(c2, 'kling3.0'), msm = by(c2, 'msm');
  const c4 = f.c4, conv = c4['Conventional T2V'], nat = c4['Native Multi-shot T2V'], spec = c4['Multi-shot Specialist'];
  const st15 = conv['15s'].map(r => r.single_take);
  const bg = f.c5.background, veo = by(bg, 'veo'), bgm = by(bg, 'msm');
  const cam = asp => Object.fromEntries(f.c3[asp].map(r => [r.state, r]));
  const ang = cam('angle'), mov = cam('movement');
  const pct = v => `${v.toFixed(1)}<small>%</small>`;

  const slides = [
    { tab: 'Cuts follow scene changes', title: 'Systems with weaker multi-shot control tend to cut at scene changes.',
      claim: `With duration, shot count and transition type held fixed, ${sig.length} of 14 systems render ${Math.min(...sig.map(r => r.gap)).toFixed(0)}–${Math.max(...sig.map(r => r.gap)).toFixed(0)} points fewer requested cuts when consecutive shots stay in one location. The gap is largest for the four conventional T2V models; Kling 3.0, Seedance 2.0 and the multi-shot specialists show no significant gap. Rewriting single-scene scripts so that the second shot moves to a new location adds shot boundaries far more often than it removes them.`,
      stats: [[`${sig.length}<small> / 14</small>`, 'systems cut significantly less within a single scene'],
        [`${c1[0].gap.toFixed(1)}<small> pts</small>`, `largest gap (${c1[0].name}: ${c1[0].single.toFixed(0)}% vs ${c1[0].multi.toFixed(0)}%)`],
        ['32<small> vs 3</small>', 'boundaries added vs removed by a new location (24 scripts, 3 systems)']],
      implies: 'Future models need to decouple camera switches from changes of environment, e.g. by training on multi-angle coverage within shared scenes.',
      caption: 'Requested cuts rendered, single- vs. multi-scene scripts (4s + 8s)', draw: drawCut,
      note: 'Hollow: single-scene scripts · filled: multi-scene. Faded systems: gap not significant (95% CI includes 0).' },
    { tab: 'Structure ≠ transitions', title: 'Accurate shot structure does not imply accurate transitions.',
      claim: `Requested gradual transitions are most often rendered as hard cuts: a requested dissolve becomes a hard cut in ${f.dissolve_to_cut}% of cases and a dissolve in only ${f.dissolve_acc}%. The substitution does not shrink as shot structure improves: MSM and Kling 3.0 produce the requested shot count in ${msm.count_exact.toFixed(0)}% and ${k30.count_exact.toFixed(0)}% of videos, yet render more than 90% of requested gradual transitions as hard cuts.`,
      stats: [[pct(f.dissolve_to_cut), 'of requested dissolves come out as hard cuts'],
        [`+${(k30.count_exact - k26.count_exact).toFixed(0)}<small> pts</small>`, 'shot-count accuracy, Kling 2.6 → 3.0'],
        [`${k26.parts[0].toFixed(1)} → ${k30.parts[0].toFixed(1)}<small>%</small>`, 'gradual transitions with the requested type, Kling 2.6 → 3.0']],
      implies: 'Learning where shots change does not teach a model how they should change. Transition type needs its own conditioning and supervision, e.g. training clips with labelled transitions.',
      caption: 'Requested vs. rendered transitions', seg: [['sys', 'Per system'], ['conf', 'Confusion matrix']], draw: drawTrans,
      note: 'Per system: 4s + 8s, systems sorted by shot-count accuracy (right). Confusion matrix: all durations and systems, share of requests.' },
    { tab: 'Camera: common states only', title: 'Camera control is reliable mainly for common camera states.',
      claim: `Camera Control is low even for systems that render almost every requested shot, so the errors arise within the shots. On shots that are rendered, eye-level reaches ${ang['eye-level'].score.toFixed(1)} and a static camera ${mov.static.score.toFixed(1)}, whereas a tilted angle reaches ${ang.tilted.score.toFixed(1)} and a tracking shot ${mov.tracking.score.toFixed(1)}. When the request is missed, the detected state is most often a static camera, a wider framing or an eye-level view.`,
      stats: [[`${ang['eye-level'].score.toFixed(1)}`, 'eye-level angle, the most common request'], [`${ang.tilted.score.toFixed(1)}`, 'tilted angle, the hardest angle'],
        [`${mov.static.requested.toFixed(0)} → ${mov.static.detected.toFixed(0)}<small>%</small>`, 'share of rendered shots that are static: requested → detected']],
      implies: 'Stronger per-shot camera control may require rebalancing this long tail, e.g. targeted data and camera annotations for rare viewpoints, scales and movements.',
      caption: 'Camera Control by requested state (rendered shots, all systems)', seg: [['angle', 'Angle'], ['scale', 'Scale'], ['movement', 'Movement']], draw: drawCam,
      note: 'Movement: tilt and handheld have no direct FilmOps class and earn at most partial credit, so they are greyed out and not used for conclusions.' },
    { tab: 'More shots, less structure', title: 'Shot structure degrades on longer scripts with more shots.',
      claim: `For conventional T2V models, the share of videos with the requested shot count falls from ${conv.base[0].exact.toFixed(1)}% for two shots to ${conv.base.at(-1).exact.toFixed(1)}% for four, and on the 15s extension ${Math.min(...st15).toFixed(0)}–${Math.max(...st15).toFixed(0)}% of their videos are a single take. Native multi-shot T2V models hold up better but still decline from ${nat.base[0].exact.toFixed(1)}% to ${nat.base.at(-1).exact.toFixed(1)}%, increasingly by adding shots, while the specialists stay near 90%. Aesthetic Score is flat across all of these conditions.`,
      stats: [[`${conv.base[0].exact.toFixed(0)} → ${conv.base.at(-1).exact.toFixed(0)}<small>%</small>`, 'conventional T2V, correct shot count, 2 → 4 shots'],
        [`${nat.base[0].exact.toFixed(0)} → ${nat.base.at(-1).exact.toFixed(0)}<small>%</small>`, 'native multi-shot T2V, 2 → 4 shots'],
        [`${Math.min(...st15).toFixed(0)}–${Math.max(...st15).toFixed(0)}<small>%</small>`, 'single-take videos from the two open conventional models at 15s']],
      implies: 'Complex multi-shot capability has to be acquired through dedicated training; shot-level inputs that make the temporal layout explicit may help more than one long prompt.',
      caption: 'Videos with the requested shot count, by number of requested shots', draw: drawCount,
      note: `On the 15s extension the conventional group contains only Wan2.2 and HunyuanVideo 1.5. Specialists: ${spec.base.map(r => r.exact.toFixed(0)).join(' / ')}% at 2 / 3 / 4 shots.` },
    { tab: 'One score hides two failures', title: 'A combined score can mask opposite failure modes.',
      claim: `Multiplying validity by the score on valid videos, Veo 3.1 and MSM obtain ${veo.VS} and ${bgm.VS} on background consistency. Yet Veo 3.1 produces comparable shots in ${veo.V}% of scripts and keeps the background well (${veo.S}), whereas MSM produces them in ${bgm.V}% but preserves the background less (${bgm.S}). The two call for different remedies: realising the requested shots first, or carrying identity and background across them.`,
      stats: [[`${veo.VS} <small>vs</small> ${bgm.VS}`, 'combined background score, Veo 3.1 vs MSM'], [`${veo.V} <small>vs</small> ${bgm.V}`, 'validity (% scripts with comparable shots)'],
        [`${veo.S} <small>vs</small> ${bgm.S}`, 'score on valid videos']],
      implies: 'Multi-shot benchmarks should report validity and the score on valid videos separately, as the -V / -S columns of the leaderboard do.',
      caption: 'Validity vs. score on valid videos (4s + 8s)', seg: [['background', 'Background'], ['entity', 'Entity'], ['face', 'Face'], ['tc', 'Transition']], draw: drawValid,
      note: 'Grey curves connect equal products (validity × score). Points on the same curve tie on a combined score.' },
  ];

  const track = $('#fx-track'), tabs = $('#fx-tabs');
  slides.forEach((sl, i) => {
    const t = el('button', 'fx-tab', `<span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${sl.tab}</span>`);
    Object.assign(t, { role: 'tab', type: 'button' }); t.onclick = () => go(i); tabs.append(t);
    const s = el('article', 'fx-slide', `<div><div class="fx-kicker">Finding ${i + 1}</div><h3>${sl.title}</h3><p class="fx-claim">${sl.claim}</p>` +
      `<div class="fx-stats">${sl.stats.map(([n, t]) => `<div class="fx-stat"><b>${n}</b><span>${t}</span></div>`).join('')}</div>` +
      `<div class="fx-implies"><b>Implication.</b> ${sl.implies}</div></div>` +
      `<figure class="fx-fig"><figcaption><span>${sl.caption}</span>${sl.seg ? segHTML(sl.seg) : ''}</figcaption><div class="plot"></div><p class="fnote">${sl.note}</p></figure>`);
    s.setAttribute('aria-label', `Finding ${i + 1} of ${slides.length}`);
    track.append(s);
    const c = echarts.init(s.querySelector('.plot'), null, { renderer: 'svg' }); charts.push(c);
    sl.draw(c, sl.seg ? sl.seg[0][0] : null);
    const sg = s.querySelector('.seg');
    if (sg) sg.onclick = e => { const k = e.target.dataset.k; if (!k) return; [...sg.children].forEach(b => b.classList.toggle('on', b === e.target)); sl.draw(c, k); };
  });
  $('#fx-groups').innerHTML = Object.entries(GC).map(([g, c]) => `<span><i style="background:${c}"></i>${g}</span>`).join('');

  let cur = -1;
  const step = () => track.children.length > 1 ? track.children[1].offsetLeft - track.children[0].offsetLeft : track.clientWidth;
  const mark = i => {
    if (i === cur) return; cur = i;
    [...tabs.children].forEach((t, j) => { t.classList.toggle('on', i === j); t.setAttribute('aria-selected', i === j); });
    const t = tabs.children[i]; tabs.scrollTo({ left: t.offsetLeft - tabs.offsetLeft - 8, behavior: 'smooth' });
    $('#fx-prev').disabled = i === 0; $('#fx-next').disabled = i === slides.length - 1;
    $('#fx-count').textContent = `${i + 1} / ${slides.length}`;
  };
  let lock = null, unlock;  // while a tab/arrow scroll animates, ignore the intermediate positions
  const go = i => { i = Math.max(0, Math.min(slides.length - 1, i)); lock = i; clearTimeout(unlock);
    const x = i * step(); track.scrollTo({ left: x }); mark(i);
    unlock = setTimeout(() => {  // smooth scrolling can be skipped or throttled (background tabs); land on the slide anyway
      if (Math.abs(track.scrollLeft - x) > 2) { track.style.scrollBehavior = 'auto'; track.scrollLeft = x; track.style.scrollBehavior = ''; }
      lock = null; }, 900); };
  track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / step());
    if (lock !== null) { if (i === lock && Math.abs(track.scrollLeft - i * step()) < 2) lock = null; return; } mark(i); }, { passive: true });
  $('#fx-prev').onclick = () => go(cur - 1); $('#fx-next').onclick = () => go(cur + 1);
  $('#fx').addEventListener('keydown', e => {
    if (e.target.closest('.seg')) return;
    if (e.key === 'ArrowRight') { go(cur + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { go(cur - 1); e.preventDefault(); }
  });
  addEventListener('resize', () => { track.style.scrollBehavior = 'auto'; track.scrollLeft = cur * step(); track.style.scrollBehavior = ''; });
  mark(0);

  function drawCut(c) {
    const ink = r => r.sig ? 1 : .4;
    c.setOption({
      grid: { left: 8, right: 14, top: 8, bottom: 34, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,.03)' } },
        formatter: ps => { const r = c1[ps[0].dataIndex]; return `<b>${r.name}</b><br>single-scene ${r.single}%<br>multi-scene ${r.multi}%<br>gap ${r.gap} pts${r.sig ? '' : ' (n.s.)'}`; } },
      xAxis: { type: 'value', min: 0, max: 100, name: 'Requested cuts rendered (%)', nameGap: 24, ...NAMEAX, ...VAL },
      yAxis: { type: 'category', inverse: true, data: c1.map(r => r.name), ...AX,
        axisLabel: { ...FONT, fontSize: 12, formatter: (v, i) => c1[i].sig ? v : `{m|${v}}`, rich: { m: { color: '#a3a6ad', fontSize: 12 } } } },
      series: [
        { type: 'custom', silent: true, z: 1, encode: { x: [0, 1], y: 2 }, data: c1.map((r, i) => ({ value: [r.single, r.multi, i], itemStyle: { color: GC[r.group], opacity: ink(r) } })),
          renderItem: (p, api) => { const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)]);
            return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: api.visual('color'), lineWidth: 4, opacity: .28 * api.visual('opacity') } }; } },
        { name: 'single-scene', type: 'scatter', symbolSize: 11, z: 2, data: c1.map((r, i) => ({ value: [r.single, i], itemStyle: { color: '#fff', borderColor: GC[r.group], borderWidth: 2.2, opacity: ink(r) } })) },
        { name: 'multi-scene', type: 'scatter', symbolSize: 11, z: 3, data: c1.map((r, i) => ({ value: [r.multi, i], itemStyle: { color: GC[r.group], opacity: ink(r) } })) }] }, true);
  }

  function drawTrans(c, k) {
    if (k === 'conf') {
      const cf = ds.transition_confusion, cells = [];
      cf.rows.forEach((r, i) => r.pct.forEach((p, j) => cells.push([j, i, p])));
      c.setOption({ grid: { left: 8, right: 10, top: 30, bottom: 8, containLabel: true },
        tooltip: { formatter: p => `requested <b>${cf.requested[p.value[1]]}</b> → ${cf.generated[p.value[0]]}: <b>${p.value[2]}%</b> of ${cf.rows[p.value[1]].n}` },
        xAxis: { type: 'category', position: 'top', data: cf.generated, ...AX, axisLabel: { ...FONT, fontSize: 12.5, interval: 0 } },
        yAxis: { type: 'category', inverse: true, data: cf.requested, ...AX, axisLabel: { ...FONT, fontSize: 12.5 } },
        visualMap: { show: false, min: 0, max: 65, inRange: { color: ['#fbf3ee', '#f3b79f', '#e2572b'] } },
        series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
          label: { show: true, formatter: p => p.value[2].toFixed(0) + '%', ...FONT, fontSize: 13, fontWeight: 600 } }] }, true);
      return;
    }
    const parts = ['requested type', 'hard cut', 'other gradual', 'no transition'], pc = ['#0f9d7a', '#17181c', '#a9dccd', '#e4e0d8'];
    c.setOption({ legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 10, itemGap: 12, textStyle: { ...FONT, fontSize: 12 } },
      grid: { left: 8, right: 8, top: 32, bottom: 28, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,.03)' } },
        formatter: ps => `<b>${c2[ps[0].dataIndex].name}</b> · shot count ✓ ${c2[ps[0].dataIndex].count_exact}%<br>` + ps.map(p => `${p.marker}${p.seriesName}: ${p.value}%`).join('<br>') },
      xAxis: { type: 'value', max: 100, name: 'Requested gradual transitions (%)', nameGap: 22, ...NAMEAX, ...VAL },
      yAxis: [{ type: 'category', inverse: true, data: c2.map(r => r.name), ...AX, axisLabel: { ...FONT, fontSize: 12 } },
        { type: 'category', inverse: true, position: 'right', data: c2.map(r => `${r.count_exact.toFixed(0)}%`), ...AX,
          name: 'shots ✓', nameLocation: 'start', nameGap: 6, nameTextStyle: { ...FONT, fontSize: 11, color: '#646872' },
          axisLabel: { ...FONT, fontSize: 11.5, color: '#646872', fontFamily: 'JetBrains Mono, monospace' } }],
      series: parts.map((p, k) => ({ name: p, type: 'bar', stack: 't', barWidth: '64%', data: c2.map(r => r.parts[k]),
        itemStyle: { color: pc[k], borderRadius: k === 3 ? [0, 4, 4, 0] : 0 } })) }, true);
  }

  function drawCam(c, asp) {
    const rows = f.c3[asp], weak = s => s === 'tilt' || s === 'handheld';
    c.setOption({ grid: { left: 8, right: 40, top: 8, bottom: 28, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,.03)' } },
        formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.state}</b> · ${r.n} shots<br>Camera Control ${r.score}<br>requested ${r.requested ?? '–'}% · detected ${r.detected ?? '–'}% of rendered shots`; } },
      xAxis: { type: 'value', max: 100, name: 'Camera Control on rendered shots', nameGap: 22, ...NAMEAX, ...VAL },
      yAxis: { type: 'category', inverse: true, data: rows.map(r => r.state), ...AX, axisLabel: { ...FONT, fontSize: 12.5 } },
      series: [{ type: 'bar', barWidth: '58%', data: rows.map(r => ({ value: r.score,
        itemStyle: { color: weak(r.state) ? '#d8d4cb' : `rgba(15,157,122,${(.3 + .7 * r.score / 80).toFixed(2)})`, borderRadius: [0, 5, 5, 0] } })),
        label: { show: true, position: 'right', ...FONT, fontSize: 11.5, fontWeight: 600, formatter: p => p.value.toFixed(1) } }] }, true);
  }

  function drawCount(c) {
    const G = Object.keys(GC), tiers = [['base', 0, ['2', '3', '4']], ['15s', 1, ['4', '5', '6']]];
    c.setOption({ legend: { top: 0, left: 0, itemWidth: 16, itemHeight: 8, textStyle: { ...FONT, fontSize: 12 }, data: G },
      tooltip: { trigger: 'item', formatter: p => { const r = p.data.r; return `<b>${p.seriesName}</b> · ${p.data.tier}, ${r.shots} shots (${r.n} videos)<br>exact ${r.exact}% · fewer ${r.fewer}% · more ${r.more}%<br>single take ${r.single_take}%`; } },
      grid: [{ left: 50, right: '50%', top: 42, bottom: 44 }, { left: '56%', right: 12, top: 42, bottom: 44 }],
      xAxis: tiers.map(([t, i, d]) => ({ gridIndex: i, type: 'category', data: d, boundaryGap: false, name: i ? '15s · requested shots' : '4s / 8s · requested shots', nameGap: 26,
        ...NAMEAX, axisTick: { show: false }, axisLine: { lineStyle: { color: '#d9d5cc' } }, axisLabel: { ...FONT, fontSize: 12 } })),
      yAxis: tiers.map(([, i]) => ({ gridIndex: i, type: 'value', min: 0, max: 100, ...VAL, axisLabel: { ...FONT, fontSize: 11, show: !i, formatter: '{value}%' },
        name: i ? '' : 'Correct shot count', nameGap: 38, ...NAMEAX })),
      series: G.flatMap(g => tiers.map(([t, i]) => ({ name: g, type: 'line', xAxisIndex: i, yAxisIndex: i, symbol: 'circle', symbolSize: 8,
        lineStyle: { width: 2.5, type: i ? [6, 4] : 'solid' }, itemStyle: { color: GC[g] },
        data: (c4[g][t] || []).map(r => ({ value: r.exact, r, tier: t === 'base' ? '4s / 8s' : '15s' })) }))) }, true);
  }

  function drawValid(c, metric) {
    const pts = f.c5[metric], lo = Math.max(0, Math.floor(Math.min(...pts.map(p => p.S)) / 10) * 10 - 5), hi = 100;
    const hl = metric === 'background' ? ['veo', 'msm'] : [];
    const iso = [20, 40, 60, 80].map(v => ({ type: 'line', silent: true, symbol: 'none', z: 0, lineStyle: { color: '#dcd8d0', width: 1 },
      data: Array.from({ length: 60 }, (_, i) => { const x = v + (100 - v) * i / 59; return [x, 100 * v / x]; }).filter(([, y]) => y >= lo && y <= hi),
      endLabel: { show: true, formatter: `${v}`, ...FONT, fontSize: 10.5, color: '#a3a6ad' } }));
    c.setOption({ grid: { left: 8, right: 26, top: 14, bottom: 34, containLabel: true },
      tooltip: { trigger: 'item', formatter: p => p.data && p.data.p ? `<b>${p.data.p.name}</b><br>validity ${p.data.p.V}% · score ${p.data.p.S}<br>product ${p.data.p.VS}` : '' },
      xAxis: { type: 'value', min: 0, max: 100, name: 'Validity (% of scripts that can be scored)', nameGap: 24, ...NAMEAX, ...VAL },
      yAxis: { type: 'value', min: lo, max: hi, name: 'Score on valid videos', nameGap: 34, ...NAMEAX, ...VAL },
      series: [...iso, { type: 'scatter', z: 3, data: pts.map(p => ({ value: [p.V, p.S], p, symbolSize: hl.includes(p.id) ? 16 : 11,
        itemStyle: { color: GC[p.group], borderColor: hl.includes(p.id) ? '#17181c' : '#fff', borderWidth: hl.includes(p.id) ? 2 : 1, opacity: hl.length && !hl.includes(p.id) ? .55 : .95 },
        label: { show: hl.includes(p.id), formatter: p.name, position: p.id === 'msm' ? 'left' : 'top', ...FONT, fontSize: 12.5, fontWeight: 600 } })) }] }, true);
  }
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
    $('#lb-note').textContent = (state.split === '15s' ? 'The 15s split has 50 scripts and covers the ten systems that support 15-second generation. ' : '') +
      'Brackets under Final are 95% bootstrap confidence intervals (not computed for MAGI-2, added after the paper). -V columns are validity rates; the paired column is the score on valid videos.';
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
Promise.all(['dataset', 'explorer', 'metrics', 'leaderboard'].map(n => fetch(`data/${n}.json`, { cache: 'no-cache' }).then(r => r.json())))
  .then(([ds, ex, mt, lb]) => { $('#lb-srcc').textContent = (ds.human_srcc / 100).toFixed(2); overview(ds, ex); datasetCharts(ds); findings(ds); evaluation(mt); leaderboard(lb); });
