import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../src/types.js'
import PgBoss from 'pg-boss'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    pgboss: PgBoss
  }
}

export default class PgBossProvider {
  #pgBoss: PgBoss | null = null

  constructor(protected app: ApplicationService) {}

  register(): void {
    this.app.container.singleton('pgboss', () => {
      const config = this.app.config.get<PgBossConfig>('pgboss', {})
      this.#pgBoss = new PgBoss(config)
      return this.#pgBoss
    })
  }

  async start(): Promise<void> {
    if (this.#pgBoss && this.app.getEnvironment() !== 'test') {
      const config = this.app.config.get<PgBossConfig>('pgboss', {})

      if (config.enabled !== false) {
        await this.#pgBoss.start()
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.#pgBoss) {
      await this.#pgBoss.stop()
    }
  }
}
