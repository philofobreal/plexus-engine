import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const sourcePath = join(process.cwd(), 'src/ui/visualModePlanRegeneration.ts');
const output = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInContext(output, vm.createContext({ exports: module.exports, module }), {
  filename: sourcePath
});

const { shouldApplyVisualModePlanGeneration } = module.exports;

test('visual-mode plan regeneration applies only the latest clean request for the current mode', () => {
  assert.equal(shouldApplyVisualModePlanGeneration(3, 3, 'cosmic-wormhole', 'cosmic-wormhole', false), true);
  assert.equal(shouldApplyVisualModePlanGeneration(2, 3, 'cosmic-wormhole', 'cosmic-wormhole', false), false);
  assert.equal(shouldApplyVisualModePlanGeneration(3, 3, 'cosmic-wormhole', 'temporal', false), false);
  assert.equal(shouldApplyVisualModePlanGeneration(3, 3, 'cosmic-wormhole', 'cosmic-wormhole', true), false);
});

