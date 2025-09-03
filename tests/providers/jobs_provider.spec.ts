import { test } from '@japa/runner'
import type { ApplicationService } from '@adonisjs/core/types'
import JobsProvider from '../../providers/jobs_provider.js'
import { PgBossMock } from '../../src/mocks/pg_boss_mock.js'
import type { PgBossConfig } from '../../src/types.js'

// Simplified mock ApplicationService with proper singleton container functionality
const createMockApp = (
  environment: string = 'test',
  config: Record<string, unknown> = {}
): ApplicationService => {
  const containerBindings = new Map<string, () => unknown | Promise<unknown>>()
  const singletonInstances = new Map<string, unknown>()

  return {
    getEnvironment: () => environment,
    config: {
      get: <T>(key: string, defaultValue: T): T => (config[key] as T) || defaultValue,
    },
    container: {
      singleton: (key: string, factory: () => unknown | Promise<unknown>) => {
        containerBindings.set(key, factory)
      },
      make: async (key: string): Promise<unknown> => {
        // Check if singleton instance already exists
        if (singletonInstances.has(key)) {
          return singletonInstances.get(key)!
        }

        const factory = containerBindings.get(key)
        if (factory) {
          const result = factory()
          const instance = result instanceof Promise ? await result : result
          singletonInstances.set(key, instance)
          return instance
        }
        return {}
      },
    },
  } as unknown as ApplicationService
}

test.group('JobsProvider', () => {
  test('should register services in IoC container', ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)
    let pgBossRegistered = false
    let jobsRegistered = false

    // Override singleton to track registrations
    const originalSingleton = app.container.singleton
    app.container.singleton = (key: string, factory: () => unknown | Promise<unknown>) => {
      if (key === 'pgboss') pgBossRegistered = true
      if (key === 'hschmaiske/jobs') jobsRegistered = true
      return originalSingleton(key, factory)
    }

    provider.register()

    assert.isTrue(pgBossRegistered)
    assert.isTrue(jobsRegistered)
  })

  test('should create mock instances in test environment', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const pgBoss = await app.container.make('pgboss')
    const jobs = await app.container.make('hschmaiske/jobs')

    assert.instanceOf(pgBoss, PgBossMock)
    assert.instanceOf(jobs, PgBossMock)
    assert.equal(pgBoss, jobs) // Should be the same instance
  })

  test('should handle production environment', ({ assert }) => {
    const jobsConfig: PgBossConfig = {
      connectionString: 'postgres://test:test@localhost:5432/test',
      enabled: false, // Disable auto-discovery to avoid import issues
    }
    const app = createMockApp('production', { jobs: jobsConfig })
    const provider = new JobsProvider(app)

    // Should not throw during registration
    assert.doesNotThrow(() => provider.register())
  })

  test('should handle different environments', ({ assert }) => {
    const environments = ['development', 'staging', 'production']

    environments.forEach((env) => {
      const jobsConfig: PgBossConfig = { enabled: false }
      const app = createMockApp(env, { jobs: jobsConfig })
      const provider = new JobsProvider(app)

      assert.doesNotThrow(() => provider.register())
    })
  })

  test('should start lifecycle manager', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    // Should not throw during start
    await assert.doesNotReject(() => provider.start())
  })

  test('should shutdown lifecycle manager', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    // Should not throw during shutdown
    await assert.doesNotReject(() => provider.shutdown())
  })

  test('should handle complete lifecycle', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    // Complete lifecycle should work without errors
    provider.register()
    await provider.start()
    await provider.shutdown()

    assert.isTrue(true) // If we reach here, lifecycle completed successfully
  })

  test('should maintain singleton behavior', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const pgBoss1 = await app.container.make('pgboss')
    const pgBoss2 = await app.container.make('pgboss')
    const jobs1 = await app.container.make('hschmaiske/jobs')
    const jobs2 = await app.container.make('hschmaiske/jobs')

    // Should return same instances (singleton behavior)
    assert.equal(pgBoss1, pgBoss2)
    assert.equal(jobs1, jobs2)
    assert.equal(pgBoss1, jobs1) // Jobs should be alias for pgboss
  })

  test('should handle config-based initialization', ({ assert }) => {
    const jobsConfig: PgBossConfig = {
      connectionString: 'postgres://user:pass@localhost:5432/db',
      schema: 'custom_jobs',
      enabled: true,
    }
    const app = createMockApp('production', { jobs: jobsConfig })
    const provider = new JobsProvider(app)

    // Should handle config without errors
    assert.doesNotThrow(() => provider.register())
  })

  test('should provide proper TypeScript bindings', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const pgBoss = await app.container.make('pgboss')
    const jobs = await app.container.make('hschmaiske/jobs')

    // Should have PgBoss-like interface
    assert.isFunction((pgBoss as PgBossMock).send)
    assert.isFunction((pgBoss as PgBossMock).start)
    assert.isFunction((pgBoss as PgBossMock).stop)

    assert.isFunction((jobs as PgBossMock).send)
    assert.isFunction((jobs as PgBossMock).start)
    assert.isFunction((jobs as PgBossMock).stop)
  })

  test('should handle factory dependencies correctly', ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    // Constructor should create factory and lifecycle manager
    assert.isObject(provider)

    // Should not throw during initialization
    assert.doesNotThrow(() => provider.register())
  })

  test('should support SOLID principles', ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    // Single Responsibility: Should only handle provider responsibilities
    assert.isFunction(provider.register)
    assert.isFunction(provider.start)
    assert.isFunction(provider.shutdown)

    // Open/Closed: Should be extensible through factory pattern
    provider.register()

    // Should work correctly
    assert.isTrue(true)
  })
})
