import type { WorkshopToolCapability } from '../types';

export type CapabilityTier = 'read' | 'store_write' | 'compute';

const READ_CAPABILITIES = new Set<WorkshopToolCapability>([
  'web_search',
  'web_fetch_readonly',
  'read_uploads',
  'read_project_files',
  'browser_read',
  'propose_invite',
]);

const STORE_WRITE_CAPABILITIES = new Set<WorkshopToolCapability>([
  'write_project_files',
  'write_temp_workspace',
  'browser_write',
  'taobao_store_write',
]);

const COMPUTE_CAPABILITIES = new Set<WorkshopToolCapability>([
  'sandbox_execute',
  'generation_submit',
  'generation_list_models',
  'create_schedule',
  'mcp',
]);

export function summarizeCapabilities(
  allowlist: WorkshopToolCapability[] | undefined,
): Record<CapabilityTier, WorkshopToolCapability[]> {
  const read: WorkshopToolCapability[] = [];
  const store_write: WorkshopToolCapability[] = [];
  const compute: WorkshopToolCapability[] = [];

  for (const capability of allowlist ?? []) {
    if (READ_CAPABILITIES.has(capability)) read.push(capability);
    if (STORE_WRITE_CAPABILITIES.has(capability)) store_write.push(capability);
    if (COMPUTE_CAPABILITIES.has(capability)) compute.push(capability);
  }

  return { read, store_write, compute };
}

export function capabilityTierLabels(): Record<CapabilityTier, string> {
  return {
    read: '读取',
    store_write: '店铺写入',
    compute: '计算/提交',
  };
}
