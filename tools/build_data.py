#!/usr/bin/env python3
"""Export everything the project page reads, from the MSBench working tree.

  python3 tools/build_data.py            # JSON + videos
  python3 tools/build_data.py --no-video # JSON only

Inputs (read-only): data/benchmark.json, paper_final_20261113/out/analysis.json, the generated
human-agreement table, final_scores.jsonl, transitions.jsonl and the appendix metric-visualisation picks.
Outputs: data/*.json and static/videos/** inside this site directory.
"""
import collections, json, os, pathlib, re, subprocess, sys

SITE = pathlib.Path(__file__).resolve().parents[1]
ROOT = pathlib.Path(os.environ.get('MSBENCH_ROOT', SITE.parents[1]))
DEV = ROOT / '.local/development'
PAPER = ROOT / '.local/papers/CVPR_2027_MSBench'
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
DATA, VID = SITE / 'data', SITE / 'static/videos'

GROUPS = [('Conventional T2V', [('kling', 'Kling 2.6'), ('hailuo', 'Hailuo 2.3'), ('wan2.2', 'Wan2.2'), ('hunyuanvideo', 'HunyuanVideo 1.5')]),
          ('Native Multi-shot T2V', [('sora2', 'Sora2 Pro'), ('veo', 'Veo 3.1'), ('wan', 'Wan2.6'), ('jimeng', 'Jimeng 3.0 Pro'),
                                     ('seedance2.0', 'Seedance 2.0'), ('kling3.0', 'Kling 3.0'), ('h3', 'MiniMax H3')]),
          ('Multi-shot Specialist', [('holocine', 'HoloCine'), ('msm', 'MSM'), ('vgot', 'VGoT')])]
NAME = {k: v for _, g in GROUPS for k, v in g}
OPEN = {'wan2.2', 'hunyuanvideo', 'h3', 'holocine', 'msm', 'vgot'}
COLS = [('AS', 'aesthetic'), ('PS', 'perceptual'), ('DD', 'dynamic_degree'), ('PP', 'physical'), ('VQA', 'vqa'),
        ('TC-V', 'tc_V'), ('TC-A', 'tc_A'), ('CTA', 'cta'), ('CC-V', 'cc_V'), ('CC', 'camera_control'),
        ('CSEC-V', 'entity_V'), ('CSEC-S', 'entity_S'), ('CSBC-V', 'background_V'), ('CSBC-S', 'background_S'),
        ('CSFC-V', 'face_V'), ('CSFC-S', 'face_S'), ('VQ', 'VQ'), ('DQ', 'DQ'), ('SA', 'SA'), ('CSC', 'CSC'), ('Final', 'final')]

A = json.loads((DEV / 'paper_final_20261113/out/analysis.json').read_text())
B = json.loads((ROOT / 'data/benchmark.json').read_text())
SCORES = {}
for line in (DEV / 'final_eval_20261108/results/final_scores.jsonl').read_text().splitlines():
    r = json.loads(line); SCORES[r['key']] = r
TRANS = {}
for line in (DEV / 'paper_final_20261113/snapshot/transitions.jsonl').read_text().splitlines():
    r = json.loads(line); TRANS[r['sample_id']] = r

jobs = []  # (src, dst, vf)


def r1(v):
    return None if v is None else round(v, 1)


def script(sid):
    b = B[sid]
    shots = [{'start': float(s['start_time']), 'end': float(s['end_time']), 'camera': s['camera'], 'description': s['description'],
              'transition': None if s['transition']['type'] == 'None' else
              {'type': s['transition']['type'], 'duration': float(s['transition'].get('duration') or 0)}} for s in b['shot_sequence']]
    return {'id': sid, 'type': b['type'], 'topic': b['topic'], 'duration': b['duration_s'], 'shots': shots,
            'entities': [{'id': e['id'], 'caption': e['caption']} for e in b['entities_info']['entities']],
            'context': b['global_context']}


