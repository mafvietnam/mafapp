import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StravaUploadService } from './strava-upload.service.js';
import { GPX_WITH_HR } from './tracklog/gpx-parser.spec.js';

const buf = Buffer.from(GPX_WITH_HR, 'utf-8');

/** Build the service with a fully-mocked prisma whose $transaction runs the callback against `tx`. */
function buildService() {
  const tx = {
    stravaActivity: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'act-1' }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'act-1' }),
    },
    stravaActivityDetail: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    stravaActivity: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    garminActivity: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const service = new StravaUploadService(prisma as never);
  return { service, prisma, tx };
}

describe('StravaUploadService.ingest', () => {
  it('creates a source=UPLOAD activity + detail with HR streams, deterministic id', async () => {
    const { service, tx } = buildService();
    const res = await service.ingest('user-1', buf, 'run.gpx');

    expect(res.id).toBe('act-1');
    expect(res.duplicate).toBe(false);

    const createArg = tx.stravaActivity.create.mock.calls[0][0];
    expect(createArg.data.source).toBe('UPLOAD');
    expect(createArg.data.userId).toBe('user-1');
    expect(String(createArg.data.stravaActivityId)).toMatch(/^upload_/);
    expect(createArg.data.avgHeartRate).toBe(140);
    expect(createArg.data.avgPace).toBeGreaterThan(0);
    expect(createArg.data.calories).toBeNull(); // kcal not written to kJ summary col (RT-M6)

    const detailArg = tx.stravaActivityDetail.create.mock.calls[0][0];
    expect(detailArg.data.streamsJson).toBeTruthy(); // has HR → streams present
    expect((detailArg.data.detailJson as { deviceName: string }).deviceName).toContain('GPX');
  });

  it('is idempotent — same file re-uploads to the same id without a second create', async () => {
    const { service, prisma, tx } = buildService();
    const first = await service.ingest('user-1', buf, 'run.gpx');
    const firstId = tx.stravaActivity.create.mock.calls[0][0].data.stravaActivityId;

    // Second time the row exists → updateMany matches, create is skipped.
    tx.stravaActivity.updateMany.mockResolvedValueOnce({ count: 1 });
    tx.stravaActivity.create.mockClear();
    const second = await service.ingest('user-1', buf, 'run.gpx');
    const secondId = tx.stravaActivity.findFirstOrThrow.mock.calls[0][0].where.stravaActivityId;

    expect(secondId).toBe(firstId); // deterministic content hash
    expect(tx.stravaActivity.create).not.toHaveBeenCalled();
    expect(first.id).toBe(second.id);
    void prisma;
  });

  it('flags the upload as duplicate when a synced STRAVA run overlaps (±5min, RT-C2)', async () => {
    const { service, prisma } = buildService();
    prisma.stravaActivity.findFirst.mockResolvedValue({ id: 'strava-1' });

    const res = await service.ingest('user-1', buf, 'run.gpx');

    expect(res.duplicate).toBe(true);
    expect(prisma.stravaActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isDuplicate: true } }),
    );
  });

  it('refuses (ConflictException) rather than overwrite a globally-unique id owned by another user (RT-C1)', async () => {
    const { service, tx } = buildService();
    tx.stravaActivity.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(service.ingest('user-1', buf, 'run.gpx')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
