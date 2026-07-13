# Research — Maffetone Book Principles → Rule Thresholds

Source: `docs/the-big-book-of-endurance-training-and-racing.pdf` (Dr. Phil Maffetone, 895pg). Page cites = PDF page (extraction-mapped).

## CH3 — Developing Maximum Aerobic Function (p100–137)
- **180 Formula** (p~488): 180 − age, then category adjust — (a) illness/meds −10; (b) injured/regressed/inconsistent/≥2 colds-flu per yr/allergy/asthma −5; (c) 2yr consistent, no issues = same; (d) 2yr+ progress no injury +5. Under-16 → 165. Over-65 cat-d → up to +10. (App already computes mafHr via profile.)
- **MAF zone = maxAerobicHR down to 10 beats below** (p609–612): "training range from this heart rate to 10 beats below … 155 → 145–155 bpm." ✓ **matches app zone `{lower: mafHr-10, upper: mafHr}`.**
- **Above MAF HR = anaerobic** (p564–567): "Training above this heart rate rapidly incorporates anaerobic function … shift to burning more sugar and less fat for fuel." At/below = "highly aerobic, most efficiently build an aerobic base."

## CH4 — MAF Test (p137–162)
- **Warm-up mandatory** before MAF assessment (p39).
- **Normal split pattern = progressive slowing** (p55–64): first mile fastest, each ensuing mile slightly slower (normal fatigue). **If NOT (you speed up later) → warm-up was inadequate.**
- **Progress signal** (p75–76): faster pace at same HR = aerobic development; plateau/stop = development slowing → possible imbalance.
- **Heat/humidity slows pace at same HR** (p219–220): hot humid summer / dry desert heat expected to degrade performance → don't misread heat-driven drift as pure deconditioning.

## CH5 — Warming Up / Cooling Down (p162–182)
- **Warm-up ≥12–15 min, gradual HR rise** (p74, p95–97): e.g. HR 60s → 130–140 over 15 min.
- **No warm-up → bodily stress, abnormal heart rates, higher injury risk** (p27–28, p48).
- Workouts >90 min → extend warm-up (p98–100). Cool-down also important. Active, not stretching.

## CH8 — Overtraining Syndrome (p228–253)
- **Overtraining = imbalance in Work + Rest** (p16).
- **First objective sign = abnormal MAF-test plateau/regression** (p165).
- Signs: **elevated resting HR**, reduced HR variability, low body temp, fatigue, more infections (p144–169). Autonomic imbalance (too much sympathetic).

## CH9 — Personalize Your Training (p253–265)
- **"Less means success"** (p53, p62–63): less weekly training hours → better recovery, less stress, aerobic system builds better.
- **≥1 rest day/week; 2 even better** for some (p297–299). Consider job/life stress (p305).
- Lower-volume athletes perform as well or better than high-volume (p148–149).

## Metric → Rule Mapping (for the engine)
| Metric we already compute | Book grounding | Finding / rec |
|---|---|---|
| `verdict` above/in/below + `timeInZone.abovePct` | CH3 aerobic vs anaerobic | TIER + zone-distribution finding |
| `cardiacDrift` % (<5 / ≥5) | CH4 aerobic dev, CH8 overtraining, CH4 heat | drift finding + hydration/heat rec |
| first `splits` HR vs zone / speed-up pattern | CH5 warm-up, CH4 split pattern | warm-up finding + warm-up rec |
| `verdict==above` on an easy/base run | CH8 Work+Rest, CH9 less-means-success | overreach finding + rest-day rec |
| `aerobicEfficiency` (m/beat) | CH4 MAF-test progress | context note ("track m/beat trend") |

## Proposed thresholds (to codify)
- **TIER**: effective-aerobic = `abovePct < 10 && (drift==null || drift < 5)`; mixed = `abovePct 10–40`; above-zone = `abovePct > 40 || verdict==above`.
- **Drift**: good `< 5`, warn `>= 5` (already used by cardiac-drift-card — reuse constant).
- **Warm-up flag**: first split `average_heartrate > zone.upper` (started too hot) OR first split not the slowest when a later split is faster at similar/higher HR (approx; keep simple — flag "started above zone").
- **Overreach**: `verdict.status==='above'` AND activity is Run/Walk (base-type) AND `movingTime` >= ~20min (not a deliberate short interval workout).

## Unresolved Questions
- Do we know if a given run was *intended* as a workout vs base run? No explicit tag from Strava. Mitigation: treat all as base-run coaching (Maffetone's default), phrase recs as "if this was an easy/base run …" to avoid false alarms on intentional speed sessions.
