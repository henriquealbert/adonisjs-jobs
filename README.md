# @hschmaiske/jobs

A job queue and scheduler package for AdonisJS applications, built on [pg-boss](https://github.com/timgit/pg-boss) with zero abstractions and exceptional developer experience.

## Overview

@hschmaiske/jobs provides a clean, class-based approach to background job processing in AdonisJS applications with separate base classes for dispatchable jobs and scheduled cron tasks. Jobs are automatically discovered from your `app/jobs/` and `app/cron/` directories, eliminating manual registration while providing direct access to the pg-boss API.

## Key Features

- **Auto-Discovery**: Jobs and cron tasks are automatically discovered from `app/jobs/` and `app/cron/` - no manual setup required
- **PostgreSQL Native**: Leverages your existing PostgreSQL database with ACID guarantees
- **Zero Abstractions**: Direct pg-boss API access without wrapper methods
- **TypeScript Support**: Full TypeScript support and pg-boss options
- **Cron Scheduling**: Built-in cron job support with overlap prevention
- **AdonisJS Native**: Follows AdonisJS conventions with proper dependency injection

## Installation

```bash
node ace add @hschmaiske/jobs
```

This command will:

- Install the package and dependencies
- Add the provider to your `adonisrc.ts`
- Generate a `config/jobs.ts` configuration file
- Create `app/jobs/` and `app/cron/` directories with example files
- Configure TypeScript paths for `#jobs/*` and `#cron/*` imports
- Register CLI commands for job management

## Quick Start

### 1. Configuration

The installer creates a `config/jobs.ts` file that uses your existing database connection:

```typescript
import { defineConfig } from '@hschmaiske/jobs'
import env from '#start/env'

const jobsConfig = defineConfig({
  // Database connection (reuses Lucid settings)
  host: env.get('DB_HOST'),
  port: env.get('DB_PORT'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD'),
  database: env.get('DB_DATABASE'),
  schema: 'pgboss',

  // Queue configuration
  queues: ['default', 'emails', 'reports'] as const,
  defaultQueue: 'default',
  jobsPath: 'app/jobs',
  cronPath: 'app/cron',
})

// Define your queue names type automatically from config
export type QueueNames = NonNullable<typeof jobsConfig.queues>[number]

export default jobsConfig
```

### 2. Creating Jobs

Generate job classes using the CLI:

```bash
# Create a queue job
node ace make:job SendEmail

# Create a cron job
node ace make:cron DailyCleanup
```

### 3. Implementing Job Logic

**Dispatchable Job** (`app/jobs/send_email_job.ts`):

```typescript
import { Dispatchable } from '@hschmaiske/jobs'
import { inject } from '@adonisjs/core'
import MailService from '#services/mail_service'
import Logger from '@adonisjs/core/services/logger'
import type { QueueNames } from '#config/jobs'

export interface SendEmailPayload {
  userId: string
  email: string
  template: string
}

@inject()
export default class SendEmailJob extends Dispatchable {
  static queue: QueueNames = 'emails' // ← Type-safe queue assignment

  constructor(
    private mailService: MailService,
    private logger: Logger
  ) {
    super()
  }

  async handle(payload: SendEmailPayload) {
    // Use injected services with full dependency injection support
    this.logger.info('Sending email', payload)
    await this.mailService.send(payload.email, payload.template, {
      userId: payload.userId,
    })
  }
}
```

**Schedulable Cron Task** (`app/cron/daily_cleanup_cron.ts`):

```typescript
import { Schedulable } from '@hschmaiske/jobs'
import { inject } from '@adonisjs/core'
import Database from '@adonisjs/lucid/services/db'
import Logger from '@adonisjs/core/services/logger'

@inject()
export default class DailyCleanupCron extends Schedulable {
  static readonly schedule = '0 2 * * *' // Daily at 2 AM

  constructor(
    private db: Database,
    private logger: Logger
  ) {
    super()
  }

  async handle() {
    this.logger.info('Starting daily cleanup')

    // Clean up old records using Lucid
    await this.db
      .from('temporary_files')
      .where('created_at', '<', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .delete()

    this.logger.info('Daily cleanup completed')
  }
}
```

### 4. Dispatching Jobs

Jobs are dispatched using type-safe dispatch methods:

```typescript
import job from '@hschmaiske/jobs/services/main'
import SendEmailJob from '#jobs/send_email_job'

export default class UsersController {
  async register() {
    // Create user...

    // Type-safe dispatch with auto-inferred payload type
    await job.dispatch(SendEmailJob, {
      userId: user.id,
      email: user.email,
      template: 'welcome',
    })

    // Or use the direct pg-boss API
    await job.raw.send('send-email', {
      userId: user.id,
      email: user.email,
      template: 'welcome',
    })
  }
}
```

### 5. Running Workers

Start job workers to process queues:

```bash
# Process all configured queues
node ace job:listen

# Process specific queues only
node ace job:listen -q emails -q reports
```

## Core Concepts

### Automatic Discovery

Jobs and cron tasks are automatically discovered and registered:

- **Dispatchable Jobs**: Located in `app/jobs/` directory, files ending with `_job.ts` or `_job.js`
- **Schedulable Cron Tasks**: Located in `app/cron/` directory, files ending with `_cron.ts` or `_cron.js`

All classes are automatically registered with pg-boss on application startup.

### Queue Assignment

Jobs can be assigned to specific queues in three ways:

1. **Explicit assignment**: `static queue = 'emails'`
2. **Default queue**: Uses `defaultQueue` from configuration
3. **Fallback**: Uses `'default'` if no default is configured

### Job Naming

Job names are automatically generated from class names by:

1. Removing the `Job` or `Cron` suffix
2. Converting PascalCase to kebab-case
3. Using lowercase

For example:

- `SendEmailJob` becomes `send-email`
- `DailyCleanupCron` becomes `daily-cleanup`

## CLI Commands

| Command                         | Description                       |
| ------------------------------- | --------------------------------- |
| `node ace make:job <name>`      | Create a new queue job class      |
| `node ace make:cron <name>`     | Create a new cron job class       |
| `node ace job:listen`           | Process all registered jobs       |
| `node ace job:listen -q <name>` | Process jobs from specific queues |

## Advanced Features

### Dependency Injection

Jobs support full AdonisJS dependency injection using the `@inject()` decorator:

```typescript
import { Dispatchable } from '@hschmaiske/jobs'
import { inject } from '@adonisjs/core'
import UserService from '#services/user_service'
import Database from '@adonisjs/lucid/services/db'
import Logger from '@adonisjs/core/services/logger'

@inject()
export default class ProcessUserDataJob extends Dispatchable {
  constructor(
    private userService: UserService,
    private db: Database,
    private logger: Logger
  ) {
    super()
  }

  async handle(payload: { userId: string }) {
    this.logger.info(`Processing user data for ${payload.userId}`)

    // Use injected services
    const user = await this.userService.find(payload.userId)
    await this.db.insertQuery().table('user_analytics').insert({
      user_id: user.id,
      processed_at: new Date(),
    })
  }
}
```

All AdonisJS services are available for injection, including:

- Database connections and models
- Logger service
- Custom services from your application
- Third-party services registered in the container

### Custom Job Options

Jobs support all pg-boss options through static properties:

```typescript
export default class ProcessPaymentJob extends Dispatchable {
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

### Cron Task Configuration

Cron tasks support scheduling options to prevent overlaps:

```typescript
export default class WeeklyReportCron extends Schedulable {
  static readonly schedule = '0 8 * * 1' // Monday 8 AM
  static queue = 'reports'

  static scheduleOptions = {
    singletonKey: 'weekly-report',
    singletonSeconds: 604800, // 1 week lock
    priority: 5,
    retryLimit: 1,
  }

  async handle() {
    // Generate weekly reports (no payload for cron tasks)
  }
}
```

### Type-Safe Queues

Define queues once in configuration and get type safety everywhere. Two approaches are available:

#### Approach 1: Manual Type Definition (Recommended)

Simple and reliable type definition that always works:

```typescript
// config/jobs.ts
const jobsConfig = defineConfig({
  queues: ['default', 'emails', 'payments', 'reports'] as const,
})

// Define your queue names type
export type QueueNames = NonNullable<typeof jobsConfig.queues>[number]

export default jobsConfig
```

```typescript
// app/jobs/send_email_job.ts
import { Dispatchable } from '@hschmaiske/jobs'
import type { QueueNames } from '#config/jobs'

export default class SendEmailJob extends Dispatchable {
  static queue: QueueNames = 'emails' // ✅ Type-safe with autocomplete
}
```

#### Approach 2: Module Augmentation (Advanced)

Automatic type inference using TypeScript module augmentation:

```typescript
// config/jobs.ts
import type { InferQueues } from '@hschmaiske/jobs'

const jobsConfig = defineConfig({
  queues: ['default', 'emails', 'payments', 'reports'] as const,
})

// Augment the module for automatic type inference
declare module '@hschmaiske/jobs' {
  interface JobQueues {
    queues: InferQueues<typeof jobsConfig>
  }
}

export default jobsConfig
```

```typescript
// app/jobs/send_email_job.ts
import { Dispatchable } from '@hschmaiske/jobs'

export default class SendEmailJob extends Dispatchable {
  static queue = 'emails' // ✅ Auto-inferred type with autocomplete!
}
```

### Direct pg-boss API Access

The package provides zero abstractions over pg-boss. Access the full API directly:

```typescript
import job from '@hschmaiske/jobs/services/main'

// All pg-boss methods are available through .raw
await job.raw.send('job-name', data, { priority: 10 })
await job.raw.schedule('recurring-job', '0 0 * * *', data)
await job.raw.publish('user-events', { userId: 123 })

// Monitoring and management
const queueSize = await job.raw.getQueueSize('emails')
const jobDetails = await job.raw.getJobById('uuid')
```

For comprehensive API documentation, refer to the [pg-boss documentation](https://timgit.github.io/pg-boss/).

### Production Deployment

Separate workers by queue for optimal resource allocation:

```bash
#!/bin/bash
# production-workers.sh

# Start separate processes for different queue groups
node ace job:listen -q emails -q payments &  # High-priority queues
node ace job:listen -q reports -q maintenance &  # Background queues

wait
```

## Configuration Reference

### Database Options

All pg-boss database options are supported. Common configurations:

```typescript
const jobsConfig = defineConfig({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'username',
  password: 'password',
  schema: 'pgboss', // Separate schema for pg-boss tables

  // Connection pool settings
  max: 10,
  connectionTimeoutMillis: 5000,
})
```

### Job Management

Configure job lifecycle and performance settings:

```typescript
const jobsConfig = defineConfig({
  // Job discovery
  jobsPath: 'app/jobs',
  cronPath: 'app/cron',
  queues: ['default', 'emails', 'reports'],
  defaultQueue: 'default',

  // Performance tuning
  pollingIntervalSeconds: 2,
  maintenanceIntervalSeconds: 120,

  // Lifecycle management
  retentionDays: 7,
  archiveCompletedAfterSeconds: 43200,
  deleteAfterDays: 7,

  // Default job settings
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInHours: 24,
})
```

## Why pg-boss?

- **PostgreSQL Native**: Uses your existing database infrastructure
- **ACID Compliance**: Jobs are stored with full database guarantees
- **Battle-tested**: Mature library with proven performance
- **Rich Features**: Built-in support for scheduling, retries, and pub/sub
- **Transactional**: Jobs can be created within database transactions

## Testing

Testing job processing is crucial for reliable applications. The package provides comprehensive mocking support for Japa testing framework in AdonisJS projects.

### Test Setup

The package automatically provides mock implementations in test environments. No additional configuration is required - just write your tests:

```typescript
// tests/functional/jobs/send_email_job.spec.ts
import { test } from '@japa/runner'
import SendEmailJob from '#app/jobs/send_email_job'
import job from '@hschmaiske/jobs/services/main'

test.group('SendEmailJob', () => {
  test('should process email payload correctly', async ({ assert }) => {
    const emailJob = new SendEmailJob()
    const payload = {
      userId: '123',
      email: 'user@example.com',
      template: 'welcome',
    }

    // Test job logic directly
    await assert.doesNotReject(() => emailJob.handle(payload))
  })

  test('should dispatch job successfully', async ({ assert }) => {
    // Jobs are automatically mocked in test environment
    const jobId = await job.raw.send('send-email', {
      userId: '123',
      email: 'user@example.com',
      template: 'welcome',
    })

    assert.isString(jobId)
    assert.equal(jobId, 'mock-job-id')
  })
})
```

### Testing Job Dispatch

Test controllers that dispatch jobs without actually processing them:

```typescript
// tests/functional/users_controller.spec.ts
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'

test.group('Users Controller', () => {
  test('should dispatch welcome email on registration', async ({ client, assert }) => {
    const response = await client.post('/users').json({
      email: 'new@example.com',
      password: 'password123',
    })

    response.assertStatus(201)

    // In test environment, jobs are mocked and don't actually execute
    // Test the business logic separately in job-specific tests
  })
})
```

### Testing Cron Jobs

Test cron job logic without relying on scheduling:

```typescript
// tests/functional/jobs/daily_cleanup_job.spec.ts
import { test } from '@japa/runner'
import DailyCleanupJob from '#app/jobs/daily_cleanup_job'
import Database from '@adonisjs/lucid/services/db'

test.group('DailyCleanupJob', () => {
  test('should clean up old temporary files', async ({ assert }) => {
    // Create test data
    await Database.table('temporary_files').insert([
      { name: 'old.txt', created_at: new Date('2023-01-01') },
      { name: 'recent.txt', created_at: new Date() },
    ])

    // Execute job logic
    const cleanupJob = new DailyCleanupJob()
    await cleanupJob.handle()

    // Verify cleanup occurred
    const remaining = await Database.from('temporary_files').select('*')
    assert.lengthOf(remaining, 1)
    assert.equal(remaining[0].name, 'recent.txt')
  })
})
```

### Mock Behavior

In test environments, the package provides:

- **Automatic Mocking**: All pg-boss methods return predictable mock responses
- **No Side Effects**: Jobs don't actually execute or connect to queues
- **Consistent Returns**: Methods like `send()` return `'mock-job-id'`
- **Error Simulation**: Test error scenarios by mocking failures when needed

### Custom Test Scenarios

For advanced testing scenarios, you can test specific pg-boss interactions:

```typescript
test('should handle job retry logic', async ({ assert }) => {
  // Test retry limits and backoff strategies
  const jobOptions = {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
  }

  const jobId = await job.raw.send('flaky-job', { data: 'test' }, jobOptions)

  // In test environment, this returns mock data
  assert.isString(jobId)

  // Test your job's error handling directly
  const flakyJob = new FlakyJob()
  await assert.rejects(() => flakyJob.handle({ shouldFail: true }))
})
```

### Testing Best Practices

1. **Test Job Logic Separately**: Test the `handle()` method directly for business logic
2. **Test Dispatch Integration**: Verify jobs are dispatched from controllers/services
3. **Mock External Dependencies**: Use dependency injection to mock external services
4. **Test Error Scenarios**: Ensure proper error handling and retry logic
5. **Database Cleanup**: Use Japa's database cleanup features for consistent tests

## API Reference

This package provides direct access to the pg-boss API. For detailed documentation on all available methods and options, see:

- [pg-boss Documentation](https://timgit.github.io/pg-boss/)
- [Job Creation](https://timgit.github.io/pg-boss/#job-creation)
- [Queue Processing](https://timgit.github.io/pg-boss/#queue-processing)
- [Scheduling & Cron](https://timgit.github.io/pg-boss/#scheduling)
- [Configuration Options](https://timgit.github.io/pg-boss/#configuration)

## License

MIT License

## Contributing

Pull requests are welcome for bug fixes and improvements.
