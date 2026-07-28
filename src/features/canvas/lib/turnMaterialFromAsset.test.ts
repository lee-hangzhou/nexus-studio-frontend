import { describe, expect, it } from 'vitest';

import type { TurnMaterialBlock } from '../../skills/types';
import {
  materialStableKey,
  mediaBlockTypeFromAsset,
  toWireMaterials,
  turnMaterialFromAgentAsset,
} from './turnMaterialFromAsset';

describe('turnMaterialFromAsset', () => {
  it('maps mime/asset_type to media block type', () => {
    expect(mediaBlockTypeFromAsset({ asset_type: 'image', mime_type: 'image/png' })).toBe('image');
    expect(mediaBlockTypeFromAsset({ asset_type: 'text', mime_type: 'video/mp4' })).toBe('video');
    expect(mediaBlockTypeFromAsset({ asset_type: 'text', mime_type: 'application/pdf' })).toBe('file');
  });

  it('builds wire-safe materials without local previewUrl', () => {
    const asset = {
      id: 7,
      project_id: 1,
      filename: 'shot.png',
      mime_type: 'image/png',
      asset_type: 'image',
      source_type: 'agent_upload',
      preview_url: 'https://cdn.example/shot.png',
    };
    expect(turnMaterialFromAgentAsset(asset)).toEqual({
      type: 'image',
      origin: 'upload',
      assetId: 7,
      name: 'shot.png',
    });
  });

  it('strips non-video previewUrl on the wire', () => {
    const materials: TurnMaterialBlock[] = [
      {
        type: 'image',
        origin: 'upload',
        assetId: 1,
        name: 'a.png',
        previewUrl: 'blob:http://local/1',
      },
      {
        type: 'video',
        origin: 'upload',
        assetId: 2,
        name: 'b.mp4',
        previewUrl: 'https://cdn.example/thumb.jpg',
      },
      { type: 'node', nodeId: 'n1' },
    ];
    expect(toWireMaterials(materials)).toEqual([
      { type: 'image', origin: 'upload', assetId: 1, name: 'a.png' },
      {
        type: 'video',
        origin: 'upload',
        assetId: 2,
        name: 'b.mp4',
        previewUrl: 'https://cdn.example/thumb.jpg',
      },
      { type: 'node', nodeId: 'n1' },
    ]);
  });

  it('builds stable keys without index', () => {
    expect(materialStableKey({ type: 'node', nodeId: 'n1' })).toBe('node:n1');
    expect(
      materialStableKey({ type: 'image', origin: 'upload', assetId: 9, name: 'x' }),
    ).toBe('image:9');
  });
});
