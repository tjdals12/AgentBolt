import {
  AGENT_MANIFEST_FILENAME,
  AGENT_PROMPT_FILENAME,
  AgentManifestSchema,
} from '#catalog/content/item/schema.js';
import { AGENTS_DIR_NAME } from '#catalog/content/schema.js';

import { NewItemCommand, type ItemSpec } from './new-item.js';

export class NewAgentCommand extends NewItemCommand {
  protected override _spec: ItemSpec = {
    typeDir: AGENTS_DIR_NAME,
    manifestFilename: AGENT_MANIFEST_FILENAME,
    manifestSchema: AgentManifestSchema,
    buildManifest: ({ name, description, bodyRef }) => ({
      name,
      description,
      instructions: bodyRef,
    }),
    bodyFilename: AGENT_PROMPT_FILENAME,
    bodyContent: 'write the agent prompt here',
  };
}
