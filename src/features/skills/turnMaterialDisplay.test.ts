import { describe, expect, it } from 'vitest';

import {
  materialListKeys,
  materialStableKey,
  turnMaterialLabel,
} from './turnMaterialDisplay';

describe('turnMaterialDisplay', () => {
  it('builds shared labels', () => {
    expect(turnMaterialLabel({ type: 'node', nodeId: 'n1' })).toBe('节点 n1');
    expect(
      turnMaterialLabel({ type: 'image', origin: 'upload', assetId: 9, name: ' shot.png ' }),
    ).toBe('image · shot.png');
    expect(turnMaterialLabel({ type: 'video', origin: 'library', assetId: 3 })).toBe('video #3');
  });

  it('builds stable keys and duplicate-safe list keys without array index', () => {
    expect(materialStableKey({ type: 'node', nodeId: 'n1' })).toBe('node:n1');
    expect(
      materialStableKey({ type: 'image', origin: 'upload', assetId: 9, name: 'x' }),
    ).toBe('image:9');
    expect(
      materialListKeys(
        [
          { type: 'image', origin: 'upload', assetId: 1 },
          { type: 'image', origin: 'upload', assetId: 1 },
          { type: 'node', nodeId: 'n1' },
        ],
        'inline',
      ),
    ).toEqual(['inline:image:1', 'inline:image:1~2', 'inline:node:n1']);
  });
});
