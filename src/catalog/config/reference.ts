import { z } from 'zod';

import { ConfigSchema } from '#catalog/config/schema.js';

type JsonSchema = {
  type?: string;
  const?: unknown;
  examples?: unknown[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
  oneOf?: JsonSchema[];
};

function renderScalar(node: JsonSchema): string {
  const value = 'const' in node ? node.const : node.examples?.[0];
  if (typeof value === 'string') return value;
  if (value === undefined) return '...';
  return JSON.stringify(value);
}

function renderComment(node: JsonSchema): string {
  return node.description ? `  # ${node.description}` : '';
}

function makeAlias(variant: JsonSchema, index: number): string {
  const typeConst = variant.properties?.type?.const;
  return typeof typeConst === 'string' ? `my-${typeConst}-catalog` : `alias-${index + 1}`;
}

function renderProperty(key: string, node: JsonSchema, level: number): string[] {
  const pad = '  '.repeat(level);

  if (node.properties) {
    return [
      `${pad}${key}:${renderComment(node)}`,
      ...Object.entries(node.properties).flatMap(([childKey, childNode]) =>
        renderProperty(childKey, childNode, level + 1),
      ),
    ];
  }

  if (node.type === 'array') {
    const example = node.examples?.[0];
    const items = Array.isArray(example) ? example : [renderScalar(node.items ?? {})];
    return [
      `${pad}${key}:${renderComment(node)}`,
      ...items.map((item) => `${pad}  - ${typeof item === 'string' ? item : JSON.stringify(item)}`),
    ];
  }

  if (node.type === 'object' && typeof node.additionalProperties === 'object') {
    const valueSchema = node.additionalProperties;
    const variants = valueSchema.oneOf ?? (valueSchema.properties ? [valueSchema] : null);
    if (!variants) {
      return [`${pad}${key}: {}${renderComment(node)}`];
    }
    return [
      `${pad}${key}:${renderComment(node)}`,
      ...variants.flatMap((variant, index) =>
        renderProperty(makeAlias(variant, index), variant, level + 1),
      ),
    ];
  }

  return [`${pad}${key}: ${renderScalar(node)}${renderComment(node)}`];
}

export function renderConfigReference(): string {
  const schema = z.toJSONSchema(ConfigSchema, { io: 'input' }) as unknown as JsonSchema;
  const lines = Object.entries(schema.properties ?? {}).flatMap(([key, node]) =>
    renderProperty(key, node, 0),
  );
  return lines.map((line) => `# ${line}`).join('\n');
}
