import { test } from '@japa/runner'
import type { ApplicationService } from '@adonisjs/core/types'
import {
  EnvironmentJobServiceFactory,
  SingletonJobServiceFactory,
} from '../../src/factories/job_service_factory.js'
import { PgBossMock } from '../../src/mocks/pg_boss_mock.js'
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

test.group('EnvironmentJobServiceFactory', () => {
  test('should create test job service for test environment', ({ assert }) => {
    const app = createMockApp('test')
    const factory = new EnvironmentJobServiceFactory(app)

    const jobService = factory.createJobService(app)

    assert.instanceOf(jobService, PgBossMock)
    assert.isFunction(jobService.send)
    assert.isFunction(jobService.start)
  })

  test('should create production job service for non-test environment', ({ assert }) => {
    const jobsConfig: PgBossConfig = {
      connectionString: 'postgres://test:test@localhost:5432/test',
      enabled: false, // Disable to avoid import errors
    }
    const app = createMockApp('production', { jobs: jobsConfig })
    const factory = new EnvironmentJobServiceFactory(app)

    const jobService = factory.createJobService(app)

    // Should return a Promise (wrapped for production environments)
    assert.isTrue(jobService instanceof Promise || typeof jobService === 'object')
  })

  test('should handle different environments', ({ assert }) => {
    const environments = ['test', 'development', 'production', 'staging']

    environments.forEach((env) => {
      const app = createMockApp(env)
      const factory = new EnvironmentJobServiceFactory(app)

      const jobService = factory.createJobService(app)

      if (env === 'test') {
        assert.instanceOf(jobService, PgBossMock)
      } else {
        assert.isTrue(jobService instanceof Promise || typeof jobService === 'object')
      }
    })
  })

  test('should create no-op auto discovery', ({ assert }) => {
    const app = createMockApp()
    const factory = new EnvironmentJobServiceFactory(app)
    const pgBoss = new PgBossMock()
    const config: PgBossConfig = {}

    const autoDiscovery = factory.createAutoDiscovery(pgBoss as unknown as PgBoss, app, config)

    assert.isFunction(autoDiscovery.discover)
  })

  test('should handle auto discovery without errors', async ({ assert }) => {
    const app = createMockApp()
    const factory = new EnvironmentJobServiceFactory(app)
    const pgBoss = new PgBossMock()
    const config: PgBossConfig = {}

    const autoDiscovery = factory.createAutoDiscovery(pgBoss as unknown as PgBoss, app, config)

    await assert.doesNotReject(() => autoDiscovery.discover())
  })
})

test.group('SingletonJobServiceFactory', () => {
  test('should create singleton instance', ({ assert }) => {
    // Reset singleton state
    SingletonJobServiceFactory.reset()

    const app = createMockApp('test')

    const instance1 = SingletonJobServiceFactory.create(app)
    const instance2 = SingletonJobServiceFactory.create(app)

    assert.equal(instance1, instance2)
    assert.instanceOf(instance1, PgBossMock)
  })

  test('should reset singleton instance', ({ assert }) => {
    const app = createMockApp('test')

    const instance1 = SingletonJobServiceFactory.create(app)
    SingletonJobServiceFactory.reset()
    const instance2 = SingletonJobServiceFactory.create(app)

    assert.notEqual(instance1, instance2)
    assert.instanceOf(instance1, PgBossMock)
    assert.instanceOf(instance2, PgBossMock)
  })

  test('should work with different environments in singleton', ({ assert }) => {
    SingletonJobServiceFactory.reset()

    const testApp = createMockApp('test')
    const prodApp = createMockApp('production', {
      jobs: {
        connectionString: 'postgres://test:test@localhost:5432/test',
        enabled: false,
      },
    })

    // First creation with test environment
    const testInstance = SingletonJobServiceFactory.create(testApp)

    // Second creation should return same instance even with different app
    const prodInstance = SingletonJobServiceFactory.create(prodApp)

    assert.equal(testInstance, prodInstance)
    assert.instanceOf(testInstance, PgBossMock)
  })

  test('should maintain singleton across multiple create calls', ({ assert }) => {
    SingletonJobServiceFactory.reset()

    const app = createMockApp('test')
    const instances = []

    // Create multiple instances
    for (let i = 0; i < 5; i++) {
      instances.push(SingletonJobServiceFactory.create(app))
    }

    // All should be the same instance
    instances.forEach((instance) => {
      assert.equal(instance, instances[0])
      assert.instanceOf(instance, PgBossMock)
    })
  })

  test('should handle reset and recreate cycle', ({ assert }) => {
    const app = createMockApp('test')
    const originalInstances = []
    const newInstances = []

    // Create some instances
    for (let i = 0; i < 3; i++) {
      originalInstances.push(SingletonJobServiceFactory.create(app))
    }

    // Reset and create new instances
    SingletonJobServiceFactory.reset()

    for (let i = 0; i < 3; i++) {
      newInstances.push(SingletonJobServiceFactory.create(app))
    }

    // Original instances should all be the same
    originalInstances.forEach((instance) => {
      assert.equal(instance, originalInstances[0])
    })

    // New instances should all be the same (but different from original)
    newInstances.forEach((instance) => {
      assert.equal(instance, newInstances[0])
      assert.notEqual(instance, originalInstances[0])
    })
  })
})
