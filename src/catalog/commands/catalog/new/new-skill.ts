import {
  SKILL_INSTRUCTIONS_FILENAME,
  SKILL_MANIFEST_FILENAME,
  SkillManifestSchema,
} from '#catalog/content/item/schema.js';
import { SKILLS_DIR_NAME } from '#catalog/content/schema.js';

import { NewItemCommand, type ItemSpec } from './new-item.js';

export class NewSkillCommand extends NewItemCommand {
  protected override _spec: ItemSpec = {
    typeDir: SKILLS_DIR_NAME,
    manifestFilename: SKILL_MANIFEST_FILENAME,
    manifestSchema: SkillManifestSchema,
    buildManifest: ({ name, description, bodyRef }) => ({
      name,
      description,
      instructions: bodyRef,
    }),
    bodyFilename: SKILL_INSTRUCTIONS_FILENAME,
    bodyContent: 'write the skill instructions here',
  };
}
