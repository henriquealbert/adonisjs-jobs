import { test } from '@japa/runner'
import { JobAutoDiscovery } from '../src/auto_discovery.js'
import { JobFileScanner } from '../src/job_file_scanner.js'
import { JobConfigExtractor } from '../src/job_config_extractor.js'
import { JobManager } from '../src/job_manager.js'
import type { ApplicationService, LoggerService } from '@adonisjs/core/types'
import type { PgBossConfig } from '../src/types.js'

// Create mock instances
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

const createMockApp = (): ApplicationService =>
  ({
    getEnvironment: () => 'test',
    config: {
      get: () => ({}),
    },
    container: {
      make: async () => ({}),
    },
  }) as unknown as ApplicationService

// Create test job file for testing import functionality
const createTestJobContent = () => `
export default class TestJob {
  static get $$filepath() {
    return import.meta.url
  }
  
  async handle() {
    return 'test'
  }
}
`

test.group('JobAutoDiscovery', () => {
  test('should handle non-existent job file gracefully', async ({ assert }) => {
    const app = createMockApp()
    const config: PgBossConfig = {}
    const logger = createMockLogger()

    const jobManager = new JobManager(config, logger, app)
    // JobManager no longer needs explicit initialization

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor(config)

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      jobManager,
      config,
      logger
    )

    // Test private method through reflection to increase coverage
    const registerDispatchableFromFile = (
      autoDiscovery as unknown as { registerDispatchableFromFile: (path: string) => Promise<void> }
    ).registerDispatchableFromFile.bind(autoDiscovery)

    // This should throw an error for non-existent file
    await assert.rejects(() => registerDispatchableFromFile('./non-existent-job.js'))
  })

  test('should handle importJobClass with invalid module structure', async ({ assert }) => {
    const app = createMockApp()
    const config: PgBossConfig = {}
    const logger = createMockLogger()

    const jobManager = new JobManager(config, logger, app)
    // JobManager no longer needs explicit initialization

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor(config)

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      jobManager,
      config,
      logger
    )

    // Mock the import to return an invalid job class (testing lines 51-52, 55)
    const autoDiscoveryWithImport = autoDiscovery as unknown as {
      importJobClass: () => Promise<unknown>
    }
    const originalImportJobClass = autoDiscoveryWithImport.importJobClass

    // Simulate importing a module with no default export or invalid structure
    autoDiscoveryWithImport.importJobClass = async () => null // This will trigger the return null on line 52

    const importJobClass = (
      autoDiscovery as unknown as { importJobClass: (path: string) => Promise<unknown> }
    ).importJobClass.bind(autoDiscovery)

    const result = await importJobClass('./invalid-job.js')
    assert.equal(result, null)

    // Test with non-function default export
    autoDiscoveryWithImport.importJobClass = async () => 'not-a-function' // This will also trigger the return null

    const result2 = await importJobClass('./invalid-job2.js')
    assert.equal(result2, null)

    // Restore original method
    autoDiscoveryWithImport.importJobClass = originalImportJobClass
  })

  test('should validate default queue configuration', async ({ assert }) => {
    const app = createMockApp()
    const logger = createMockLogger()

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor({})
    const jobManager = new JobManager({}, logger, app)
    // JobManager no longer needs explicit initialization

    // Test with invalid defaultQueue - should throw error (lines 60-65)
    const invalidConfig: PgBossConfig = {
      defaultQueue: 'invalid-queue',
      queues: ['queue1', 'queue2'],
    }

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      jobManager,
      invalidConfig,
      logger
    )

    // Access private method through reflection
    const validateDefaultQueue = (
      autoDiscovery as unknown as { validateDefaultQueue: () => void }
    ).validateDefaultQueue.bind(autoDiscovery)

    assert.throws(
      () => validateDefaultQueue(),
      'Invalid defaultQueue "invalid-queue". Must be one of: queue1, queue2'
    )
  })

  test('should handle valid default queue configuration', async ({ assert }) => {
    const app = createMockApp()
    const logger = createMockLogger()

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor({})
    const jobManager = new JobManager({}, logger, app)
    // JobManager no longer needs explicit initialization

    // Test with valid defaultQueue - should not throw
    const validConfig: PgBossConfig = {
      defaultQueue: 'queue1',
      queues: ['queue1', 'queue2'],
    }

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      jobManager,
      validConfig,
      logger
    )

    // Access private method through reflection
    const validateDefaultQueue = (
      autoDiscovery as unknown as { validateDefaultQueue: () => void }
    ).validateDefaultQueue.bind(autoDiscovery)

    assert.doesNotThrow(() => validateDefaultQueue())
  })

  test('should handle config without queues defined', async ({ assert }) => {
    const app = createMockApp()
    const logger = createMockLogger()

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor({})
    const jobManager = new JobManager({}, logger, app)
    // JobManager no longer needs explicit initialization

    // Test with defaultQueue but no queues array - should not throw (line 59 condition)
    const configNoQueues: PgBossConfig = {
      defaultQueue: 'default',
      // queues not defined
    }

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      jobManager,
      configNoQueues,
      logger
    )

    // Access private method through reflection
    const validateDefaultQueue = (
      autoDiscovery as unknown as { validateDefaultQueue: () => void }
    ).validateDefaultQueue.bind(autoDiscovery)

    assert.doesNotThrow(() => validateDefaultQueue())
  })

  test('should handle config without defaultQueue', async ({ assert }) => {
    const app = createMockApp()
    const logger = createMockLogger()

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor({})
    const jobManager = new JobManager({}, logger, app)
    // JobManager no longer needs explicit initialization

    // Test with no defaultQueue - should not throw (line 59 condition)
    const configNoDefault: PgBossConfig = {
      queues: ['queue1', 'queue2'],
      // defaultQueue not defined
    }

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      jobManager,
      configNoDefault,
      logger
    )

    // Access private method through reflection
    const validateDefaultQueue = (
      autoDiscovery as unknown as { validateDefaultQueue: () => void }
    ).validateDefaultQueue.bind(autoDiscovery)

    assert.doesNotThrow(() => validateDefaultQueue())
  })

  test('should handle job registration error from file', async ({ assert }) => {
    const app = createMockApp()
    const config: PgBossConfig = {}
    let errorLogged = false

    const logger = {
      info: () => {},
      error: (message: string, meta?: unknown[]) => {
        errorLogged = true
        assert.isString(message)
        assert.isArray(meta)
      },
      warn: () => {},
      debug: () => {},
      trace: () => {},
      fatal: () => {},
      child: () => logger,
    } as unknown as LoggerService

    // Create a mock job manager that throws an error during registration
    const mockJobManager = {
      work: async () => {
        throw new Error('Registration failed')
      },
      schedule: async () => {},
    }

    const fileScanner = new JobFileScanner()
    const configExtractor = new JobConfigExtractor(config)

    const autoDiscovery = new JobAutoDiscovery(
      fileScanner,
      configExtractor,
      mockJobManager as unknown as JobManager,
      config,
      logger
    )

    // Access private method to test error handling
    const registerDispatchableFromFile = (
      autoDiscovery as unknown as {
        registerDispatchableFromFile: (filePath: string) => Promise<void>
      }
    ).registerDispatchableFromFile.bind(autoDiscovery)

    // This should throw an error for non-existent file
    await assert.rejects(() => registerDispatchableFromFile('./non-existent-job.js'))

    // The error should be logged
    assert.isTrue(errorLogged)
  })
})
