export type {
  TurnMediaType,
  TurnMediaOrigin,
  TurnTextBlock,
  TurnSkillBlock,
  TurnMediaBlock,
  TurnNodeBlock,
  TurnUserInput,
} from './generated/turn_content';

import type {
  TurnTextBlock,
  TurnSkillBlock,
  TurnMediaBlock,
  TurnNodeBlock,
} from './generated/turn_content';

/** 内容块联合；成员形状以 generated/turn_content 为唯一源 */
export type TurnContentBlock =
  | TurnTextBlock
  | TurnSkillBlock
  | TurnMediaBlock
  | TurnNodeBlock;

/** 素材块联合；成员形状以 generated/turn_content 为唯一源 */
export type TurnMaterialBlock = TurnMediaBlock | TurnNodeBlock;
