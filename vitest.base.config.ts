import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '#catalog/': path.resolve(__dirname, 'src/catalog') + '/',
      '#cli/': path.resolve(__dirname, 'src/cli') + '/',
      '#core/': path.resolve(__dirname, 'src/core') + '/',
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
  },
});
