# Usage Examples

## Typical Usage (Type-Safe Job Dispatch!)

Since Job and Cron classes auto-register workers and schedules, you only need to **dispatch** jobs:

```typescript
// 1. Define dispatchable jobs (auto-register)
export default class CreateDatabase extends Dispatchable {
  // REQUIRED: Enables dynamic imports with AdonisJS path aliases
  static get $$filepath() {
    return import.meta.url
  }

  static queue = 'databases'

  async handle({ name }: { name: string }) {
    // Create database logic
  }
}

// 2. Define schedulable cron tasks (auto-scheduled)
export default class OAuthTokensCleanup extends Schedulable {
  // REQUIRED: Enables dynamic imports with AdonisJS path aliases
  static get $$filepath() {
    return import.meta.url
  }

  static readonly schedule = '0 * * * *' // Auto-scheduled hourly
  static queue = 'cron'

  async handle() {
    // Cleanup logic (no payload for cron tasks)
  }
}

// 3. Dispatch jobs from anywhere - Type-Safe!
import jobs from '@hschmaiske/jobs/services/main'
import CreateDatabase from '#jobs/create_database_job'

// Type-safe dispatch (recommended)
await jobs.dispatch(CreateDatabase, { name: 'myapp' })

// Or use direct pg-boss API
await jobs.raw.send('create-database', { name: 'myapp' })
await jobs.raw.sendAfter('create-database', 60, { name: 'delayed-db' }) // 60 seconds

// That's it! No worker registration, no scheduling - Classes handle everything
```

## Advanced Usage (Raw PgBoss API)

For any PgBoss features not wrapped by JobManager, access the raw instance:

```typescript
import jobs from '@hschmaiske/jobs/services/main'

// Access raw PgBoss instance
const pgBoss = jobs.raw

// Use any PgBoss API directly
await pgBoss.publish('my-topic', { data: 'something' })
await pgBoss.subscribe('my-topic', handler)

// Advanced queue management
await pgBoss.deleteQueue('old-queue')
await pgBoss.clearStorage()

// Monitoring
const health = await pgBoss.getQueueSize('my-queue')
```

## Why This Approach?

1. **Type Safety**: Full TypeScript support with auto-inferred payload types
2. **Convenience**: Most common operations have wrapper methods
3. **Flexibility**: Full PgBoss API available via `.raw`
4. **Clean Separation**: Dispatchable jobs vs Schedulable cron tasks
5. **Maintenance**: Less wrapper code to maintain when PgBoss updates
6. **Future-proof**: New PgBoss features immediately available

## Migration from Raw PgBoss

If you were using PgBoss directly:

```typescript
// Old way
const pgBoss = await app.container.make('pgboss')
await pgBoss.send('job', data)

// New way - type-safe dispatch (recommended)
const jobs = await app.container.make('hschmaiske/jobs')
await jobs.dispatch(MyJobClass, data)

// New way - raw access (for advanced features)
const jobs = await app.container.make('hschmaiske/jobs')
await jobs.raw.send('job', data)
```
