import { test } from '@japa/runner'
import type { ApplicationService, LoggerService } from '@adonisjs/core/types'
import { JobDiscovery } from '../src/job_discovery.js'
import { JobManager } from '../src/job_manager.js'
import type { PgBossConfig } from '../src/types.js'

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

// Mock ApplicationService for testing
const createMockApp = (
  environment: string = 'test',
  config: Record<string, unknown> = {}
): ApplicationService => {
  return {
    getEnvironment: () => environment,
    makePath: (path: string) => `/test/app/root/${path}`,
    config: {
      get: <T>(key: string, defaultValue: T): T => (config[key] as T) || defaultValue,
    },
    container: {
      make: async () => createMockLogger(),
    },
  } as unknown as ApplicationService
}

// Mock JobManager for testing
const createMockJobManager = (): JobManager => {
  return {
    registerJob: async () => {},
    schedule: async () => {},
  } as unknown as JobManager
}

test.group('JobDiscovery', () => {
  test('should be instantiable', ({ assert }) => {
    const app = createMockApp('test')
    const discovery = new JobDiscovery(app)

    assert.instanceOf(discovery, JobDiscovery)
  })

  test('should have discoverAll method', ({ assert }) => {
    const app = createMockApp('test')
    const discovery = new JobDiscovery(app)

    assert.isFunction(discovery.discoverAll)
  })

  test('should handle discoverAll without throwing when no jobs exist', async ({ assert }) => {
    // Mock empty job directories
    const jobsConfig: PgBossConfig = {
      paths: {
        jobs: 'empty/jobs',
        cron: 'empty/cron',
      },
    }

    const app = createMockApp('test', { jobs: jobsConfig })
    const discovery = new JobDiscovery(app)
    const jobManager = createMockJobManager()

    // Should handle empty directories gracefully
    await assert.doesNotReject(() => discovery.discoverAll(jobManager))
  })

  test('should handle default paths when none are configured', async ({ assert }) => {
    const jobsConfig: PgBossConfig = {}
    const app = createMockApp('test', { jobs: jobsConfig })
    const discovery = new JobDiscovery(app)
    const jobManager = createMockJobManager()

    // Should use default paths and not throw
    await assert.doesNotReject(() => discovery.discoverAll(jobManager))
  })

  test('should handle missing config gracefully', async ({ assert }) => {
    const app = createMockApp('test') // No config provided
    const discovery = new JobDiscovery(app)
    const jobManager = createMockJobManager()

    // Should handle missing config and not throw
    await assert.doesNotReject(() => discovery.discoverAll(jobManager))
  })
})
