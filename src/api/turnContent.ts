/** Turn content blocks — aligned with generated turn_content.d.ts (type required for wire). */

export type TurnTextBlock = {
  type: 'text';
  text: string;
};

export type TurnSkillBlock = {
  type: 'skill';
  path: string;
};

export type TurnContentBlock = TurnTextBlock | TurnSkillBlock;

export type TurnUserInput = {
  content: TurnContentBlock[];
  materials: [];
};
