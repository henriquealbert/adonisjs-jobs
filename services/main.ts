import app from '@adonisjs/core/services/app'
import type PgBoss from 'pg-boss'

let job: PgBoss

await app.booted(async () => {
  job = await app.container.make('pgboss')
})

export { job as default }
