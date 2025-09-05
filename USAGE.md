# Usage Examples

## Modern Approach (Type-Safe Job Dispatch!)

Jobs now use dynamic imports with `$$filepath` for flexible loading patterns:

```typescript
// 1. Define dispatchable jobs
export default class CreateDatabase extends Dispatchable {
  // REQUIRED: Enables dynamic imports and job identification
  static get $$filepath() {
    return import.meta.url
  }

  static queue = 'databases'

  async handle({ name }: { name: string }) {
    // Create database logic
  }
}

// 2. Define schedulable cron tasks
export default class OAuthTokensCleanup extends Schedulable {
  // REQUIRED: Enables dynamic imports and job identification
  static get $$filepath() {
    return import.meta.url
  }

  static readonly schedule = '0 * * * *' // Hourly cleanup
  static queue = 'cron'

  async handle() {
    // Cleanup logic (no payload for cron tasks)
  }
}

// 3. Dispatch jobs from anywhere - Type-Safe!
import jobs from '@hschmaiske/jobs/services/main'
import CreateDatabase from '#jobs/create_database_job'
import OAuthTokensCleanup from '#cron/oauth_tokens_cleanup_cron'

// Dispatch a job immediately (Type-safe)
await jobs.dispatch(CreateDatabase, { name: 'myapp' })

// Schedule a cron job (usually done at app startup)
await jobs.schedule(OAuthTokensCleanup, '0 * * * *')

// Or use direct pg-boss API
await jobs.raw.send('default', {
  $$filepath: CreateDatabase.$$filepath,
  payload: { name: 'myapp' },
})
```

## Key Changes

- **No Auto-Discovery**: Jobs aren't automatically discovered from directories
- **Dynamic Loading**: Jobs are loaded when needed using their `$$filepath` property
- **Explicit Dispatch**: Use `jobs.dispatch(JobClass, payload)` for immediate jobs
- **Explicit Scheduling**: Use `jobs.schedule(CronClass, schedule)` for cron tasks
- **Flexible Loading**: Jobs can be organized anywhere, as long as they have `$$filepath`

## Processing Jobs

Start workers to process queues:

```bash
# Process all configured queues
node ace job:listen

# Process specific queues only
node ace job:listen -q databases -q emails
```

## Advanced Usage

### Custom Job Options

```typescript
export default class ProcessPayment extends Dispatchable {
  static get $$filepath() {
    return import.meta.url
  }

  static queue = 'payments'
  static workOptions = {
    batchSize: 1,
    teamSize: 3,
    priority: 100,
    retryLimit: 1,
    expireInHours: 1,
  }

  async handle(payload: PaymentPayload) {
    // Critical payment processing
  }
}
```

### Dependency Injection

```typescript
import { inject } from '@adonisjs/core'
import { Dispatchable } from '@hschmaiske/jobs'
import MailService from '#services/mail_service'
import Logger from '@adonisjs/core/services/logger'

@inject()
export default class SendEmail extends Dispatchable {
  static get $$filepath() {
    return import.meta.url
  }

  constructor(
    private mailService: MailService,
    private logger: Logger
  ) {
    super()
  }

  async handle({ to, subject, template }: EmailPayload) {
    this.logger.info(`Sending email to ${to}`)
    await this.mailService.send(to, subject, template)
  }
}
```

### Type-Safe Queue Configuration

```typescript
// config/jobs.ts
const jobsConfig = defineConfig({
  queues: ['default', 'emails', 'payments', 'reports'] as const,
  defaultQueue: 'default',
})

export type QueueNames = NonNullable<typeof jobsConfig.queues>[number]
export default jobsConfig
```

```typescript
// app/jobs/send_email_job.ts
import type { QueueNames } from '#config/jobs'

export default class SendEmail extends Dispatchable {
  static queue: QueueNames = 'emails' // ✅ Type-safe
}
```

## Migration from Auto-Discovery

If migrating from the old auto-discovery approach:

1. **Remove** any directory scanning logic from your code
2. **Add** `$$filepath` property to all job classes
3. **Update** job dispatching to use `jobs.dispatch(JobClass, payload)`
4. **Update** cron scheduling to use `jobs.schedule(CronClass, schedule)`
5. **Start** workers with `node ace job:listen`

That's it! The new approach is simpler and more flexible.
