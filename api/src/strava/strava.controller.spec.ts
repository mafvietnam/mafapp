import { ConflictException } from '@nestjs/common';
import type { Request } from 'express';
import { StravaController } from './strava.controller.js';
import type { StravaService } from './strava.service.js';
import type { StravaAuthService } from './strava-auth.service.js';
import type { StravaSyncService } from './strava-sync.service.js';
import type { StravaDetailService } from './strava-detail.service.js';
import type { ConfigService } from '@nestjs/config';

/** RED TEAM #H6: /strava/connect must 409 when the slot cap is reached for a new connection, but exempt reconnects. */
describe('StravaController.getConnectUrl — slot cap guard', () => {
  const req = { user: { id: 'user-1' } } as unknown as Request;

  function buildController(isNewConnectionBlocked: boolean) {
    const isNewConnectionBlockedMock = jest
      .fn()
      .mockResolvedValue(isNewConnectionBlocked);
    const getAuthorizationUrl = jest
      .fn()
      .mockResolvedValue('https://strava.example/auth');

    const stravaService = {
      isNewConnectionBlocked: isNewConnectionBlockedMock,
    } as unknown as StravaService;
    const authService = {
      getAuthorizationUrl,
    } as unknown as StravaAuthService;
    const syncService = {} as unknown as StravaSyncService;
    const detailService = {} as unknown as StravaDetailService;
    const config = {
      get: jest.fn().mockReturnValue('http://localhost:5173'),
    } as unknown as ConfigService;

    const controller = new StravaController(
      stravaService,
      authService,
      syncService,
      detailService,
      config,
    );
    return { controller, isNewConnectionBlockedMock, getAuthorizationUrl };
  }

  it('throws 409 ConflictException for a genuinely new connection when the cap is reached', async () => {
    const { controller } = buildController(true);
    await expect(controller.getConnectUrl(req)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns the auth URL for a reconnecting athlete even when the cap is reached (exempt)', async () => {
    // isNewConnectionBlocked already accounts for the reconnect exemption — false means "not blocked"
    const { controller, getAuthorizationUrl } = buildController(false);
    const result = await controller.getConnectUrl(req);
    expect(result).toEqual({ authUrl: 'https://strava.example/auth' });
    expect(getAuthorizationUrl).toHaveBeenCalledWith('user-1');
  });
});
