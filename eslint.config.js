import { configPkg } from '@adonisjs/eslint-config'

export default [
  ...configPkg(),
  {
    files: ['src/**/*', 'tests/**/*'],
  },
  {
    ignores: ['coverage/**/*'],
  },
]
