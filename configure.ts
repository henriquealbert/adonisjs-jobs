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

  try {
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

    console.log('✅ @hschmaiske/jobs configured successfully!')
    console.log('')
    console.log('📁 Created directories:')
    console.log('  - app/jobs/ (for dispatchable jobs)')
    console.log('  - app/cron/ (for scheduled cron tasks)')
    console.log('')
    console.log('📄 Created files:')
    console.log('  - config/jobs.ts (configuration)')
    console.log('  - app/jobs/example_job.ts (example dispatchable job)')
    console.log('  - app/cron/example_cron.ts (example cron task)')
    console.log('')
    console.log('🔧 Next steps:')
    console.log('  1. Configure your database connection in config/jobs.ts')
    console.log('  2. Add queue names to the queues array')
    console.log('  3. Start creating your jobs with: node ace make:job MyJob')
    console.log('  4. Start creating cron tasks with: node ace make:cron MyTask')
  } catch (error) {
    console.error('❌ Failed to configure @hschmaiske/jobs:', error)
    throw error
  }
}
