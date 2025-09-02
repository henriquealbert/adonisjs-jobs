/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure <package>"
| command. You are free to perform any operations inside this function to
| configure the package.
|
| To make things easier, you have access to the underlying "ConfigureCommand"
| instance and you can use codemods to modify the source files.
|
*/

import type Configure from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/index.js'

export async function configure(command: Configure) {
  const codemods = await command.createCodemods()

  // Publish config file
  await codemods.makeUsingStub(stubsRoot, 'config/jobs.stub', {})

  // Add environment variables (using existing DB config)
  await codemods.defineEnvVariables({
    DB_HOST: '127.0.0.1',
    DB_PORT: '5432',
    DB_USER: 'postgres',
    DB_PASSWORD: '',
    DB_DATABASE: 'your_database',
  })

  await codemods.defineEnvValidations({
    variables: {
      DB_HOST: `Env.schema.string({ format: 'host' })`,
      DB_PORT: 'Env.schema.number()',
      DB_USER: 'Env.schema.string()',
      DB_PASSWORD: 'Env.schema.string.optional()',
      DB_DATABASE: 'Env.schema.string()',
    },
    leadingComment: 'Variables for @hschmaiske/jobs (uses same DB as Lucid)',
  })

  // Add provider to rc file and commands
  await codemods.updateRcFile((rcFile) => {
    rcFile
      .addProvider('@hschmaiske/jobs/providers/jobs_provider')
      .addCommand('@hschmaiske/jobs/commands')
  })
}
