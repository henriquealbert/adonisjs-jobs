import { test } from '@japa/runner'
import { JobWorkerManager } from '../src/job_worker_manager.js'
import { Job } from '../src/job.js'
import type PgBoss from 'pg-boss'
import type { WorkOptions, ScheduleOptions } from '../src/types.js'
import type { ApplicationService } from '@adonisjs/core/types'

test.group('JobWorkerManager', () => {
  test('registers worker with options', async ({ assert }) => {
    const mockPgBoss = {
      work: async (
        jobName: string,
        options: WorkOptions,
        handler: (jobs: PgBoss.Job[]) => Promise<void>
      ) => {
        assert.equal(jobName, 'test-job')
        assert.deepEqual(options, { batchSize: 5 })
        assert.isFunction(handler)
      },
    } as unknown as PgBoss

    const mockApp = {
      container: {
        make: async () => ({}) as never,
        call: async () => {},
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)

    class TestJob extends Job {
      async handle(_payload: unknown): Promise<void> {}
    }

    await manager.registerWorker('test-job', TestJob, { batchSize: 5 })
  })

  test('registers worker without options', async ({ assert }) => {
    const mockPgBoss = {
      work: async (
        jobName: string,
        options: WorkOptions,
        handler: (jobs: PgBoss.Job[]) => Promise<void>
      ) => {
        assert.equal(jobName, 'test-job')
        assert.deepEqual(options, {})
        assert.isFunction(handler)
      },
    } as unknown as PgBoss

    const mockApp = {
      container: {
        make: async () => ({}) as never,
        call: async () => {},
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)

    class TestJob extends Job {
      async handle(_payload: unknown): Promise<void> {}
    }

    await manager.registerWorker('test-job', TestJob)
  })

  test('schedules cron job with options', async ({ assert }) => {
    const mockPgBoss = {
      schedule: async (
        jobName: string,
        cron: string,
        data: Record<string, unknown>,
        options: ScheduleOptions
      ) => {
        assert.equal(jobName, 'test-job')
        assert.equal(cron, '0 0 * * *')
        assert.deepEqual(data, {})
        assert.deepEqual(options, { priority: 10 })
      },
    } as unknown as PgBoss

    const mockApp = {
      container: {
        make: async () => ({}) as never,
        call: async () => {},
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)

    await manager.scheduleJobIfCron('test-job', '0 0 * * *', { priority: 10 })
  })

  test('schedules cron job without options', async ({ assert }) => {
    const mockPgBoss = {
      schedule: async (
        jobName: string,
        cron: string,
        data: Record<string, unknown>,
        options: ScheduleOptions
      ) => {
        assert.equal(jobName, 'test-job')
        assert.equal(cron, '0 0 * * *')
        assert.deepEqual(data, {})
        assert.deepEqual(options, {})
      },
    } as unknown as PgBoss

    const mockApp = {
      container: {
        make: async () => ({}) as never,
        call: async () => {},
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)

    await manager.scheduleJobIfCron('test-job', '0 0 * * *')
  })

  test('does not schedule when no cron provided', async ({ assert }) => {
    let scheduleCalled = false
    const mockPgBoss = {
      schedule: async () => {
        scheduleCalled = true
      },
    } as unknown as PgBoss

    const mockApp = {
      container: {
        make: async () => ({}) as never,
        call: async () => {},
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)

    await manager.scheduleJobIfCron('test-job')
    assert.isFalse(scheduleCalled)
  })

  test('job handler creates instance and calls handle method', async ({ assert }) => {
    let handlerFunction: ((jobs: PgBoss.Job[]) => Promise<void>) | null = null
    let instanceCreated = false
    let handleCalled = false

    const mockPgBoss = {
      work: async (
        _jobName: string,
        _options: WorkOptions,
        handler: (jobs: PgBoss.Job[]) => Promise<void>
      ) => {
        handlerFunction = handler
      },
    } as unknown as PgBoss

    class TestJob extends Job {
      async handle(_payload: unknown): Promise<void> {
        handleCalled = true
      }
    }

    const mockApp = {
      container: {
        make: async (JobClass: typeof TestJob) => {
          instanceCreated = true
          return new JobClass()
        },
        call: async (instance: TestJob, _method: string, args: unknown[]) => {
          assert.isArray(args)
          return instance.handle(args[0])
        },
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)
    await manager.registerWorker('test-job', TestJob)

    assert.isFunction(handlerFunction)

    if (handlerFunction) {
      const mockJobs = [{ id: '123', data: { test: 'payload' } }] as PgBoss.Job[]
      await (handlerFunction as (jobs: PgBoss.Job[]) => Promise<void>)(mockJobs)

      assert.isTrue(instanceCreated)
      assert.isTrue(handleCalled)
    }
  })

  test('processes multiple jobs in batch', async ({ assert }) => {
    let handlerFunction: ((jobs: PgBoss.Job[]) => Promise<void>) | null = null
    let jobsProcessed = 0

    const mockPgBoss = {
      work: async (
        _jobName: string,
        _options: WorkOptions,
        handler: (jobs: PgBoss.Job[]) => Promise<void>
      ) => {
        handlerFunction = handler
      },
    } as unknown as PgBoss

    class TestJob extends Job {
      async handle(_payload: unknown): Promise<void> {
        jobsProcessed++
      }
    }

    const mockApp = {
      container: {
        make: async (JobClass: typeof TestJob) => new JobClass(),
        call: async (instance: TestJob, _method: string, args: unknown[]) => {
          return instance.handle(args[0])
        },
      },
    } as unknown as ApplicationService

    const manager = new JobWorkerManager(mockPgBoss, mockApp)
    await manager.registerWorker('test-job', TestJob)

    if (handlerFunction) {
      const mockJobs = [
        { id: '1', data: { test: 'job1' } },
        { id: '2', data: { test: 'job2' } },
        { id: '3', data: { test: 'job3' } },
      ] as PgBoss.Job[]

      await (handlerFunction as (jobs: PgBoss.Job[]) => Promise<void>)(mockJobs)
      assert.equal(jobsProcessed, 3)
    }
  })
})
