import { parseGpx } from './gpx-parser.js';

const GPX_WITH_HR = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata><time>2026-07-12T00:00:00Z</time></metadata>
  <trk>
    <name>Morning MAF Run</name>
    <type>9</type>
    <trkseg>
      <trkpt lat="10.0000" lon="106.0000"><ele>10</ele><time>2026-07-12T00:00:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>130</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="10.0010" lon="106.0000"><ele>12</ele><time>2026-07-12T00:00:30Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="10.0020" lon="106.0000"><ele>11</ele><time>2026-07-12T00:01:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const GPX_NO_HR = `<?xml version="1.0"?>
<gpx creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>No HR</name><trkseg>
    <trkpt lat="10.0000" lon="106.0000"><time>2026-07-12T00:00:00Z</time></trkpt>
    <trkpt lat="10.0010" lon="106.0000"><time>2026-07-12T00:00:30Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

const GPX_NS3_HR = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><trkseg>
    <trkpt lat="10.0" lon="106.0"><time>2026-07-12T00:00:00Z</time>
      <extensions><ns3:TrackPointExtension><ns3:hr>128</ns3:hr></ns3:TrackPointExtension></extensions></trkpt>
  </trkseg></trk>
</gpx>`;

describe('parseGpx', () => {
  it('extracts points, HR (gpxtpx namespace), name, and run type', () => {
    const r = parseGpx(GPX_WITH_HR);
    expect(r.points).toHaveLength(3);
    expect(r.name).toBe('Morning MAF Run');
    expect(r.type).toBe('Run');
    expect(r.points.map((p) => p.hr)).toEqual([130, 140, 150]);
    expect(r.points[0].lat).toBeCloseTo(10, 4);
    expect(r.points[0].ele).toBe(10);
    expect(r.distanceHint).toBeNull();
    expect(r.calories).toBeNull();
  });

  it('handles a GPX without HR extensions (hr undefined, coords intact)', () => {
    const r = parseGpx(GPX_NO_HR);
    expect(r.points).toHaveLength(2);
    expect(r.points.every((p) => p.hr === undefined)).toBe(true);
    expect(r.points[0].lat).toBeCloseTo(10, 4);
  });

  it('reads HR from the ns3: namespace variant', () => {
    const r = parseGpx(GPX_NS3_HR);
    expect(r.points[0].hr).toBe(128);
  });

  it('throws on non-GPX / malformed root', () => {
    expect(() => parseGpx('<notgpx></notgpx>')).toThrow();
  });
});

export { GPX_WITH_HR, GPX_NO_HR };
