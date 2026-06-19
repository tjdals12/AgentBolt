import { mergeConfig } from 'vitest/config';
import baseConfig from './vitest.base.config.js';

export default mergeConfig(baseConfig, {
  test: {
    include: ['src/**/tests/*.test.ts', 'src/**/tests/*.int-test.ts'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/tests/**', 'src/cli/**', 'src/core/intro/**'],
    },
  },
});
