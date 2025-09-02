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

  await codemods.makeUsingStub(stubsRoot, 'config/jobs.stub', {})

  await codemods.updateRcFile((rcFile) => {
    rcFile
      .addProvider('@hschmaiske/jobs/providers/jobs_provider')
      .addCommand('@hschmaiske/jobs/commands')
  })
}
