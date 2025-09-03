import { test } from '@japa/runner'
import { JobLifecycleManager } from '../../src/services/job_lifecycle_manager.js'
import { PgBossMock } from '../../src/mocks/pg_boss_mock.js'

import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../../src/types.js'

// Simplified mock ApplicationService
const createMockApp = (
  environment: string = 'test',
  config: Record<string, unknown> = {}
): ApplicationService =>
  ({
    getEnvironment: () => environment,
    config: {
      get: <T>(key: string, defaultValue: T): T => (config[key] as T) || defaultValue,
    },
    container: {
      make: async () => ({}),
    },
  }) as unknown as ApplicationService

test.group('JobLifecycleManager', () => {
  test('should initialize with empty instance count', ({ assert }) => {
    const app = createMockApp()
    const manager = new JobLifecycleManager(app)

    assert.equal(manager.instanceCount, 0)
  })

  test('should register PgBoss instances', ({ assert }) => {
    const app = createMockApp()
    const manager = new JobLifecycleManager(app)
    const pgBoss1 = new PgBossMock()
    const pgBoss2 = new PgBossMock()

    manager.register(pgBoss1)
    assert.equal(manager.instanceCount, 1)

    manager.register(pgBoss2)
    assert.equal(manager.instanceCount, 2)
  })

  test('should not start instances in test environment', async ({ assert }) => {
    const app = createMockApp('test')
    const manager = new JobLifecycleManager(app)
    const pgBoss = new PgBossMock()
    let startCalled = false

    // Override start method to track calls
    pgBoss.start = async () => {
      startCalled = true
      return pgBoss
    }

    manager.register(pgBoss as unknown as PgBoss)
    await manager.startAll()

    assert.equal(startCalled, false)
  })

  test('should not start instances when jobs are disabled', async ({ assert }) => {
    const app = createMockApp('production', { jobs: { enabled: false } })
    const manager = new JobLifecycleManager(app)
    const pgBoss = new PgBossMock()
    let startCalled = false

    // Override start method to track calls
    pgBoss.start = async () => {
      startCalled = true
      return pgBoss
    }

    manager.register(pgBoss as unknown as PgBoss)
    await manager.startAll()

    assert.equal(startCalled, false)
  })

  test('should start instances in production environment when enabled', async ({ assert }) => {
    const app = createMockApp('production', { jobs: { enabled: true } })
    const manager = new JobLifecycleManager(app)
    const pgBoss = new PgBossMock()
    let startCalled = false

    // Override start method to track calls
    pgBoss.start = async () => {
      startCalled = true
      return pgBoss
    }

    manager.register(pgBoss as unknown as PgBoss)
    await manager.startAll()

    assert.equal(startCalled, true)
  })

  test('should handle start failures gracefully', async ({ assert }) => {
    const app = createMockApp('production', { jobs: { enabled: true } })
    const manager = new JobLifecycleManager(app)
    const pgBoss = new PgBossMock()

    // Make start method throw an error
    pgBoss.start = async () => {
      throw new Error('Start failed')
    }

    manager.register(pgBoss as unknown as PgBoss)

    // Should not throw despite start failure
    await assert.doesNotReject(() => manager.startAll())
  })

  test('should stop all registered instances', async ({ assert }) => {
    const app = createMockApp()
    const manager = new JobLifecycleManager(app)
    const pgBoss1 = new PgBossMock()
    const pgBoss2 = new PgBossMock()

    let stop1Called = false
    let stop2Called = false

    // Override stop methods to track calls
    pgBoss1.stop = async () => {
      stop1Called = true
    }
    pgBoss2.stop = async () => {
      stop2Called = true
    }

    manager.register(pgBoss1 as unknown as PgBoss)
    manager.register(pgBoss2 as unknown as PgBoss)

    await manager.stopAll()

    assert.equal(stop1Called, true)
    assert.equal(stop2Called, true)
    assert.equal(manager.instanceCount, 0)
  })

  test('should handle stop failures gracefully', async ({ assert }) => {
    const app = createMockApp()
    const manager = new JobLifecycleManager(app)
    const pgBoss1 = new PgBossMock()
    const pgBoss2 = new PgBossMock()

    let stop2Called = false

    // Make first stop method throw, second should still be called
    pgBoss1.stop = async () => {
      throw new Error('Stop failed')
    }
    pgBoss2.stop = async () => {
      stop2Called = true
    }

    manager.register(pgBoss1 as unknown as PgBoss)
    manager.register(pgBoss2 as unknown as PgBoss)

    // Should not throw despite stop failure
    await assert.doesNotReject(() => manager.stopAll())

    // Second instance should still be stopped
    assert.equal(stop2Called, true)
    assert.equal(manager.instanceCount, 0)
  })

  test('should clear instances after stopAll', async ({ assert }) => {
    const app = createMockApp()
    const manager = new JobLifecycleManager(app)
    const pgBoss1 = new PgBossMock()
    const pgBoss2 = new PgBossMock()

    manager.register(pgBoss1 as unknown as PgBoss)
    manager.register(pgBoss2 as unknown as PgBoss)
    assert.equal(manager.instanceCount, 2)

    await manager.stopAll()
    assert.equal(manager.instanceCount, 0)
  })

  test('should handle multiple start/stop cycles', async ({ assert }) => {
    const app = createMockApp('production', { jobs: { enabled: true } })
    const manager = new JobLifecycleManager(app)
    const pgBoss = new PgBossMock()

    let startCount = 0
    let stopCount = 0

    pgBoss.start = async () => {
      startCount++
      return pgBoss
    }
    pgBoss.stop = async () => {
      stopCount++
    }

    manager.register(pgBoss as unknown as PgBoss)

    // First cycle
    await manager.startAll()
    await manager.stopAll()

    // Re-register for second cycle
    manager.register(pgBoss as unknown as PgBoss)
    await manager.startAll()
    await manager.stopAll()

    assert.equal(startCount, 2)
    assert.equal(stopCount, 2)
  })

  test('should use default config when jobs config is missing', async ({ assert }) => {
    const app = createMockApp('production', {}) // No jobs config
    const manager = new JobLifecycleManager(app)
    const pgBoss = new PgBossMock()
    let startCalled = false

    pgBoss.start = async () => {
      startCalled = true
      return pgBoss
    }

    manager.register(pgBoss as unknown as PgBoss)
    await manager.startAll()

    // Should start because enabled is not explicitly false
    assert.equal(startCalled, true)
  })
})
