/**
 * Backwards-compatibility re-export shim.
 * GarminEncryptionService was moved to api/src/shared/garmin-encryption.service.ts.
 * This alias is kept for one release cycle — remove after consumers update imports.
 */
export { GarminEncryptionService } from '../shared/garmin-encryption.service.js';
