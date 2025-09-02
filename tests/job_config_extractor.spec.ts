import { test } from '@japa/runner'
import { JobConfigExtractor } from '../src/job_config_extractor.js'
import { Job } from '../src/job.js'
import type { PgBossConfig } from '../src/types.js'

test.group('JobConfigExtractor', () => {
  test('extracts job config with defaults', async ({ assert }) => {
    const config: PgBossConfig = {
      defaultQueue: 'default',
      queues: ['default', 'emails'],
    }
    const extractor = new JobConfigExtractor(config)

    class TestJob extends Job {
      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(TestJob)

    assert.equal(jobConfig.jobName, 'test')
    assert.equal(jobConfig.queue, 'default')
    assert.isUndefined(jobConfig.cron)
    assert.isUndefined(jobConfig.workOptions)
    assert.isUndefined(jobConfig.scheduleOptions)
  })

  test('extracts job config with custom properties', async ({ assert }) => {
    const config: PgBossConfig = {
      defaultQueue: 'default',
      queues: ['default', 'emails'],
    }
    const extractor = new JobConfigExtractor(config)

    class SendEmailJob extends Job {
      static jobName = 'custom-send-email'
      static queue = 'emails'
      static cron = '0 0 * * *'
      static workOptions = { batchSize: 5 }
      static scheduleOptions = { priority: 10 }

      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(SendEmailJob)

    assert.equal(jobConfig.jobName, 'custom-send-email')
    assert.equal(jobConfig.queue, 'emails')
    assert.equal(jobConfig.cron, '0 0 * * *')
    assert.deepEqual(jobConfig.workOptions, { queue: 'emails', batchSize: 5 })
    assert.deepEqual(jobConfig.scheduleOptions, { queue: 'emails', priority: 10 })
  })

  test('converts class name to kebab-case', async ({ assert }) => {
    const config: PgBossConfig = {}
    const extractor = new JobConfigExtractor(config)

    class SendEmailNotificationJob extends Job {
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

    class TestJob extends Job {
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

    class TestJob extends Job {
      static queue = 'any-queue'
      async handle(_payload: unknown): Promise<void> {}
    }

    const jobConfig = extractor.extractJobConfig(TestJob)

    assert.doesNotThrow(() => extractor.validateJobConfig(jobConfig, '/path/to/test_job.ts'))
    assert.equal(jobConfig.queue, 'any-queue')
  })
})
