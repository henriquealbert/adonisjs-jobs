import { BaseMakeCommand } from './base_make_command.js'

export default class MakeJobCommand extends BaseMakeCommand {
  static commandName = 'make:job'
  static description = 'Create a new queue job'

  protected getStubFile(): string {
    return 'queue-job.stub'
  }

  protected getEntityType(): string {
    return 'queue job'
  }
}
