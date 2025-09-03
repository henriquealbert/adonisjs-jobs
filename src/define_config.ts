import type { PgBossConfig } from './types.js'

export function defineConfig<T extends PgBossConfig>(config: T): T {
  return config
}
