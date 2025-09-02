import { args } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import { BaseCommand } from '@adonisjs/core/ace'
import { stubsRoot } from '../stubs/index.js'

export default class MakeCronCommand extends BaseCommand {
  static commandName = 'make:cron'
  static description = 'Create a new cron/scheduled job'

  static options: CommandOptions = {
    startApp: false,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  @args.string({ description: 'Name of the cron job to create' })
  declare name: string

  async run(): Promise<void> {
    const entity = this.app.generators.createEntity(this.name)
    const codemods = await this.createCodemods()

    await codemods.makeUsingStub(stubsRoot, 'cron-job.stub', {
      entity,
    })

    this.logger.success(`Created cron job "${entity.path}"`)
  }
}
