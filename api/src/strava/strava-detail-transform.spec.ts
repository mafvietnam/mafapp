import {
  whitelistDetail,
  computeStride,
  downsampleStreams,
  type StravaDetailRaw,
  type StravaStreamSet,
} from './strava-detail-transform.js';

/**
 * Pure-function coverage for whitelist + downsample transforms. No HTTP/Prisma — mirrors how
 * StravaSyncService.upsertActivity's field-mapping is unit-tested in isolation from the fetch.
 */

describe('whitelistDetail', () => {
  it('maps whitelisted fields and drops everything else (incl. laps)', () => {
    const raw = {
      description: 'Easy MAF run',
      device_name: 'Garmin Forerunner 265',
      gear: { name: 'Nike Pegasus' },
      calories: 412, // real kcal (distinct from summary row's kilojoules)
      splits_metric: [
        {
          distance: 1000.2,
          elapsed_time: 300,
          elevation_difference: 2.1,
          moving_time: 298,
          split: 1,
          average_speed: 3.33,
          average_heartrate: 140.5,
          pace_zone: 2,
          extra_undocumented_field: 'should not leak',
        },
      ],
      laps: [{ id: 1, name: 'Lap 1' }], // must be dropped entirely
      athlete: { id: 999 }, // must never leak
      map: { polyline: 'abc' }, // must never leak
    } as unknown as StravaDetailRaw;

    const result = whitelistDetail(raw);

    expect(result).toEqual({
      description: 'Easy MAF run',
      deviceName: 'Garmin Forerunner 265',
      gearName: 'Nike Pegasus',
      calories: 412,
      splitsMetric: [
        {
          distance: 1000.2,
          elapsed_time: 300,
          elevation_difference: 2.1,
          moving_time: 298,
          split: 1,
          average_speed: 3.33,
          average_heartrate: 140.5,
          pace_zone: 2,
        },
      ],
    });
    expect(result).not.toHaveProperty('laps');
    expect(result).not.toHaveProperty('athlete');
    expect(result).not.toHaveProperty('map');
    expect(
      (result.splitsMetric[0] as Record<string, unknown>)
        .extra_undocumented_field,
    ).toBeUndefined();
  });

  it('defaults missing optional fields to null / empty array', () => {
    const result = whitelistDetail({} as StravaDetailRaw);
    expect(result).toEqual({
      description: null,
      deviceName: null,
      gearName: null,
      calories: null,
      splitsMetric: [],
    });
  });

  it('handles gear being null (manual entry, no shoe tagged)', () => {
    const result = whitelistDetail({ gear: null } as StravaDetailRaw);
    expect(result.gearName).toBeNull();
  });
});

describe('computeStride', () => {
  it('returns 1 when len <= cap (no downsampling needed)', () => {
    expect(computeStride(500, 1000)).toBe(1);
    expect(computeStride(1000, 1000)).toBe(1);
  });

  it('rounds up so sampled length never exceeds cap', () => {
    expect(computeStride(3600, 1000)).toBe(4); // ceil(3600/1000) = 4
    expect(Math.ceil(3600 / 4)).toBeLessThanOrEqual(1000);
  });
});

describe('downsampleStreams', () => {
  function makeStream(len: number, offset = 0): { data: number[] } {
    return { data: Array.from({ length: len }, (_, i) => i + offset) };
  }

  it('returns null when rawStreams is null/undefined', () => {
    expect(downsampleStreams(null)).toBeNull();
    expect(downsampleStreams(undefined)).toBeNull();
  });

  it('returns null when time or heartrate stream is missing (nothing chartable)', () => {
    expect(
      downsampleStreams({ heartrate: makeStream(10) } as StravaStreamSet),
    ).toBeNull();
    expect(
      downsampleStreams({ time: makeStream(10) } as StravaStreamSet),
    ).toBeNull();
  });

  it('returns null when time/heartrate arrays are empty', () => {
    expect(
      downsampleStreams({
        time: { data: [] },
        heartrate: { data: [] },
      } as StravaStreamSet),
    ).toBeNull();
  });

  it('downsamples a 3600-point stream to <=1000 with correct stride + aligned arrays', () => {
    const raw: StravaStreamSet = {
      time: makeStream(3600),
      heartrate: makeStream(3600, 100),
      velocity_smooth: makeStream(3600, 200),
      altitude: makeStream(3600, 300),
      distance: makeStream(3600, 400),
    };
    const result = downsampleStreams(raw, 1000)!;

    expect(result.time!.length).toBeLessThanOrEqual(1000);
    expect(result.time!.length).toBe(result.heartrate!.length);
    expect(result.time!.length).toBe(result.velocitySmooth!.length);
    expect(result.time!.length).toBe(result.altitude!.length);
    expect(result.time!.length).toBe(result.distance!.length);

    // Alignment: same-index sample across all arrays (offset preserved => same relative position)
    expect(result.heartrate![0]).toBe(result.time![0] + 100);
    expect(result.velocitySmooth![1]).toBe(result.time![1] + 200);

    // stride = ceil(3600/1000) = 4 -> index 0,4,8,...
    expect(result.time![1]).toBe(4);
  });

  it('omits stream keys not present in raw input', () => {
    const raw: StravaStreamSet = {
      time: makeStream(50),
      heartrate: makeStream(50, 10),
    };
    const result = downsampleStreams(raw, 1000)!;
    expect(result.time).toBeDefined();
    expect(result.heartrate).toBeDefined();
    expect(result.velocitySmooth).toBeUndefined();
    expect(result.altitude).toBeUndefined();
    expect(result.distance).toBeUndefined();
  });

  it('truncates to shortest common length when heartrate is shorter than time (dropped HR strap) — no interior undefined', () => {
    const raw: StravaStreamSet = {
      time: makeStream(100),
      heartrate: makeStream(40, 1000), // strap dropped after 40 pts
      distance: makeStream(100, 2000),
    };
    const result = downsampleStreams(raw, 1000)!;

    // common length = 40 (shortest of time=100, heartrate=40, distance=100)
    expect(result.time!.length).toBe(40);
    expect(result.heartrate!.length).toBe(40);
    expect(result.distance!.length).toBe(40);
    // No undefined/NaN anywhere in the sampled arrays
    for (const arr of [result.time!, result.heartrate!, result.distance!]) {
      for (const v of arr) {
        expect(v).not.toBeUndefined();
        expect(Number.isNaN(v)).toBe(false);
      }
    }
    expect(result.time![result.time!.length - 1]).toBeLessThan(40);
  });

  it('result length never exceeds cap even for huge streams', () => {
    const raw: StravaStreamSet = {
      time: makeStream(36000),
      heartrate: makeStream(36000),
    };
    const result = downsampleStreams(raw, 1000)!;
    expect(result.time!.length).toBeLessThanOrEqual(1000);
  });
});
