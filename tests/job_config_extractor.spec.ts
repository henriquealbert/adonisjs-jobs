import { test } from '@japa/runner'
import { JobConfigExtractor } from '../src/job_config_extractor.js'
import { Dispatchable } from '../src/dispatchable.js'
import { Schedulable } from '../src/schedulable.js'
import type { PgBossConfig } from '../src/types.js'

test.group('JobConfigExtractor', () => {
  test('extracts job config with defaults', async ({ assert }) => {
    const config: PgBossConfig = {
      defaultQueue: 'default',
      queues: ['default', 'emails'],
    }
    const extractor = new JobConfigExtractor(config)

    class TestJob extends Dispatchable {
      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(TestJob)

    assert.equal(jobConfig.jobName, 'test')
    assert.equal(jobConfig.queue, 'default')
    assert.isUndefined(jobConfig.workOptions)
  })

  test('extracts job config with custom properties', async ({ assert }) => {
    const config: PgBossConfig = {
      defaultQueue: 'default',
      queues: ['default', 'emails'],
    }
    const extractor = new JobConfigExtractor(config)

    class SendEmailJob extends Dispatchable {
      static jobName = 'custom-send-email'
      static queue = 'emails'
      static workOptions = { batchSize: 5 }

      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(SendEmailJob)

    assert.equal(jobConfig.jobName, 'custom-send-email')
    assert.equal(jobConfig.queue, 'emails')
    assert.deepEqual(jobConfig.workOptions, { batchSize: 5 })
  })

  test('converts class name to kebab-case', async ({ assert }) => {
    const config: PgBossConfig = {}
    const extractor = new JobConfigExtractor(config)

    class SendEmailNotificationJob extends Dispatchable {
      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(SendEmailNotificationJob)
    assert.equal(jobConfig.jobName, 'send-email-notification')
  })

  test('validates queue exists in config', async ({ assert }) => {
    const config: PgBossConfig = {
      queues: ['default', 'emails'],
    }
    const extractor = new JobConfigExtractor(config)

    class TestJob extends Dispatchable {
      static queue = 'invalid-queue'
      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(TestJob)

    assert.throws(
      () => extractor.validateJobConfig(jobConfig, '/path/to/test_job.ts'),
      'Invalid queue "invalid-queue" in /path/to/test_job.ts. Available queues: default, emails'
    )
  })

  test('allows any queue when queues not configured', async ({ assert }) => {
    const config: PgBossConfig = {}
    const extractor = new JobConfigExtractor(config)

    class TestJob extends Dispatchable {
      static queue = 'any-queue'
      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(TestJob)

    assert.doesNotThrow(() => extractor.validateJobConfig(jobConfig, '/path/to/test_job.ts'))
    assert.equal(jobConfig.queue, 'any-queue')
  })

  test('extracts cron config with required schedule', async ({ assert }) => {
    const config: PgBossConfig = {
      defaultQueue: 'default',
      queues: ['default', 'cron'],
    }
    const extractor = new JobConfigExtractor(config)

    class DailyCleanupCron extends Schedulable {
      static readonly schedule = '0 2 * * *'
      static queue = 'cron'
      static scheduleOptions = { priority: 5 }

      async handle(): Promise<void> {}
    }

    const cronConfig = extractor.extractCronConfig(DailyCleanupCron)

    assert.equal(cronConfig.jobName, 'daily-cleanup')
    assert.equal(cronConfig.queue, 'cron')
    assert.equal(cronConfig.schedule, '0 2 * * *')
    assert.deepEqual(cronConfig.scheduleOptions, { priority: 5 })
  })

  test('throws error when cron class missing schedule', async ({ assert }) => {
    const config: PgBossConfig = {}
    const extractor = new JobConfigExtractor(config)

    class InvalidCron extends Schedulable {
      async handle(): Promise<void> {}
    }

    assert.throws(
      () => extractor.extractCronConfig(InvalidCron),
      'Schedulable class InvalidCron must have static schedule property'
    )
  })
})
