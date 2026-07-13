/**
 * TCX parser — richest for HR + explicit DistanceMeters (survives GPS-less treadmill runs).
 * Multisport files (multiple <Activity>) → pick the first Running block, else the first (RT-M9).
 */
import { XMLParser } from 'fast-xml-parser';
import {
  type RawParse,
  type TrackPoint,
  InvalidTracklogError,
  MAX_TRACKPOINTS,
  cleanName,
  mapActivityType,
  num,
  toArray,
} from './tracklog-types.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
});

type Obj = Record<string, unknown>;

/** Choose the first Sport="Running" activity, else the first present. */
function pickActivity(activities: Obj[]): Obj {
  const running = activities.find(
    (a) => String(a['@_Sport'] ?? '').toLowerCase() === 'running',
  );
  return running ?? activities[0] ?? {};
}

export function parseTcx(xml: string): RawParse {
  const root = (parser.parse(xml) as { TrainingCenterDatabase?: Obj })
    .TrainingCenterDatabase;
  const activities = toArray(root?.Activities as Obj | undefined).flatMap((a) =>
    toArray((a as Obj).Activity),
  ) as Obj[];
  const activity = pickActivity(activities);
  const laps = toArray(activity.Lap) as Obj[];

  let distanceHint = 0;
  let movingTimeHint = 0;
  let calories = 0;
  const rawPts: Obj[] = [];

  for (const lap of laps) {
    distanceHint += num(lap.DistanceMeters) ?? 0;
    movingTimeHint += num(lap.TotalTimeSeconds) ?? 0;
    calories += num(lap.Calories) ?? 0;
    for (const track of toArray(lap.Track)) {
      const pts = toArray((track as Obj).Trackpoint) as Obj[];
      if (rawPts.length + pts.length > MAX_TRACKPOINTS) {
        throw new InvalidTracklogError('File quá lớn (quá nhiều điểm)');
      }
      rawPts.push(...pts);
    }
  }

  const points: TrackPoint[] = rawPts.map((p) => {
    const pos = p.Position as Obj | undefined;
    const hrObj = p.HeartRateBpm as Obj | undefined;
    return {
      t: new Date(String(p.Time ?? '')).getTime(),
      lat: num(pos?.LatitudeDegrees),
      lon: num(pos?.LongitudeDegrees),
      ele: num(p.AltitudeMeters),
      hr: num(hrObj?.Value ?? p.HeartRateBpm),
      distM: num(p.DistanceMeters),
    };
  });

  return {
    name: cleanName(activity.Notes ?? activity.Id, 'Hoạt động tải lên'),
    type: mapActivityType(activity['@_Sport']),
    calories: calories > 0 ? Math.round(calories) : null,
    points,
    distanceHint: distanceHint > 0 ? distanceHint : null,
    movingTimeHint: movingTimeHint > 0 ? movingTimeHint : null,
  };
}
