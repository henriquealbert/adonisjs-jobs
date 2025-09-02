import { test } from '@japa/runner'
import type {
  PgBossConfig,
  ConstructorOptions,
  SendOptions,
  ScheduleOptions,
} from '../src/types.js'

test.group('Types', () => {
  test('should have PgBossConfig interface', ({ assert }) => {
    const config: PgBossConfig = {
      connectionString: 'postgres://test:test@localhost:5432/test',
      enabled: true,
      autoStart: false,
      shutdownTimeoutMs: 5000,
    }

    assert.isString(config.connectionString)
    assert.isBoolean(config.enabled)
    assert.isBoolean(config.autoStart)
    assert.isNumber(config.shutdownTimeoutMs)
  })

  test('should extend pg-boss ConstructorOptions', ({ assert }) => {
    const config: PgBossConfig = {
      connectionString: 'postgres://test:test@localhost:5432/test',
      // pg-boss specific options
      schema: 'custom_schema',
      max: 20,
      // Our custom options
      enabled: true,
      autoStart: false,
    }

    assert.isString(config.connectionString)
    assert.isString(config.schema)
    assert.isNumber(config.max)
    assert.isBoolean(config.enabled)
    assert.isBoolean(config.autoStart)
  })

  test('should re-export pg-boss types correctly', ({ assert }) => {
    // Test that we can use re-exported types
    const sendOptions: SendOptions = {
      priority: 5,
      retryLimit: 3,
    }

    const scheduleOptions: ScheduleOptions = {
      priority: 1,
    }

    const constructorOptions: ConstructorOptions = {
      connectionString: 'postgres://test:test@localhost:5432/test',
    }

    assert.isNumber(sendOptions.priority)
    assert.isNumber(sendOptions.retryLimit)
    assert.isNumber(scheduleOptions.priority)
    assert.isString(constructorOptions.connectionString)
  })
})
