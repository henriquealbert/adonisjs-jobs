import { configPkg } from '@adonisjs/eslint-config'

export default [
  ...configPkg(),
  {
    files: ['src/**/*', 'tests/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    ignores: ['coverage/**/*'],
  },
]
