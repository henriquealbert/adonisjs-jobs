# @hschmaiske/jobs

A job queue and scheduler package for AdonisJS applications, built on [pg-boss](https://github.com/timgit/pg-boss) with zero abstractions and exceptional developer experience.

## Overview

@hschmaiske/jobs provides a clean, class-based approach to background job processing in AdonisJS applications. Jobs are automatically discovered from your `app/jobs/` directory, eliminating manual registration while providing direct access to the pg-boss API.

## Key Features

- **Auto-Discovery**: Jobs are automatically registered from `app/jobs/` - no manual setup required
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
})

// Define your queue names type automatically from config
export type QueueNames = typeof jobsConfig.queues[number]

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

**Queue Job** (`app/jobs/send_email_job.ts`):

```typescript
import { Job } from '@hschmaiske/jobs'
import { inject } from '@adonisjs/core'
import MailService from '#services/mail_service'
import type { QueueNames } from '#config/jobs'

export interface SendEmailPayload {
  userId: string
  email: string
  template: string
}

@inject()
export default class SendEmailJob extends Job {
  static queue: QueueNames = 'emails' // ← Type-safe queue assignment

  constructor(private mailService: MailService) {
    super()
  }

  async handle(payload: SendEmailPayload) {
    // Use injected services
    await this.mailService.send(payload.email, payload.template, {
      userId: payload.userId,
    })
  }
}
```

**Cron Job** (`app/jobs/daily_cleanup_job.ts`):

```typescript
import { Job } from '@hschmaiske/jobs'
import { inject } from '@adonisjs/core'
import Database from '@adonisjs/lucid/services/db'
import Logger from '@adonisjs/core/services/logger'

@inject()
export default class DailyCleanupJob extends Job {
  static cron = '0 2 * * *' // Daily at 2 AM

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

Jobs are dispatched using the direct pg-boss API:

```typescript
import job from '@hschmaiske/jobs/services/main'

export default class UsersController {
  async register() {
    // Create user...

    // Dispatch job
    await job.send('send-email', {
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
# Development - process all jobs
node ace job:listen

# Production - process specific queues
node ace job:queue emails --concurrency 10
node ace job:queue maintenance --concurrency 2
```

## Core Concepts

### Automatic Job Discovery

Jobs are automatically discovered and registered from your `app/jobs/` directory. Any file ending with `_job.ts` or `_job.js` is considered a job class and will be registered with pg-boss.

### Queue Assignment

Jobs can be assigned to specific queues in three ways:

1. **Explicit assignment**: `static queue = 'emails'`
2. **Default queue**: Uses `defaultQueue` from configuration
3. **Fallback**: Uses `'default'` if no default is configured

### Job Naming

Job names are automatically generated from class names by:

1. Removing the `Job` suffix
2. Converting PascalCase to kebab-case
3. Using lowercase

For example, `SendEmailJob` becomes `send-email`.

## CLI Commands

| Command                     | Description                        |
| --------------------------- | ---------------------------------- |
| `node ace make:job <name>`  | Create a new queue job class       |
| `node ace make:cron <name>` | Create a new cron job class        |
| `node ace job:listen`       | Process all registered jobs        |
| `node ace job:queue <name>` | Process jobs from a specific queue |

## Advanced Features

### Dependency Injection

Jobs support full AdonisJS dependency injection using the `@inject()` decorator:

```typescript
import { Job } from '@hschmaiske/jobs'
import { inject } from '@adonisjs/core'
import UserService from '#services/user_service'
import Database from '@adonisjs/lucid/services/db'
import Logger from '@adonisjs/core/services/logger'

@inject()
export default class ProcessUserDataJob extends Job {
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
export default class ProcessPaymentJob extends Job {
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

### Cron Job Configuration

Cron jobs support scheduling options to prevent overlaps:

```typescript
export default class WeeklyReportJob extends Job {
  static cron = '0 8 * * 1' // Monday 8 AM
  static queue = 'reports'

  static scheduleOptions = {
    singletonKey: 'weekly-report',
    singletonSeconds: 604800, // 1 week lock
    priority: 5,
    retryLimit: 1,
  }

  async handle() {
    // Generate weekly reports
  }
}
```

### Type-Safe Queues

Define queues once in configuration and get autocomplete everywhere:

```typescript
// config/jobs.ts
const jobsConfig = defineConfig({
  queues: ['default', 'emails', 'payments', 'reports'] as const,
})

// Define your queue names type automatically from config
export type QueueNames = typeof jobsConfig.queues[number]

export default jobsConfig
```

```typescript
// app/jobs/send_email_job.ts
import { Job } from '@hschmaiske/jobs'
import type { QueueNames } from '#config/jobs'

export default class SendEmailJob extends Job {
  static queue: QueueNames = 'emails' // ✅ Type-safe queue assignment
}
```

### Direct pg-boss API Access

The package provides zero abstractions over pg-boss. Access the full API directly:

```typescript
import job from '@hschmaiske/jobs/services/main'

// All pg-boss methods are available
await job.send('job-name', data, { priority: 10 })
await job.schedule('recurring-job', '0 0 * * *', data)
await job.publish('user-events', { userId: 123 })

// Monitoring and management
const queueSize = await job.getQueueSize('emails')
const jobDetails = await job.getJobById('uuid')
```

For comprehensive API documentation, refer to the [pg-boss documentation](https://timgit.github.io/pg-boss/).

### Production Deployment

Separate workers by queue for optimal resource allocation:

```bash
#!/bin/bash
# production-workers.sh

# High-priority queues
node ace job:queue emails --concurrency 20 &
node ace job:queue payments --concurrency 5 &

# Background queues
node ace job:queue reports --concurrency 3 &
node ace job:queue maintenance --concurrency 1 &

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
