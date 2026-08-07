import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { WorkflowMentionItem } from '../components/CanvasPromptEditor/types';
import type { WorkflowPromptContent } from '../types';
import { buildSubmitPromptAndRefs } from './buildPromptSubmit';
import {
  pickConnectedPromptInputTexts,
  pickConnectedReferenceAssetIds,
} from './mergePredecessorTextForSubmit';

const FIXTURES_DIR = path.resolve(process.cwd(), 'test/fixtures/node_submit');

type FixtureNode = {
  id: string;
  data: {
    status?: string;
    input_prompt?: string;
    output_text?: string;
    output_asset_ids?: number[] | null;
  };
};

type FixtureEdge = {
  source: string;
  target: string;
  data?: { source_port?: string; target_port?: string };
};

type ManualRef = { assetId?: number };

type NodeSubmitFixture = {
  name: string;
  target_node_id: string;
  nodes: FixtureNode[];
  edges: FixtureEdge[];
  submit: {
    content: WorkflowPromptContent;
    storedPrompt: string;
    connectedPromptTexts?: string[];
    manualRefs?: ManualRef[];
    previewMediaRefs?: WorkflowMentionItem[];
    referenceAssets?: WorkflowMentionItem[];
    selfLibraryRefs?: number[];
  };
};

type ExpectedRefs = {
  ref_asset_ids: number[];
};

function loadFixtures(): NodeSubmitFixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json') && !name.endsWith('.expected.json'))
    .map((name) => JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as NodeSubmitFixture);
}

function runFixture(fixture: NodeSubmitFixture): ExpectedRefs {
  const nodes = fixture.nodes.map((node) => ({ id: node.id, data: node.data }));
  const edges = fixture.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    data: edge.data ?? {},
  }));
  const connectedAssetIds = pickConnectedReferenceAssetIds(
    fixture.target_node_id,
    nodes,
    edges,
  );
  const connectedPromptTexts =
    fixture.submit.connectedPromptTexts ??
    pickConnectedPromptInputTexts(fixture.target_node_id, nodes, edges);

  const { ref_asset_ids } = buildSubmitPromptAndRefs({
    content: fixture.submit.content,
    storedPrompt: fixture.submit.storedPrompt,
    referenceAssets: fixture.submit.referenceAssets ?? [],
    connectedPromptTexts,
    connectedAssetIds,
    manualRefs: fixture.submit.manualRefs,
    previewMediaRefs: fixture.submit.previewMediaRefs,
    selfLibraryRefs: fixture.submit.selfLibraryRefs,
  });

  return { ref_asset_ids };
}

const UPDATE_EXPECTED = process.env.UPDATE_NODE_SUBMIT_EXPECTED === '1';

describe('buildSubmitPromptAndRefs golden parity', () => {
  for (const fixture of loadFixtures()) {
    it(fixture.name, () => {
      const result = runFixture(fixture);
      const expectedPath = path.join(FIXTURES_DIR, `${fixture.name}.expected.json`);

      if (UPDATE_EXPECTED) {
        writeFileSync(expectedPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      }

      const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as ExpectedRefs;
      expect(result).toEqual(expected);
    });
  }
});
