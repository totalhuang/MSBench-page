# MSBench project page

Static site (no build step) meant for GitHub Pages. Everything on the page is read from `data/*.json`.

```
index.html              page structure and copy
static/css/style.css    styles
static/js/main.js       timeline player, charts (ECharts from CDN), leaderboard
static/videos/          transcoded showcase clips
data/                   generated JSON, do not edit by hand
tools/build_data.py     regenerates data/ and static/videos/ from the MSBench working tree
tools/metrics_meta.json metric names and descriptions shown in the Evaluation section
```

## Preview

```bash
python3 -m http.server 8770 --directory .
```

## Refresh the numbers

`tools/build_data.py` reads the MSBench tree (two levels up by default, or `MSBENCH_ROOT`): `data/benchmark.json`,
`paper_final_20261113/out/*.json`, `paper_findings_20261114/out/findings.json` (the five findings), `final_scores.jsonl`, `transitions.jsonl`
and the appendix metric-visualisation picks.

```bash
FFMPEG=/path/to/ffmpeg python3 tools/build_data.py     # add --no-video to skip transcoding
```

After a new leaderboard round, rerun the paper pipeline, rerun this script, commit `data/`.

## Still placeholders

Paper / Code / Dataset links, the submission form link, the script download link and the BibTeX entry.
