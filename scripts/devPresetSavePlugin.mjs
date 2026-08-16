import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export const DEV_PRESET_SAVE_ENDPOINT = '/__plexus-dev/save-preset';

const MAX_BODY_BYTES = 1024 * 1024;
const PRESET_FILE_RE = /^[A-Za-z0-9][\w .-]*\.json$/i;
const TUNING_KEY_RE = /^[A-Za-z][A-Za-z0-9]*$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertSafeTuningKey(key) {
  if (!TUNING_KEY_RE.test(key) || FORBIDDEN_KEYS.has(key)) {
    throw new PresetSaveError(400, `Invalid tuning key: ${key}`);
  }
}

export class PresetSaveError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'PresetSaveError';
    this.statusCode = statusCode;
  }
}

/**
 * Updates one authored preset without expanding every partial preset into a full runtime snapshot.
 * Existing preset keys are refreshed, and keys explicitly changed in the tuning panel are appended.
 */
export async function savePresetTuning({ presetRoot, fileName, tuning, changedKeys = [] }) {
  if (typeof fileName !== 'string' || !PRESET_FILE_RE.test(fileName)) {
    throw new PresetSaveError(400, 'Invalid preset file name.');
  }
  if (!isRecord(tuning)) {
    throw new PresetSaveError(400, 'The tuning payload must be an object.');
  }
  if (!Array.isArray(changedKeys) || changedKeys.some(key => typeof key !== 'string')) {
    throw new PresetSaveError(400, 'changedKeys must be a string array.');
  }

  const root = resolve(presetRoot);
  const manifestPath = join(root, 'index.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const registeredPresets = Array.isArray(manifest?.presets) ? manifest.presets : [];
  if (!registeredPresets.includes(fileName)) {
    throw new PresetSaveError(404, 'Only presets registered in index.json can be saved.');
  }

  const presetPath = resolve(root, fileName);
  if (dirname(presetPath) !== root) {
    throw new PresetSaveError(400, 'Preset path escapes the preset directory.');
  }

  const preset = JSON.parse(await readFile(presetPath, 'utf8'));
  if (!isRecord(preset) || !isRecord(preset.visualTuning)) {
    throw new PresetSaveError(422, 'Preset must contain a visualTuning object.');
  }

  const requestedKeys = [...new Set(changedKeys)];
  for (const key of requestedKeys) {
    assertSafeTuningKey(key);
    if (typeof tuning[key] !== 'number' || !Number.isFinite(tuning[key])) {
      throw new PresetSaveError(422, `Missing or invalid numeric value for ${key}.`);
    }
  }

  const savedKeys = [];
  const tuningEntries = Object.entries(preset.visualTuning).map(([key, existingValue]) => {
    assertSafeTuningKey(key);
    const nextValue = tuning[key];
    if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
      savedKeys.push(key);
      return [key, nextValue];
    }
    return [key, existingValue];
  });
  const existingKeys = new Set(tuningEntries.map(([key]) => key));
  for (const key of requestedKeys) {
    if (!existingKeys.has(key)) {
      tuningEntries.push([key, tuning[key]]);
      savedKeys.push(key);
    }
  }

  const updatedPreset = {
    ...preset,
    visualTuning: Object.fromEntries(tuningEntries),
  };
  const serialized = `${JSON.stringify(updatedPreset, null, 2)}\n`;
  const temporaryPath = `${presetPath}.${process.pid}.${randomUUID()}.tmp`;

  await mkdir(root, { recursive: true });
  try {
    await writeFile(temporaryPath, serialized, 'utf8');
    await rename(temporaryPath, presetPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return { fileName, preset: updatedPreset, savedKeys };
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new PresetSaveError(413, 'Preset payload is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new PresetSaveError(400, 'Request body must be valid JSON.');
  }
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

export function devPresetSavePlugin({ projectRoot = process.cwd() } = {}) {
  const presetRoot = resolve(projectRoot, 'public', 'visual-tuning-presets');
  return {
    name: 'plexus-dev-preset-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
        if (pathname !== DEV_PRESET_SAVE_ENDPOINT) return next();
        if (request.method !== 'POST') {
          response.setHeader('Allow', 'POST');
          return sendJson(response, 405, { error: 'Method not allowed.' });
        }

        try {
          const body = await readJsonBody(request);
          const result = await savePresetTuning({
            presetRoot,
            fileName: body?.fileName,
            tuning: body?.tuning,
            changedKeys: body?.changedKeys,
          });
          sendJson(response, 200, result);
        } catch (error) {
          const statusCode = error instanceof PresetSaveError ? error.statusCode : 500;
          const message = error instanceof Error ? error.message : 'Could not save preset.';
          if (statusCode >= 500) server.config.logger.error(`[preset-save] ${message}`);
          sendJson(response, statusCode, { error: message });
        }
      });
    },
  };
}
