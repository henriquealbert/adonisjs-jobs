import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { stubsRoot } from '../stubs/index.js'

export default class MakeJobCommand extends BaseCommand {
  static commandName = 'make:job'
  static description = 'Create a new queue job'

  static options: CommandOptions = {
    startApp: false,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  @args.string({ description: 'Name of the queue job to create' })
  declare name: string

  async run(): Promise<void> {
    const entity = this.app.generators.createEntity(this.name)
    const codemods = await this.createCodemods()

    await codemods.makeUsingStub(stubsRoot, 'queue-job.stub', {
      entity,
    })

    this.logger.success(`Created queue job "${entity.path}"`)
  }
}
