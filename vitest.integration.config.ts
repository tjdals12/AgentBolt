import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.base.config.js';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/tests/*.int-test.ts'],
    fileParallelism: false,
  },
});
