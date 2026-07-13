# Phase 01 — Backend date-range query

## Context links
- Brainstorm: `plans/reports/brainstorm-260713-1452-running-journal.md` (Backend section)
- DTO: `api/src/strava/dto/strava-activity-query.dto.ts`
- Service: `api/src/strava/strava.service.ts` (`getActivities`, line 120)
- Controller (unchanged): `api/src/strava/strava.controller.ts:135` (`@Get('activities')`, `JwtAuthGuard`)
- Test conventions: `api/src/strava/strava.service.spec.ts`

## Overview
- **Priority:** P1 (blocks Phase 03 frontend)
- **Status:** pending
- Add optional `since`/`until` ISO-date filters to activity list query; relax `limit` Max 100→365. No new model/endpoint.

## Key insights
- `getActivities` already builds a `where` object scoped by `userId` (+ optional `type`, `isDuplicate`). Only need to add a conditional `startDate` clause.
- `startDate` is a Prisma `DateTime`. Half-open interval `gte: since, lt: until` tiles cleanly with the frontend's back-to-back 6-month windows (no double count on boundary).
- `class-validator` `@IsDateString()` validates ISO 8601 — no custom validator needed.

## Requirements
**Functional**
- `since?` / `until?`: optional ISO 8601 date strings, validated.
- When present, filter `stravaActivity.startDate` `>= since` AND `< until`.
- `limit` may now be up to 365 (was 100).

**Non-functional**
- Backward compatible: params optional; existing callers (dashboard, limit≤20) unaffected.
- No perf regression: `startDate` filter uses existing index-friendly ordering (`orderBy startDate desc`).

## Architecture
```
Query DTO (validated) ──▶ StravaService.getActivities(userId, query)
  where = { userId,
            [type],
            [isDuplicate:false],
            [startDate: { gte:new Date(since), lt:new Date(until) }] }
  ──▶ prisma.$transaction([findMany(where,skip,take), count(where)])
  ──▶ { data, total, page, limit }
```
Data in: `userId` (from JwtAuthGuard), `page`, `limit`, `type?`, `excludeDuplicates?`, `since?`, `until?`.
Data out: unchanged `{ data: StravaActivity[], total, page, limit }`.

## Related code files
**Modify**
- `api/src/strava/dto/strava-activity-query.dto.ts` — add `since`/`until`; change `@Max(100)` → `@Max(365)`.
- `api/src/strava/strava.service.ts` — extend `where` type + conditional `startDate` clause in `getActivities`.
- `api/src/strava/strava.service.spec.ts` — add where-clause tests for `getActivities`.

**Create**
- `api/src/strava/dto/strava-activity-query.dto.spec.ts` — DTO validation tests.

**Delete:** none.

## Implementation steps
1. **DTO** — in `strava-activity-query.dto.ts`:
   - Change `@Max(100)` on `limit` to `@Max(365)`.
   - Add two optional fields after `excludeDuplicates`:
     ```ts
     @IsOptional()
     @IsDateString()
     since?: string;

     @IsOptional()
     @IsDateString()
     until?: string;
     ```
   - Add `IsDateString` to the `class-validator` import line.
2. **Service** — in `getActivities`, widen the `where` type and append the clause after the `excludeDuplicates` line:
   ```ts
   const where: {
     userId: string;
     type?: string;
     isDuplicate?: boolean;
     startDate?: { gte?: Date; lt?: Date };
   } = { userId };
   if (query.type) where.type = query.type;
   if (query.excludeDuplicates) where.isDuplicate = false;
   if (query.since || query.until) {
     where.startDate = {};
     if (query.since) where.startDate.gte = new Date(query.since);
     if (query.until) where.startDate.lt = new Date(query.until);
   }
   ```
   Leave `skip`/`take`/`orderBy`/`$transaction` untouched.
3. **DTO test** (`strava-activity-query.dto.spec.ts`) — use `plainToInstance` + `validate` (mirror any existing dto spec; if none, `import { validate } from 'class-validator'` + `import { plainToInstance } from 'class-transformer'`):
   - valid ISO `since`/`until` → 0 errors.
   - non-date string (`'not-a-date'`) for `since` → error on `since`.
   - `limit: 365` → valid; `limit: 366` → error; `limit: 100` → still valid.
   - all of `since`/`until` omitted → valid (optional).
4. **Service test** (append to `strava.service.spec.ts`) — extend the prisma mock in `buildService` with `stravaActivity.findMany` + `stravaActivity.count` + `$transaction` (impl: `(ops) => Promise.all(ops)`), then assert the `where` passed to `findMany`:
   - `since`+`until` present → `where.startDate = { gte: Date, lt: Date }`.
   - only `since` → `where.startDate = { gte }` (no `lt`).
   - neither → no `startDate` key.
   - combined with `excludeDuplicates:true` + `type:'Run'` → all keys present alongside `userId`.
5. **Verify:** `cd api && npx tsc --noEmit && npm test -- strava.service strava-activity-query` (or full `npm test`).

## Todo
- [ ] DTO: `since`/`until` + `@Max(365)`
- [ ] Service: conditional `startDate` where clause + widened type
- [ ] DTO validation spec
- [ ] Service where-clause spec
- [ ] `tsc --noEmit` + jest green

## Success criteria
- `GET /strava/activities?since=2026-01-01&until=2026-07-01&limit=365&excludeDuplicates=true` returns only that user's rows in range.
- Invalid `since` → 400 (class-validator).
- All new + existing strava jest specs pass; `tsc` clean.

## Risk assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `new Date(invalid)` → `Invalid Date` slips to Prisma | Low | Med | DTO `@IsDateString` rejects before service; service only reached with valid strings |
| Boundary double-count across windows | Low | Med | Half-open `gte`/`lt` (documented); frontend tiles windows edge-to-edge |
| Large `limit=365` heavy query | Low | Low | Single user's rows, indexed `startDate` order; ~180 rows/6mo typical |

## Security considerations
- `where.userId` always applied first → `since`/`until` only narrow within caller's own activities.
- Endpoint already guarded by `JwtAuthGuard` (`strava.controller.ts:136`); `userId` derived server-side from `req.user`, never client-supplied. No new surface.

## Next steps
- Unblocks **Phase 03** (frontend client `getStravaActivities` gains `since`/`until`; `use-journal-activities` calls it).
- No dependency on Phase 02.
</content>
