import { args, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { stubsRoot } from '../stubs/index.js'

export abstract class BaseMakeCommand extends BaseCommand {
  static options: CommandOptions = {
    startApp: false,
    allowUnknownFlags: false,
    staysAlive: false,
  }

  @args.string({ description: 'Name of the job to create' })
  declare name: string

  async run(): Promise<void> {
    const entity = this.app.generators.createEntity(this.name)
    const codemods = await this.createCodemods()

    await codemods.makeUsingStub(stubsRoot, this.getStubFile(), {
      entity,
    })

    this.logger.success(`Created ${this.getEntityType()} "${entity.path}"`)
  }

  protected abstract getStubFile(): string
  protected abstract getEntityType(): string
}
