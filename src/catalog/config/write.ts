import { type Document, type ParsedNode, parseDocument, isMap, isSeq } from 'yaml';

import fs from 'node:fs';

function forceBlockStyle(node: ParsedNode | null): void {
  if (isMap(node)) {
    if (node.items.length === 0) return;
    node.flow = false;
    for (const pair of node.items) {
      forceBlockStyle(pair.value);
    }
  }
  if (isSeq(node)) {
    if (node.items.length === 0) return;
    node.flow = false;
    for (const child of node.items) {
      forceBlockStyle(child);
    }
  }
}

export function editConfigFile(path: string, edit: (document: Document) => void) {
  const raw = fs.readFileSync(path, 'utf-8');
  const document = parseDocument(raw);

  edit(document);
  forceBlockStyle(document.contents);

  fs.writeFileSync(path, document.toString({ lineWidth: 0 }), 'utf-8');
}
