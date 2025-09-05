# @hschmaiske/jobs

A job queue and scheduler package for AdonisJS applications, built on [pg-boss](https://github.com/timgit/pg-boss) with zero abstractions and exceptional developer experience. Features automatic job discovery at boot time, eliminating boilerplate.

## Overview

@hschmaiske/jobs provides a clean, class-based approach to background job processing in AdonisJS applications with separate base classes for dispatchable jobs and scheduled cron tasks. Jobs are automatically discovered at boot time using configurable directory paths, following modern AdonisJS patterns while providing direct access to the pg-boss API.

## Key Features

- **Auto-Discovery**: Jobs automatically discovered at boot time, no `$$filepath` required
- **Configurable Paths**: Customize job and cron directories to fit your project structure
- **PostgreSQL Native**: Leverages your existing PostgreSQL database with ACID guarantees
- **Zero Abstractions**: Direct pg-boss API access without wrapper methods
- **TypeScript Support**: Full TypeScript support and pg-boss options
- **Cron Scheduling**: Built-in cron job support with flexible scheduling
- **AdonisJS Native**: Follows AdonisJS conventions with proper dependency injection

## Installation

```bash
node ace add @hschmaiske/jobs
```

This command will:

- Install the package and dependencies
- Add the provider to your `adonisrc.ts`
- Generate a `config/jobs.ts` configuration file
- Create example job and cron files (no `$$filepath` needed!)
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

  // Configurable directory paths (optional)
  paths: {
    jobs: 'app/jobs', // Dispatchable jobs directory
    cron: 'app/cron', // Schedulable jobs directory
  },
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

Jobs are dispatched using the `dispatch` method for Dispatchable jobs or `schedule` for cron tasks:

```typescript
import job from '@hschmaiske/jobs/services/main'
import SendEmailJob from '#jobs/send_email_job'
import DailyCleanupCron from '#cron/daily_cleanup_cron'

export default class UsersController {
  async register() {
    // Create user...

    // Dispatch a job immediately
    await job.dispatch(SendEmailJob, {
      userId: user.id,
      email: user.email,
      template: 'welcome',
    })

    // Schedule a cron job (usually done at startup, but auto-discovered!)
    await job.schedule(DailyCleanupCron, '0 2 * * *')

    // Or use the direct pg-boss API (jobs auto-discovered, no $$filepath needed)
    await job.raw.send('file:///path/to/SendEmailJob.js', {
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

### Auto-Discovery

Jobs and cron tasks are automatically discovered at boot time by scanning configured directories:

- **Dispatchable Jobs**: Discovered in `app/jobs` (or custom `paths.jobs`)
- **Schedulable Cron Tasks**: Discovered in `app/cron` (or custom `paths.cron`)
- **No Configuration Required**: Simply create job files and they're automatically registered
- **Type Safety**: Only `Dispatchable` jobs can be dispatched, `Schedulable` jobs are auto-scheduled

### Job Processing

Jobs are processed dynamically when dispatched or scheduled:

- **Dispatchable Jobs**: Use `job.dispatch(JobClass, payload)` to queue for processing
- **Schedulable Cron Tasks**: Auto-scheduled at boot time using their `static schedule` property

Jobs are loaded and instantiated dynamically using constructed file paths when processed.

### Queue Assignment

Jobs can be assigned to specific queues in three ways:

1. **Explicit assignment**: `static queue = 'emails'`
2. **Default queue**: Uses `defaultQueue` from configuration
3. **Fallback**: Uses `'default'` if no default is configured

### Job Processing

Jobs are processed by queue name and identified by their file paths:

- Jobs are dispatched to specific queues (default: 'default')
- Workers process jobs by importing them dynamically using auto-discovered file paths
- Each job instance is created with full dependency injection support

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

### Type-Safe Queues

Define queues once in configuration and get type safety everywhere:

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

### Queue Management

Configure job lifecycle and performance settings:

```typescript
const jobsConfig = defineConfig({
  // Queue configuration
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
  expireInHours: 23,
})
```

## Testing

The package automatically provides mock implementations in test environments:

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
    const jobId = await job.dispatch(SendEmailJob, {
      userId: '123',
      email: 'user@example.com',
      template: 'welcome',
    })

    assert.isString(jobId)
  })
})
```

## Why pg-boss?

- **PostgreSQL Native**: Uses your existing database infrastructure
- **ACID Compliance**: Jobs are stored with full database guarantees
- **Battle-tested**: Mature library with proven performance
- **Rich Features**: Built-in support for scheduling, retries, and pub/sub
- **Transactional**: Jobs can be created within database transactions

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
