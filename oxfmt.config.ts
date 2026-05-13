import { defineConfig } from 'oxfmt'

export default defineConfig({
  semi: false,
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
  tabWidth: 2,
  sortImports: true,
  ignorePatterns: ['pnpm-lock.yaml', 'node_modules/'],
  overrides: [
    {
      files: ['tsconfig*.json'],
      options: { trailingComma: 'none' },
    },
  ],
})
