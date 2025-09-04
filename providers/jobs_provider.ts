/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../src/types.js'
import type { JobManager } from '../src/job_manager.js'

export default class JobsProvider {
  #jobManager: JobManager | null = null

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('hschmaiske/jobs' as any, async () => {
      const { JobManager } = await import('../src/job_manager.js')

      const config = this.app.config.get<PgBossConfig>('jobs')
      const logger = await this.app.container.make('logger')

      this.#jobManager = new JobManager(config, logger, this.app)

      return this.#jobManager
    })
  }

  async shutdown() {
    if (this.#jobManager) {
      await this.#jobManager.closeAll()
    }
  }
}
