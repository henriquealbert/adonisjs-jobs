import { BaseMakeCommand } from './base_make_command.js'

export default class MakeCronCommand extends BaseMakeCommand {
  static commandName = 'make:cron'
  static description = 'Create a new cron/scheduled job'

  protected getStubFile(): string {
    return 'cron-job.stub'
  }

  protected getEntityType(): string {
    return 'cron job'
  }
}
