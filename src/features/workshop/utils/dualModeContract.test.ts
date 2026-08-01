import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('超级工坊 dual-mode intent', () => {
  it('removes frontend regex upgradeIntent module', () => {
    const upgradeIntentPath = path.join(__dirname, 'upgradeIntent.ts');
    expect(() => readFileSync(upgradeIntentPath, 'utf8')).toThrow();
  });
});
