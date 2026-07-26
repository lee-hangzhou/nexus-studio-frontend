import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaDirectory = path.join(root, 'contracts', 'schema');
const generatedDirectory = path.join(root, 'src', 'api', 'generated');
const contractNames = ['canvas', 'generation', 'gateway', 'projects', 'stream'];
const executable = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'json2ts.cmd' : 'json2ts',
);

function generate(outputDirectory) {
  for (const name of contractNames) {
    const result = spawnSync(
      executable,
      [
        '-i',
        path.join(schemaDirectory, `${name}.json`),
        '-o',
        path.join(outputDirectory, `${name}.d.ts`),
      ],
      { stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`json2ts failed for ${name} with exit code ${result.status}`);
    }
  }
}

async function generateCommittedTypes() {
  await mkdir(generatedDirectory, { recursive: true });
  generate(generatedDirectory);
}

async function checkGeneratedTypes() {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'dream-drama-contracts-'));
  try {
    generate(temporaryDirectory);
    const stale = [];
    for (const name of contractNames) {
      const expected = await readFile(path.join(temporaryDirectory, `${name}.d.ts`));
      let actual;
      try {
        actual = await readFile(path.join(generatedDirectory, `${name}.d.ts`));
      } catch (error) {
        if (error?.code === 'ENOENT') {
          stale.push(name);
          continue;
        }
        throw error;
      }
      if (!actual.equals(expected)) stale.push(name);
    }
    if (stale.length > 0) {
      throw new Error(`stale generated contracts: ${stale.join(', ')}`);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function hasAllSchemas(directory) {
  try {
    await Promise.all(contractNames.map((name) => readFile(path.join(directory, `${name}.json`))));
    return true;
  } catch {
    return false;
  }
}

async function locateSourceDirectory(source) {
  const candidates = [source, path.join(source, 'contracts', 'schema'), path.join(source, 'schema')];
  for (const candidate of candidates) {
    if (await hasAllSchemas(candidate)) return candidate;
  }
  throw new Error(`CONTRACTS_SOURCE does not contain all contract schemas: ${source}`);
}

async function syncSchemas() {
  const configuredSource = process.env.CONTRACTS_SOURCE?.trim();
  if (!configuredSource) {
    throw new Error('CONTRACTS_SOURCE must point to a backend checkout or schema directory');
  }
  const sourceDirectory = await locateSourceDirectory(path.resolve(configuredSource));
  await mkdir(schemaDirectory, { recursive: true });
  for (const name of contractNames) {
    const source = path.join(sourceDirectory, `${name}.json`);
    const destination = path.join(schemaDirectory, `${name}.json`);
    if (source !== destination) await copyFile(source, destination);
  }
  await generateCommittedTypes();
}

const command = process.argv[2];
try {
  if (command === 'generate') {
    await generateCommittedTypes();
  } else if (command === 'check') {
    await checkGeneratedTypes();
  } else if (command === 'sync') {
    await syncSchemas();
  } else {
    throw new Error('usage: contracts.mjs <generate|check|sync>');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
