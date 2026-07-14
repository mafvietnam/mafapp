import { CoachingController } from './coaching.controller.js';
import type { CoachingService } from './coaching.service.js';
import type { Request } from 'express';

describe('CoachingController.getToday', () => {
  it('delegates to CoachingService.getToday with the JWT userId, returning its result verbatim', async () => {
    const expected = {
      source: 'template' as const,
      narrative: 'x',
      recommendation: null,
    };
    const getToday = jest.fn().mockResolvedValue(expected);
    const service = { getToday } as unknown as CoachingService;
    const controller = new CoachingController(service);

    const req = {
      user: { id: 'user-42', email: 'a@b.com', role: 'USER' },
    } as unknown as Request;
    const result = await controller.getToday(req);

    expect(getToday).toHaveBeenCalledWith('user-42');
    expect(result).toBe(expected);
  });
});