def video(key, sub, height):
    model, sid = key.split('__')
    dst = VID / sub / f'{model}__{sid}.mp4'
    jobs.append((ROOT / 'gen_videos' / model / f'{sid}.mp4', dst, f'scale=-2:{height}'))
    s, t = SCORES[key], TRANS.get(key, {})
    return {'key': key, 'model': NAME[model], 'src': str(dst.relative_to(SITE)),
            'scores': {k: r1(None if s.get(k) is None else 100 * s[k]) for k in ('VQ', 'DQ', 'SA', 'CSC', 'final')},
            'detected': [{'start': p['start'], 'end': p['end'], 'type': p['type']} for p in t.get('pred', [])],
            'length': t.get('duration_s')}


# ---- leaderboard
splits = {'base': '4s + 8s', '4s': '4s', '8s': '8s', '15s': '15s'}
board = {'columns': [c for c, _ in COLS], 'splits': splits, 'groups': [g for g, _ in GROUPS], 'models': []}
for g, ms in GROUPS:
    for m, name in ms:
        row = {'id': m, 'name': name, 'group': g, 'open': m in OPEN, 'scores': {}}
        for sp in splits:
            d = A['model'].get(f'{m}|{sp}')
            if d:
                row['scores'][sp] = {c: r1(d.get(k)) for c, k in COLS}
        for sp in ('base', '15s'):
            ci = A.get(f'ci|{sp}', {}).get(m)
            if ci:
                row.setdefault('ci', {})[sp] = [r1(ci['lo']), r1(ci['hi'])]
        board['models'].append(row)

# ---- dataset statistics
C = collections.Counter
stats = {k: C() for k in ('duration', 'type', 'topic', 'shots', 'transition', 'angle', 'scale', 'movement')}
links = C()
for b in B.values():
    dur, typ, n = f"{b['duration_s']}s", b['type'], f"{b['shots_num']} shots"
    stats['duration'][dur] += 1; stats['type'][typ] += 1; stats['topic'][b['topic']] += 1; stats['shots'][n] += 1
    links[(dur, typ)] += 1; links[(typ, n)] += 1
    for s in b['shot_sequence']:
        if s['transition']['type'] != 'None':
            stats['transition'][s['transition']['type']] += 1
        for a in ('angle', 'scale', 'movement'):
            stats[a][s['camera'][a]] += 1
dataset = {'n_scripts': len(B), 'n_shots': sum(b['shots_num'] for b in B.values()),
           'n_videos': len(SCORES), 'n_models': len(NAME),
           'stats': {k: sorted(v.items(), key=lambda kv: -kv[1]) for k, v in stats.items()},
           'sankey': [{'source': a, 'target': b, 'value': v} for (a, b), v in links.items()]}

# requested vs. generated transition type (base split), rows = requested
kinds = ['hard cut', 'dissolve', 'fade', 'wipe']
conf = {'requested': kinds, 'generated': kinds + ['none'], 'rows': []}
for k in kinds:
    d = A['transition'][f'base|{k}']
    conf['rows'].append({'n': d['n'], 'acc': r1(d['acc']), 'pct': [r1(100 * d.get(g, 0) / d['n']) for g in conf['generated']]})
dataset['transition_confusion'] = conf
ML = json.loads((DEV / 'paper_final_20261113/out/model_level.json').read_text())
dataset['human_srcc'] = r1(100 * ML['final_vs_pairwise_bt']['vs_auto_base']['srcc'])

# ---- metrics and their high / low examples (appendix metric visualisation picks)
human = {}
for line in (PAPER / 'tables/gen/human_main_body.tex').read_text().splitlines():
    m = re.search(r'&\s*([A-Z]+)(?:\$\^\\dagger\$)?\s*&\s*([\d.]+)\s*&\s*([\d.]+)\s*&\s*([\d.]+)\s*&\s*([\d.]+)', line)
    if m:
        human[m.group(1)] = {'srcc': float(m.group(2)), 'model': float(m.group(5))}
