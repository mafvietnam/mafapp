/**
 * Backwards-compatibility re-export shim.
 * AdminSettingsService was moved to AppSettingsService in shared/app-settings.service.ts.
 * This alias is kept for one release cycle — remove after all consumers are updated.
 */
export { AppSettingsService as AdminSettingsService } from '../shared/app-settings.service.js';
