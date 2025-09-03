import { test } from '@japa/runner'
import { PgBossMock } from '../../src/mocks/pg_boss_mock.js'

test.group('PgBossMock', () => {
  test('should provide all required static properties', ({ assert }) => {
    const mock = new PgBossMock()

    assert.isObject(mock.states)
    assert.equal(mock.states.created, 'created')
    assert.equal(mock.states.retry, 'retry')
    assert.equal(mock.states.active, 'active')
    assert.equal(mock.states.completed, 'completed')
    assert.equal(mock.states.expired, 'expired')
    assert.equal(mock.states.cancelled, 'cancelled')
    assert.equal(mock.states.failed, 'failed')

    assert.isObject(mock.policies)
    assert.equal(mock.policies.standard, 'standard')
    assert.equal(mock.policies.short, 'short')
    assert.equal(mock.policies.singleton, 'singleton')
    assert.equal(mock.policies.stately, 'stately')
  })

  test('should handle lifecycle methods', async ({ assert }) => {
    const mock = new PgBossMock()

    const startResult = await mock.start()
    assert.equal(startResult, mock)

    await assert.doesNotReject(() => mock.stop())
  })

  test('should handle job sending methods', async ({ assert }) => {
    const mock = new PgBossMock()

    const sendResult = await mock.send()
    assert.equal(sendResult, 'mock-job-id')

    const sendAfterResult = await mock.sendAfter()
    assert.equal(sendAfterResult, 'mock-job-id')

    const sendThrottledResult = await mock.sendThrottled()
    assert.equal(sendThrottledResult, 'mock-job-id')

    const sendDebouncedResult = await mock.sendDebounced()
    assert.equal(sendDebouncedResult, 'mock-job-id')
  })

  test('should handle job management methods', async ({ assert }) => {
    const mock = new PgBossMock()

    await assert.doesNotReject(() => mock.insert())

    const fetchResult = await mock.fetch()
    assert.isArray(fetchResult)
    assert.lengthOf(fetchResult, 0)

    const workResult = await mock.work()
    assert.equal(workResult, 'mock-worker-id')

    await assert.doesNotReject(() => mock.offWork())

    assert.doesNotThrow(() => mock.notifyWorker())
  })

  test('should handle pub/sub methods', async ({ assert }) => {
    const mock = new PgBossMock()

    await assert.doesNotReject(() => mock.subscribe())
    await assert.doesNotReject(() => mock.unsubscribe())
    await assert.doesNotReject(() => mock.publish())
  })

  test('should handle job state management methods', async ({ assert }) => {
    const mock = new PgBossMock()

    await assert.doesNotReject(() => mock.cancel())
    await assert.doesNotReject(() => mock.resume())
    await assert.doesNotReject(() => mock.retry())
    await assert.doesNotReject(() => mock.deleteJob())
    await assert.doesNotReject(() => mock.complete())
    await assert.doesNotReject(() => mock.fail())
  })

  test('should handle job retrieval methods', async ({ assert }) => {
    const mock = new PgBossMock()

    const jobResult = await mock.getJobById()
    assert.equal(jobResult, null)
  })

  test('should handle queue management methods', async ({ assert }) => {
    const mock = new PgBossMock()

    await assert.doesNotReject(() => mock.createQueue())
    await assert.doesNotReject(() => mock.updateQueue())
    await assert.doesNotReject(() => mock.deleteQueue())
    await assert.doesNotReject(() => mock.purgeQueue())

    const queuesResult = await mock.getQueues()
    assert.isArray(queuesResult)
    assert.lengthOf(queuesResult, 0)

    const queueResult = await mock.getQueue()
    assert.equal(queueResult, null)

    const queueSizeResult = await mock.getQueueSize()
    assert.equal(queueSizeResult, 0)
  })

  test('should handle storage management methods', async ({ assert }) => {
    const mock = new PgBossMock()

    await assert.doesNotReject(() => mock.clearStorage())
    await assert.doesNotReject(() => mock.archive())
    await assert.doesNotReject(() => mock.purge())
    await assert.doesNotReject(() => mock.expire())
    await assert.doesNotReject(() => mock.maintain())

    const isInstalledResult = await mock.isInstalled()
    assert.equal(isInstalledResult, true)

    const schemaVersionResult = await mock.schemaVersion()
    assert.equal(schemaVersionResult, 1)
  })

  test('should handle scheduling methods', async ({ assert }) => {
    const mock = new PgBossMock()

    await assert.doesNotReject(() => mock.schedule())
    await assert.doesNotReject(() => mock.unschedule())

    const schedulesResult = await mock.getSchedules()
    assert.isArray(schedulesResult)
    assert.lengthOf(schedulesResult, 0)
  })

  test('should handle event methods', ({ assert }) => {
    const mock = new PgBossMock()

    const onResult = mock.on()
    assert.equal(onResult, mock)

    const offResult = mock.off()
    assert.equal(offResult, mock)
  })

  test('should handle static methods', ({ assert }) => {
    const mock = new PgBossMock()

    const constructionPlans = mock.getConstructionPlans()
    assert.equal(constructionPlans, 'mock-construction-plans')

    const migrationPlans = mock.getMigrationPlans()
    assert.equal(migrationPlans, 'mock-migration-plans')

    const rollbackPlans = mock.getRollbackPlans()
    assert.equal(rollbackPlans, 'mock-rollback-plans')
  })

  test('should be chainable for event methods', ({ assert }) => {
    const mock = new PgBossMock()

    // Test method chaining
    const chainResult = mock.on().off().on()
    assert.equal(chainResult, mock)
  })
})
