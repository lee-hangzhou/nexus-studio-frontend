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

  it('buildTurnUserInput always uses empty materials', () => {
    expect(buildTurnUserInput('q', ['x'])).toEqual({
      content: [
        { type: 'skill', path: 'x' },
        { type: 'text', text: 'q' },
      ],
      materials: [],
    });
  });

  it('parseUserInputSnapshot round-trips valid snapshots', () => {
    const input = buildTurnUserInput('question', ['demo/skill']);
    expect(parseUserInputSnapshot(input)).toEqual(input);
    expect(parseUserInputSnapshot({ content: [{ type: 'skill', path: 'x' }], materials: [1] })).toBeNull();
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
      ]),
    ).toBe('question\n[skill:demo/skill]');
  });
});
