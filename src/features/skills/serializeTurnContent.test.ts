import { describe, expect, it } from 'vitest';

import {
  buildTurnContentBlocks,
  buildTurnUserInput,
  compileHumanTextFromBlocks,
  displayTextFromUserMessage,
  extractSkillPathsFromInput,
  parseUserInputSnapshot,
} from './serializeTurnContent';

describe('serializeTurnContent', () => {
  it('buildTurnContentBlocks puts skills before text and dedupes paths', () => {
    expect(buildTurnContentBlocks('hello', ['a/b', 'c/d', 'a/b'])).toEqual([
      { type: 'skill', path: 'a/b' },
      { type: 'skill', path: 'c/d' },
      { type: 'text', text: 'hello' },
    ]);
    expect(buildTurnContentBlocks('  ', ['skill/path'])).toEqual([{ type: 'skill', path: 'skill/path' }]);
  });

  it('buildTurnUserInput accepts explicit materials', () => {
    const materials = [{ type: 'image' as const, origin: 'upload' as const, assetId: 42, name: 'shot.png' }];
    expect(buildTurnUserInput('q', ['x'], materials)).toEqual({
      content: [
        { type: 'skill', path: 'x' },
        { type: 'text', text: 'q' },
      ],
      materials,
    });
    expect(buildTurnUserInput('q', ['x']).materials).toEqual([]);
  });

  it('parseUserInputSnapshot round-trips valid snapshots with media, node, and materials', () => {
    const input = buildTurnUserInput('question', ['demo/skill'], [
      { type: 'image', origin: 'upload', assetId: 7, name: 'ref.png' },
    ]);
    expect(parseUserInputSnapshot(input)).toEqual(input);
    expect(
      parseUserInputSnapshot({
        content: [
          { type: 'text', text: 'see node' },
          { type: 'node', nodeId: 'node-1' },
          { type: 'image', origin: 'library', assetId: 3 },
        ],
        materials: [{ type: 'file', origin: 'upload', assetId: 9, name: 'notes.pdf' }],
      }),
    ).toEqual({
      content: [
        { type: 'text', text: 'see node' },
        { type: 'node', nodeId: 'node-1' },
        { type: 'image', origin: 'library', assetId: 3 },
      ],
      materials: [{ type: 'file', origin: 'upload', assetId: 9, name: 'notes.pdf' }],
    });
    expect(parseUserInputSnapshot({ content: [{ type: 'skill', path: 'x' }], materials: [1] })).toBeNull();
    expect(parseUserInputSnapshot({ content: [{ type: 'skill', path: 'x' }], materials: 'bad' })).toBeNull();
  });

  it('display and extract helpers read structured input', () => {
    const input = buildTurnUserInput('question', ['demo/skill']);
    expect(displayTextFromUserMessage(input, 'fallback')).toBe('question');
    expect(displayTextFromUserMessage(null, 'fallback')).toBe('fallback');
    expect(extractSkillPathsFromInput(input)).toEqual(['demo/skill']);
  });

  it('compileHumanTextFromBlocks matches backend format', () => {
    expect(
      compileHumanTextFromBlocks([
        { type: 'text', text: 'question' },
        { type: 'skill', path: 'demo/skill' },
        { type: 'node', nodeId: 'node-abc' },
        { type: 'image', origin: 'upload', assetId: 12 },
      ]),
    ).toBe('question\n[skill:demo/skill]\n[node:node-abc]\n[image:asset_id=12]');
  });
});
