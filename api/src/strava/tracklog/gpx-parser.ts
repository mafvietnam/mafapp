/**
 * GPX parser — extracts trackpoints (lat/lon/ele/time/HR) from a GPX 1.1 document.
 * HR read from Garmin TrackPointExtension; `removeNSPrefix` strips gpxtpx:/ns3: variants (RT: namespace).
 * fast-xml-parser does NOT resolve DTDs/entities → no XXE (defense is structural, not optional).
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

/** Pull HR from a trkpt's extensions (TrackPointExtension.hr, or a bare hr fallback). */
function extractHr(trkpt: Record<string, unknown>): number | undefined {
  const ext = trkpt.extensions as Record<string, unknown> | undefined;
  if (!ext) return undefined;
  const tpe = ext.TrackPointExtension as Record<string, unknown> | undefined;
  return num(tpe?.hr ?? ext.hr);
}

export function parseGpx(xml: string): RawParse {
  const root = (parser.parse(xml) as { gpx?: Record<string, unknown> }).gpx;
  if (!root) throw new InvalidTracklogError('GPX không hợp lệ');

  const trks = toArray(root.trk as unknown);
  const firstTrk = (trks[0] ?? {}) as Record<string, unknown>;
  const metadata = root.metadata as Record<string, unknown> | undefined;

  // Collect trkpt across all trk/trkseg, with an early size cap (RT-H3).
  const rawPts: Record<string, unknown>[] = [];
  for (const trk of trks) {
    for (const seg of toArray((trk as Record<string, unknown>).trkseg)) {
      const pts = toArray((seg as Record<string, unknown>).trkpt) as Record<string, unknown>[];
      if (rawPts.length + pts.length > MAX_TRACKPOINTS) {
        throw new InvalidTracklogError('File quá lớn (quá nhiều điểm)');
      }
      rawPts.push(...pts);
    }
  }

  const points: TrackPoint[] = rawPts.map((p) => {
    const t = new Date(String(p.time ?? '')).getTime();
    return {
      t,
      lat: num(p['@_lat']),
      lon: num(p['@_lon']),
      ele: num(p.ele),
      hr: extractHr(p),
    };
  });

  return {
    name: cleanName(firstTrk.name ?? metadata?.name, 'Hoạt động tải lên'),
    type: mapActivityType(firstTrk.type),
    calories: null, // GPX carries no calories
    points,
    distanceHint: null, // GPX has no explicit distance — computed via haversine downstream
    movingTimeHint: null,
  };
}
