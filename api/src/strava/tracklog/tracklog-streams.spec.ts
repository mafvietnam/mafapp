import { buildStreams } from './tracklog-streams.js';
import { type TrackPoint } from './tracklog-types.js';

const t0 = Date.parse('2026-07-12T00:00:00Z');
const pt = (i: number, over: Partial<TrackPoint> = {}): TrackPoint => ({
  t: t0 + i * 10000,
  lat: 10 + i * 0.001,
  lon: 106,
  ...over,
});

describe('buildStreams', () => {
  it('emits time+heartrate+velocity+distance aligned to points', () => {
    const s = buildStreams([pt(0, { hr: 130 }), pt(1, { hr: 140 }), pt(2, { hr: 150 })]);
    expect(s).not.toBeNull();
    expect(s!.time).toEqual([0, 10, 20]);
    expect(s!.heartrate).toEqual([130, 140, 150]);
    expect(s!.velocitySmooth).toHaveLength(3);
    expect(s!.distance).toHaveLength(3);
  });

  it('clamps out-of-range HR (0 / >300) via forward-fill — no phantom below-zone samples (H1)', () => {
    const s = buildStreams([
      pt(0, { hr: 130 }),
      pt(1, { hr: 0 }), // strap dropout → must NOT become a real 0 reading
      pt(2, { hr: 999 }), // glitch spike → ignored
      pt(3, { hr: 145 }),
    ]);
    expect(s!.heartrate).toEqual([130, 130, 130, 145]);
    expect(s!.heartrate!.some((h) => h === 0 || h > 300)).toBe(false);
  });

  it('returns null when no point has valid HR (detail page hides chart, MAF degrades)', () => {
    const s = buildStreams([pt(0), pt(1), pt(2)]);
    expect(s).toBeNull();
  });
});
