import {
  GUIDELINE_BODY_FILENAME,
  GUIDELINE_MANIFEST_FILENAME,
  GuidelineManifestSchema,
} from '#catalog/content/item/schema.js';
import { GUIDELINES_DIR_NAME } from '#catalog/content/schema.js';

import { NewItemCommand, type ItemSpec } from './new-item.js';

export class NewGuidelineCommand extends NewItemCommand {
  protected override _spec: ItemSpec = {
    typeDir: GUIDELINES_DIR_NAME,
    manifestFilename: GUIDELINE_MANIFEST_FILENAME,
    manifestSchema: GuidelineManifestSchema,
    buildManifest: ({ name, description, bodyRef }) => ({
      name,
      description,
      body: bodyRef,
      recommended: { load: 'always' },
    }),
    bodyFilename: GUIDELINE_BODY_FILENAME,
    bodyContent: 'write the guideline here',
  };
}
