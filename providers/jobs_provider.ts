import type { ApplicationService } from '@adonisjs/core/types'
import type PgBoss from 'pg-boss'
import type { PgBossConfig } from '../src/types.js'

// Type alias for better naming
export type JobService = PgBoss

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'pgboss': PgBoss
    'hschmaiske/jobs': JobService
  }
}

export default class JobsProvider {
  #pgBoss: PgBoss | null = null

  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('hschmaiske/jobs', async () => {
      const config = this.app.config.get<PgBossConfig>('jobs', {})

      const environment = this.app.getEnvironment()
      const nodeEnv = process.env.NODE_ENV
      const isTestEnvironment = environment === 'test' || nodeEnv === 'test'

      if (isTestEnvironment) {
        const { PgBossMock } = await import('../src/mocks/pg_boss_mock.js')
        this.#pgBoss = new PgBossMock() as unknown as PgBoss
      } else {
        const PgBossClass = await import('pg-boss')
        this.#pgBoss = new PgBossClass.default(config)
      }

      return this.#pgBoss
    })

    this.app.container.alias('hschmaiske/jobs', 'pgboss')
  }

  async shutdown() {
    if (this.#pgBoss) {
      await this.#pgBoss.stop()
    }
  }
}
