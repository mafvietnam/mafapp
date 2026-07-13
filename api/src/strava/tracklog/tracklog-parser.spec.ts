import {
  detectFormat,
  parseTracklog,
  summarize,
} from './tracklog-parser.js';
import {
  InvalidTracklogError,
  UnsupportedTracklogError,
  type RawParse,
} from './tracklog-types.js';
import { GPX_WITH_HR } from './gpx-parser.spec.js';
import { TCX_TREADMILL } from './tcx-parser.spec.js';

const buf = (s: string) => Buffer.from(s, 'utf-8');

describe('detectFormat', () => {
  it('detects gpx and tcx, rejects unknown', () => {
    expect(detectFormat('<?xml?><gpx></gpx>')).toBe('gpx');
    expect(detectFormat('<?xml?><TrainingCenterDatabase>')).toBe('tcx');
    expect(() => detectFormat('<html></html>')).toThrow(UnsupportedTracklogError);
  });
});

describe('parseTracklog (GPX with HR, end-to-end)', () => {
  const r = parseTracklog(buf(GPX_WITH_HR), 'run.gpx');

  it('computes distance via haversine + HR stats + avgSpeed (RT-H1)', () => {
    expect(r.type).toBe('Run');
    expect(r.startDate.toISOString()).toBe('2026-07-12T00:00:00.000Z');
    expect(r.distance).toBeGreaterThan(210); // ~222m over 2 x 0.001deg lat
    expect(r.distance).toBeLessThan(235);
    expect(r.elapsedTime).toBe(60);
    expect(r.movingTime).toBe(60); // 3.7 m/s > threshold both segments
    expect(r.avgHeartRate).toBe(140);
    expect(r.maxHeartRate).toBe(150);
    expect(r.avgSpeed).toBeGreaterThan(3); // ~3.7 m/s
    expect(r.totalElevationGain).toBe(2); // 10->12 (+2), 12->11 ignored
  });
});

describe('parseTracklog (TCX treadmill)', () => {
  it('uses explicit DistanceMeters (no GPS needed)', () => {
    const r = parseTracklog(buf(TCX_TREADMILL), 'tread.tcx');
    expect(r.distance).toBe(200);
    expect(r.movingTime).toBe(60);
    expect(r.avgSpeed).toBeCloseTo(200 / 60, 2);
    expect(r.calories).toBe(15);
  });
});

describe('summarize validation', () => {
  const base: RawParse = {
    name: 'x',
    type: 'Run',
    calories: null,
    points: [],
    distanceHint: null,
    movingTimeHint: null,
  };

  it('rejects <2 points', () => {
    expect(() => summarize({ ...base, points: [{ t: 1 }] })).toThrow(InvalidTracklogError);
  });

  it('rejects invalid/absent start time (route GPX, RT-M3)', () => {
    expect(() =>
      summarize({ ...base, points: [{ t: NaN }, { t: NaN }] }),
    ).toThrow(InvalidTracklogError);
  });

  it('rejects a file with neither distance nor HR', () => {
    const t0 = Date.parse('2026-07-12T00:00:00Z');
    expect(() =>
      summarize({
        ...base,
        points: [
          { t: t0 },
          { t: t0 + 30000 },
        ],
      }),
    ).toThrow(InvalidTracklogError);
  });

  it('clamps out-of-range HR when averaging (RT-H4)', () => {
    const t0 = Date.parse('2026-07-12T00:00:00Z');
    const r = summarize({
      ...base,
      distanceHint: 100,
      points: [
        { t: t0, hr: 500 }, // out of range → ignored
        { t: t0 + 30000, hr: 140 },
        { t: t0 + 60000, hr: 150 },
      ],
    });
    expect(r.avgHeartRate).toBe(145); // (140+150)/2
    expect(r.maxHeartRate).toBe(150);
  });
});
