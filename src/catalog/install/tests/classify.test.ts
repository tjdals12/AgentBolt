import { describe, it, expect } from 'vitest';

import { classifyChange } from '#catalog/install/classify.js';

describe('classifyChange', () => {
  it('classifies a missing target as installed', () => {
    expect(classifyChange(null, 'next')).toBe('installed');
  });

  it('classifies differing content as updated', () => {
    expect(classifyChange('prev', 'next')).toBe('updated');
  });

  it('reports no change when content is identical', () => {
    expect(classifyChange('same', 'same')).toBeNull();
  });
});
