import { parseTcx } from './tcx-parser.js';

const TCX_TREADMILL = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-12T00:00:00Z</Id>
      <Lap StartTime="2026-07-12T00:00:00Z">
        <TotalTimeSeconds>60</TotalTimeSeconds>
        <DistanceMeters>200</DistanceMeters>
        <Calories>15</Calories>
        <Track>
          <Trackpoint><Time>2026-07-12T00:00:00Z</Time><DistanceMeters>0</DistanceMeters>
            <HeartRateBpm><Value>130</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-07-12T00:00:30Z</Time><DistanceMeters>100</DistanceMeters>
            <HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
          <Trackpoint><Time>2026-07-12T00:01:00Z</Time><DistanceMeters>200</DistanceMeters>
            <HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

const TCX_MULTISPORT = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking"><Id>bike</Id>
      <Lap><TotalTimeSeconds>10</TotalTimeSeconds><DistanceMeters>50</DistanceMeters><Track>
        <Trackpoint><Time>2026-07-12T00:00:00Z</Time><DistanceMeters>0</DistanceMeters></Trackpoint>
      </Track></Lap></Activity>
    <Activity Sport="Running"><Id>run</Id>
      <Lap><TotalTimeSeconds>30</TotalTimeSeconds><DistanceMeters>100</DistanceMeters><Track>
        <Trackpoint><Time>2026-07-12T00:00:00Z</Time><DistanceMeters>0</DistanceMeters>
          <HeartRateBpm><Value>135</Value></HeartRateBpm></Trackpoint>
        <Trackpoint><Time>2026-07-12T00:00:30Z</Time><DistanceMeters>100</DistanceMeters>
          <HeartRateBpm><Value>145</Value></HeartRateBpm></Trackpoint>
      </Track></Lap></Activity>
  </Activities>
</TrainingCenterDatabase>`;

describe('parseTcx', () => {
  it('parses HR + explicit distance for a GPS-less treadmill run', () => {
    const r = parseTcx(TCX_TREADMILL);
    expect(r.points).toHaveLength(3);
    expect(r.type).toBe('Run');
    expect(r.distanceHint).toBe(200);
    expect(r.movingTimeHint).toBe(60);
    expect(r.calories).toBe(15);
    expect(r.points.map((p) => p.hr)).toEqual([130, 140, 150]);
    expect(r.points.every((p) => p.lat === undefined)).toBe(true); // no GPS
    expect(r.points[2].distM).toBe(200);
  });

  it('picks the first Running activity from a multisport file (RT-M9)', () => {
    const r = parseTcx(TCX_MULTISPORT);
    expect(r.type).toBe('Run');
    expect(r.points).toHaveLength(2); // running block only
    expect(r.points[0].hr).toBe(135);
    expect(r.distanceHint).toBe(100);
  });
});

export { TCX_TREADMILL };
