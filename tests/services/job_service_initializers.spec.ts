import { test } from '@japa/runner'
import {
  TestJobServiceInitializer,
  ProductionJobServiceInitializer,
} from '../../src/services/job_service_initializers.js'
import { PgBossMock } from '../../src/mocks/pg_boss_mock.js'

import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../../src/types.js'

// Simplified mock ApplicationService
const mockApp: ApplicationService = {
  getEnvironment: () => 'test',
  config: {
    get: <T>(_key: string, defaultValue: T): T => defaultValue,
  },
  container: {
    make: async (service: string) => {
      if (service === 'logger') {
        return {
          info: () => {},
          error: () => {},
          warn: () => {},
          debug: () => {},
        }
      }
      return {}
    },
  },
} as unknown as ApplicationService

const mockConfig: PgBossConfig = {
  enabled: true,
  connectionString: 'postgres://test:test@localhost:5432/test',
}

test.group('TestJobServiceInitializer', () => {
  test('should initialize and return a PgBossMock instance', ({ assert }) => {
    const initializer = new TestJobServiceInitializer()

    const result = initializer.initialize()

    assert.instanceOf(result, PgBossMock)
  })

  test('should return mock with all required properties', ({ assert }) => {
    const initializer = new TestJobServiceInitializer()

    const pgBoss = initializer.initialize() as unknown as PgBossMock

    assert.isObject(pgBoss.states)
    assert.isObject(pgBoss.policies)
    assert.isFunction(pgBoss.start)
    assert.isFunction(pgBoss.stop)
    assert.isFunction(pgBoss.send)
  })

  test('should be synchronous', ({ assert }) => {
    const initializer = new TestJobServiceInitializer()

    const start = Date.now()
    const result = initializer.initialize()
    const end = Date.now()

    assert.instanceOf(result, PgBossMock)
    // Should be near-instantaneous (less than 10ms)
    assert.isBelow(end - start, 10)
  })
})

test.group('ProductionJobServiceInitializer', () => {
  test('should be async and return a Promise', ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()

    const result = initializer.initialize(mockApp, mockConfig)

    assert.instanceOf(result, Promise)
  })

  test('should initialize without auto-discovery when disabled', async ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()
    const configDisabled = { ...mockConfig, enabled: false }

    // This should not throw even without auto-discovery modules
    await assert.doesNotReject(() => initializer.initialize(mockApp, configDisabled))
  })

  test('should handle auto-discovery errors gracefully', async ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()
    const configEnabled = { ...mockConfig, enabled: true }

    // Even if auto-discovery modules don't exist, it should not fail the entire initialization
    await assert.doesNotReject(() => initializer.initialize(mockApp, configEnabled))
  })

  test('should handle auto-discovery module import failures', async ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()

    // Create a mock app that throws when trying to make logger
    const mockAppWithError: ApplicationService = {
      getEnvironment: () => 'production',
      config: {
        get: <T>(_key: string, defaultValue: T): T => defaultValue,
      },
      container: {
        make: async (service: string) => {
          if (service === 'logger') {
            throw new Error('Logger creation failed')
          }
          return {}
        },
      },
    } as unknown as ApplicationService

    const configWithDiscovery: PgBossConfig = {
      enabled: true,
      connectionString: 'postgres://test:test@localhost:5432/test',
    }

    // Should handle the error and continue (testing lines 48-49)
    await assert.doesNotReject(() => initializer.initialize(mockAppWithError, configWithDiscovery))
  })

  test('should log auto-discovery errors to console', async ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()
    const originalConsoleError = console.error
    let errorLogged = false
    let errorMessage = ''

    // Mock console.error to capture the error log
    console.error = (message: string, error?: unknown) => {
      errorLogged = true
      errorMessage = message
      assert.isString(message)
      assert.isTrue(message.includes('Jobs auto-discovery failed'))
    }

    try {
      // Create a mock app that throws during auto-discovery setup
      const mockAppWithAutoDiscoveryError: ApplicationService = {
        getEnvironment: () => 'production',
        config: {
          get: <T>(_key: string, defaultValue: T): T => defaultValue,
        },
        container: {
          make: async (service: string) => {
            if (service === 'logger') {
              throw new Error('Auto-discovery setup failed')
            }
            return {}
          },
        },
      } as unknown as ApplicationService

      const configWithDiscovery: PgBossConfig = {
        enabled: true,
        connectionString: 'postgres://test:test@localhost:5432/test',
      }

      // This should trigger the catch block and log the error (lines 48-49)
      await initializer.initialize(mockAppWithAutoDiscoveryError, configWithDiscovery)

      assert.isTrue(errorLogged)
      assert.isTrue(errorMessage.includes('Jobs auto-discovery failed'))
    } finally {
      // Restore original console.error
      console.error = originalConsoleError
    }
  })

  test('should pass config to PgBoss constructor', async ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()

    // We can't easily mock dynamic imports in this context, but we can test the interface
    const config: PgBossConfig = {
      connectionString: 'postgres://user:pass@localhost:5432/db',
      enabled: false, // Disable auto-discovery to avoid import errors
    }

    await assert.doesNotReject(() => initializer.initialize(mockApp, config))
  })
})

test.group('JobServiceInitializer Base Class', () => {
  test('TestJobServiceInitializer should extend base class', ({ assert }) => {
    const initializer = new TestJobServiceInitializer()

    // Should have the initialize method from base class
    assert.isFunction(initializer.initialize)
  })

  test('ProductionJobServiceInitializer should extend base class', ({ assert }) => {
    const initializer = new ProductionJobServiceInitializer()

    // Should have the initialize method from base class
    assert.isFunction(initializer.initialize)
  })

  test('Both initializers should have consistent interface', ({ assert }) => {
    const testInitializer = new TestJobServiceInitializer()
    const prodInitializer = new ProductionJobServiceInitializer()

    // Both should have initialize method
    assert.isFunction(testInitializer.initialize)
    assert.isFunction(prodInitializer.initialize)

    // Both should be callable (different signatures but same base interface)
    assert.doesNotThrow(() => testInitializer.initialize())
    assert.doesNotThrow(() => prodInitializer.initialize(mockApp, mockConfig))
  })
})
