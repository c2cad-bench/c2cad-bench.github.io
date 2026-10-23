# C2CAD-Bench

Website and interactive evaluation explorer for **C2CAD-Bench**, a large-scale
benchmark for 3D spatial reasoning in LLMs. Models receive natural-language
engineering specifications and return deterministic JSON geometry, scored against
parametric ground truth without code execution or rendering.

## What is in this repository

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page: abstract, benchmark structure, 3D showcase, leaderboard, analysis, citation |
| `ui/results.html` | Full scoreboard with phase filters, model toggles and CSV export |
| `ui/visualizer.html` | Side-by-side 3D inspection of ground truth and model output |
| `css/` | Design system and page styles |
| `js/` | Scoreboard, 3D showcase, visualizer and shared site interactions |
| `results/` | Benchmark database (`showcase_db*.js`) and figures |

## Local development

Serve the repository over HTTP (ES modules and the JSON databases will not load
correctly from `file://`):

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Data format

`results/showcase_db.js` exposes `window.SHOWCASE_DB`:

```js
{
  golden: [{ family, difficultyLabel, difficultyID, phase, prompt, shapes }],
  models: {
    "model-id": [{ family, difficultyID, phase, shapes, score_cov, score_geom, score_sem, score_global }]
  }
}
```

The visualizer loads the four phase-specific databases
(`results/showcase_db_p1.js` … `p4.js`) to keep initial payloads smaller.

## Features

- Light and dark themes with persistence
- Live 3D showcase with orbit controls
- Expandable family/level score breakdowns
- Phase filtering and model column toggles
- CSV export of all per-case scores
- Deep links to visualizer phase, model and family
- Keyboard accessible lightbox and navigation
- Responsive layouts and reduced-motion support
