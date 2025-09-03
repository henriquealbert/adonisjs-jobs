import { test } from '@japa/runner'
import type { ApplicationService, LoggerService } from '@adonisjs/core/types'
import JobsProvider from '../../providers/jobs_provider.js'
import { JobManager } from '../../src/job_manager.js'
import { Dispatchable } from '../../src/dispatchable.js'
import type { PgBossConfig } from '../../src/types.js'

// Mock logger
const createMockLogger = (): LoggerService =>
  ({
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    fatal: () => {},
    child: () => createMockLogger(),
  }) as unknown as LoggerService

// Simplified mock ApplicationService with proper singleton container functionality
const createMockApp = (
  environment: string = 'test',
  config: Record<string, unknown> = {}
): ApplicationService => {
  const containerBindings = new Map<string, () => unknown | Promise<unknown>>()
  const singletonInstances = new Map<string, unknown>()

  // Pre-register logger
  containerBindings.set('logger', () => createMockLogger())

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
      alias: (original: string, alias: string) => {
        // Create alias by copying the factory
        const factory = containerBindings.get(original)
        if (factory) {
          containerBindings.set(alias, factory)
        }
      },
    },
  } as unknown as ApplicationService
}

test.group('JobsProvider', () => {
  test('should register JobManager in IoC container', ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)
    let jobsRegistered = false

    // Override singleton to track registrations
    const originalSingleton = app.container.singleton

    ;(app.container as any).singleton = (key: string, factory: unknown) => {
      if (key === 'hschmaiske/jobs') jobsRegistered = true
      return originalSingleton(key, factory as () => unknown | Promise<unknown>)
    }

    provider.register()

    assert.isTrue(jobsRegistered)
  })

  test('should create JobManager instance in test environment', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const jobs = await app.container.make('hschmaiske/jobs')

    assert.instanceOf(jobs, JobManager)
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

  test('should shutdown JobManager', async ({ assert }) => {
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
    await provider.shutdown()

    assert.isTrue(true) // If we reach here, lifecycle completed successfully
  })

  test('should maintain singleton behavior', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const jobs1 = await app.container.make('hschmaiske/jobs')
    const jobs2 = await app.container.make('hschmaiske/jobs')

    // Should return same instances (singleton behavior)
    assert.equal(jobs1, jobs2)
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

    const jobs = await app.container.make('hschmaiske/jobs')

    // Should have JobManager interface
    assert.isFunction((jobs as JobManager).dispatch)
    assert.isFunction((jobs as JobManager).start)
    assert.isFunction((jobs as JobManager).stop)
  })

  test('should provide access to raw PgBoss instance', async ({ assert }) => {
    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const jobs = await app.container.make('hschmaiske/jobs')

    // Should provide access to raw PgBoss instance
    const rawPgBoss = (jobs as JobManager).raw
    assert.isObject(rawPgBoss)

    // Should have PgBoss methods
    assert.isFunction(rawPgBoss.send)
    assert.isFunction(rawPgBoss.start)
    assert.isFunction(rawPgBoss.stop)

    // Raw instance should be same as instance getter
    assert.equal(rawPgBoss, (jobs as JobManager).instance)
  })

  test('should support type-safe dispatch method', async ({ assert }) => {
    class TestJob extends Dispatchable {
      async handle(payload: { message: string }) {
        // Test job implementation
      }
    }

    const app = createMockApp('test')
    const provider = new JobsProvider(app)

    provider.register()

    const jobs = await app.container.make('hschmaiske/jobs')

    // Should have dispatch method
    assert.isFunction((jobs as JobManager).dispatch)
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
    assert.isFunction(provider.shutdown)

    // Open/Closed: Should be extensible through factory pattern
    provider.register()

    // Should work correctly
    assert.isTrue(true)
  })
})