META = json.loads((SITE / 'tools/metrics_meta.json').read_text())
audit = json.loads((DEV / 'metric_vis_20261113/v6/sampling_audit.json').read_text())
for dim in META:
    for mt in dim['metrics']:
        ex = {}
        for tag in ('high', 'low'):
            a = audit[f"{mt['example']}/{tag}"]
            ex[tag] = {**video(a['key'], 'metrics', 360), 'score': r1(a['score_0_100'])}
        mt['examples'] = ex
        mt['script'] = script(audit[f"{mt['example']}/high"]['key'].split('__')[1])
        mt['human'] = [human[h] | {'name': h} for h in mt['human_keys'] if h in human]

# ---- script explorer: two scripts per duration, three best systems and the weakest one
by_script = collections.defaultdict(list)
for k, s in SCORES.items():
    if s.get('final') is not None:
        by_script[s['sample_id']].append(s)
explorer, used_topics = [], set()
for dur, min_shots in ((4, 2), (8, 3), (15, 4)):
    cands = []
    for sid, rows in by_script.items():
        b = B[sid]
        kinds_ = {s['transition']['type'] for s in b['shot_sequence']} - {'None', 'hard cut'}
        if b['duration_s'] == dur and b['shots_num'] >= min_shots and kinds_ and len(rows) >= 6:
            top = sorted(rows, key=lambda r: -r['final'])
            cands.append((sum(r['final'] for r in top[:3]) - top[-1]['final'], sid, top))
    n = 0
    for _, sid, top in sorted(cands, reverse=True):
        if B[sid]['topic'] in used_topics:
            continue
        used_topics.add(B[sid]['topic']); n += 1
        explorer.append({**script(sid), 'videos': [video(r['key'], 'explorer', 480) for r in top[:3] + top[-1:]]})
        if n == 2:
            break

# ---- hero mosaic: 18 four-second clips, two per system, highest visual quality
hero, seen = [], set()
for m in ('seedance2.0', 'veo', 'wan', 'kling3.0', 'h3', 'jimeng', 'sora2', 'kling', 'wan2.2'):
    rows = sorted((s for s in SCORES.values() if s['model'] == m and s['duration_s'] == 4 and s['sample_id'] not in seen),
                  key=lambda r: -(r['VQ'] or 0))[:2]
    for r in rows:
        seen.add(r['sample_id']); hero.append(ROOT / 'gen_videos' / m / f"{r['sample_id']}.mp4")

DATA.mkdir(exist_ok=True)
for name, obj in (('leaderboard', board), ('dataset', dataset), ('metrics', META), ('explorer', explorer)):
    (DATA / f'{name}.json').write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')))
print('json written:', len(board['models']), 'models,', len(explorer), 'explorer scripts,', len(jobs), 'videos')

if '--no-video' not in sys.argv:
    for src, dst, vf in jobs:
        if dst.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', str(src), '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '27',
                        '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dst)], check=True)
    out = VID / 'hero.mp4'
    if not out.exists():
        cols, w, h = 6, 320, 180
        cmd = [FFMPEG, '-v', 'error', '-y']
        for p in hero:
            cmd += ['-t', '4', '-i', str(p)]
        f = ''.join(f'[{i}:v]fps=24,scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1[v{i}];' for i in range(len(hero)))
        f += ''.join(f'[v{i}]' for i in range(len(hero))) + f'xstack=inputs={len(hero)}:layout=' + \
            '|'.join(f'{(i % cols) * w}_{(i // cols) * h}' for i in range(len(hero))) + '[o]'
        subprocess.run(cmd + ['-filter_complex', f, '-map', '[o]', '-an', '-t', '4', '-c:v', 'libx264', '-crf', '28', '-preset', 'slow',
                              '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out)], check=True)
    total = sum(p.stat().st_size for p in VID.rglob('*.mp4'))
    print(f'videos: {len(list(VID.rglob("*.mp4")))} files, {total / 1e6:.1f} MB')
