import { test } from '@japa/runner'
import { defineConfig } from '../src/define_config.js'
import type { PgBossConfig } from '../src/types.js'

test.group('defineConfig', () => {
  test('should return the same config object', ({ assert }) => {
    const config: PgBossConfig = {
      connectionString: 'postgres://test:test@localhost:5432/test',
    }

    const result = defineConfig(config)

    assert.deepEqual(result, config)
    assert.equal(result.connectionString, config.connectionString)
  })

  test('should work with empty config', ({ assert }) => {
    const config: PgBossConfig = {}

    const result = defineConfig(config)

    assert.deepEqual(result, config)
    assert.deepEqual(result, {})
  })

  test('should preserve all pg-boss options', ({ assert }) => {
    const config: PgBossConfig = {
      connectionString: 'postgres://test:test@localhost:5432/test',
      schema: 'custom_schema',
      max: 15,
      // Our extensions
      shutdownTimeoutMs: 10000,
    }

    const result = defineConfig(config)

    assert.equal(result.connectionString, config.connectionString)
    assert.equal(result.schema, config.schema)
    assert.equal(result.max, config.max)
    assert.equal(result.shutdownTimeoutMs, config.shutdownTimeoutMs)
  })

  test('should provide type safety', ({ assert }) => {
    // This is mainly a compile-time test
    const config = defineConfig({
      connectionString: 'postgres://test:test@localhost:5432/test',
    })

    // TypeScript should infer the correct return type
    assert.isString(config.connectionString)
  })
})
