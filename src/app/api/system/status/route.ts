import { apiOk, apiError } from '@/lib/api-response';
import { systemInitService } from '@/services/system-init.service';
import { ensureDataSource } from '@/server/db/ensureDataSource';

/**
 * GET /api/system/status
 * Returns whether the system (System Admin) has been initialized.
 */
export async function GET() {
  try {
    await ensureDataSource();
    const admin = await systemInitService.getSystemAdmin();
    return apiOk({ initialized: !!admin });
  } catch (error) {
    console.error('Error in GET /api/system/status:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500, 'INTERNAL_ERROR');
  }
}
