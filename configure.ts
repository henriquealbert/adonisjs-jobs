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

  // Create config file
  await codemods.makeUsingStub(stubsRoot, 'config/jobs.stub', {})

  // Create example job and cron files (these will create directories automatically)
  await codemods.makeUsingStub(stubsRoot, 'app/jobs/example_job.stub', {})
  await codemods.makeUsingStub(stubsRoot, 'app/cron/example_cron.stub', {})

  // Update .adonisrc.ts
  await codemods.updateRcFile((rcFile) => {
    rcFile
      .addProvider('@hschmaiske/jobs/providers/jobs_provider')
      .addCommand('@hschmaiske/jobs/commands')
  })

  // Update tsconfig.json to add path mappings
  const project = await codemods.getTsMorphProject()
  if (project) {
    const tsConfig = project.addSourceFileAtPath('tsconfig.json')
    const jsonObject = JSON.parse(tsConfig.getFullText())

    if (!jsonObject.compilerOptions) jsonObject.compilerOptions = {}
    if (!jsonObject.compilerOptions.paths) jsonObject.compilerOptions.paths = {}

    jsonObject.compilerOptions.paths['#jobs/*'] = ['./app/jobs/*.js']
    jsonObject.compilerOptions.paths['#cron/*'] = ['./app/cron/*.js']

    tsConfig.replaceWithText(JSON.stringify(jsonObject, null, 2))
    tsConfig.saveSync()
  }
}
