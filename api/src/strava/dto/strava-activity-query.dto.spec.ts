import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { StravaActivityQueryDto } from './strava-activity-query.dto.js';

/** Validate a plain query object the way the global ValidationPipe would (implicit conversion on). */
async function validateQuery(raw: Record<string, unknown>) {
  const dto = plainToInstance(StravaActivityQueryDto, raw, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  const props = errors.map((e) => e.property);
  return { dto, errors, props };
}

describe('StravaActivityQueryDto — since/until validation', () => {
  it('accepts valid ISO since + until', async () => {
    const { errors } = await validateQuery({
      since: '2026-01-01',
      until: '2026-07-01',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts full ISO 8601 datetime strings', async () => {
    const { errors } = await validateQuery({
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-07-01T00:00:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-date string for since', async () => {
    const { props } = await validateQuery({ since: 'not-a-date' });
    expect(props).toContain('since');
  });

  it('treats since/until as optional (omitted → valid)', async () => {
    const { errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
  });
});

describe('StravaActivityQueryDto — limit bounds (relaxed 100 → 365)', () => {
  it('accepts limit=365', async () => {
    const { props } = await validateQuery({ limit: 365 });
    expect(props).not.toContain('limit');
  });

  it('still accepts the old limit=100', async () => {
    const { props } = await validateQuery({ limit: 100 });
    expect(props).not.toContain('limit');
  });

  it('rejects limit=366 (above new cap)', async () => {
    const { props } = await validateQuery({ limit: 366 });
    expect(props).toContain('limit');
  });

  it('rejects limit=0 (below min)', async () => {
    const { props } = await validateQuery({ limit: 0 });
    expect(props).toContain('limit');
  });
});

describe('StravaActivityQueryDto — page offset cap (DoS guard)', () => {
  it('accepts a reasonable page', async () => {
    const { props } = await validateQuery({ page: 5 });
    expect(props).not.toContain('page');
  });

  it('rejects an absurd page depth above the offset cap', async () => {
    const { props } = await validateQuery({ page: 100001 });
    expect(props).toContain('page');
  });
});
