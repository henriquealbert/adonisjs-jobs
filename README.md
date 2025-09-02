# @hschmaiske/jobs

PostgreSQL-based job queue and scheduler integration for AdonisJS applications using [pg-boss](https://github.com/timgit/pg-boss).

**Zero abstractions** - just pure pg-boss API with clean AdonisJS integration, similar to how `@rlanz/bull-queue` integrates BullMQ.

## Features

- 🚀 **Zero Learning Curve**: Pure pg-boss API, no new concepts
- 🐘 **PostgreSQL Native**: Uses your existing PostgreSQL database
- ⚡ **High Performance**: Built on PostgreSQL's SKIP LOCKED for efficiency
- 🔄 **Both Queue + Cron**: Handle background jobs and scheduled tasks
- 📦 **Minimal Package**: Just glue code between pg-boss and AdonisJS
- 🛡️ **Type Safe**: Full TypeScript support with pg-boss types
- 🔧 **Configurable**: Advanced pg-boss configuration options

## Installation

```bash
node ace add @hschmaiske/jobs
```

This will:

- Install the package automatically
- Add the provider to your `adonisrc.ts`
- Create a `config/pgboss.ts` configuration file
- Register CLI commands

## Configuration

The generated `config/jobs.ts` uses your existing database connection:

```typescript
import { defineConfig } from '@hschmaiske/jobs'
import env from '#start/env'

export default defineConfig({
  // Reuse same DB connection as Lucid
  host: env.get('DB_HOST'),
  port: env.get('DB_PORT'),
  user: env.get('DB_USER'),
  password: env.get('DB_PASSWORD'),
  database: env.get('DB_DATABASE'),

  // pg-boss schema (separate from your app tables)
  schema: 'pgboss',

  // Job Lifecycle Management
  retentionDays: 7,
  archiveCompletedAfterSeconds: 43200,
  deleteAfterDays: 7,

  // Performance Tuning
  pollingIntervalSeconds: 2,
  maintenanceIntervalSeconds: 120,

  // Default Job Settings
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInHours: 24,
})
```

## Usage

### Basic Job Dispatching

```typescript
// In any service - direct pg-boss API access
import job from '@hschmaiske/jobs/services/main'

export default class EmailService {
  async sendWelcomeEmail(userId: string) {
    // Queue a job (raw pg-boss API)
    await job.send(
      'send-email',
      {
        userId,
        template: 'welcome',
        priority: 5,
      },
      {
        retryLimit: 3,
        retryDelay: 5000,
      }
    )
  }

  async scheduleDaily() {
    // Schedule a cron job
    await job.schedule('daily-report', '0 9 * * *', {
      type: 'daily',
    })
  }
}
```

### Creating Jobs

Generate job handlers:

```bash
# Create a queue job
node ace make:job SendEmail

# Create a cron job
node ace make:cron DailyCleanup
```

**Queue Job Example** (`app/jobs/send_email.ts`):

```typescript
import type { JobWithMetadata } from '@hschmaiske/jobs'

export interface SendEmailPayload {
  userId: string
  template: string
}

export default async function sendEmailHandler(
  payload: SendEmailPayload,
  job: JobWithMetadata<SendEmailPayload>
) {
  // Your job logic here

  // Your job logic here
  // await emailService.send(payload.userId, payload.template)

  // Job is automatically marked complete on success
  // Throw error to mark failed and trigger retry
}
```

**Cron Job Example** (`app/jobs/daily_cleanup.ts`):

```typescript
import type { JobWithMetadata } from '@hschmaiske/jobs'

export default async function dailyCleanupHandler(payload: any, job: JobWithMetadata<any>) {
  // Your scheduled job logic here

  // Perform scheduled maintenance
  // await cleanupOldFiles()
  // await generateReports()
}

// Schedule this in your app startup:
// await job.schedule('dailyCleanup', '0 2 * * *', {})
```

## Running Workers

### Process All Jobs (Recommended for Development)

```bash
node ace job:listen
```

Processes all queues and scheduled jobs in one worker.

### Process Specific Queues (Recommended for Production)

```bash
# Different terminals for different queues
node ace job:queue emails --concurrency 10
node ace job:queue files --concurrency 2
node ace job:queue notifications --concurrency 5

# Scheduled jobs only
node ace job:cron
```

### Production Setup

```bash
# High-priority emails
node ace job:queue emails --concurrency 10 &

# File processing
node ace job:queue files --concurrency 2 &

# Notifications
node ace job:queue notifications --concurrency 5 &

# Cron jobs
node ace job:cron --verbose &
```

## Advanced Features

### Rate Limiting

```typescript
// Built-in rate limiting via singletonKey
await job.send('api-call', data, {
  singletonKey: 'api-rate-limit',
  singletonSeconds: 60, // Only allow one job per minute
})
```

### Job Progress & Monitoring

```typescript
// Monitor queue sizes
const queueSize = await job.getQueueSize('emails')
console.log(`Emails in queue: ${queueSize}`)

// Get job by ID
const jobDetails = await job.getJobById('job-uuid')
```

### Transactional Jobs

```typescript
// Jobs created within database transactions
await db.transaction(async (trx) => {
  await trx.table('users').insert(userData)

  // Job will only be queued if transaction succeeds
  await job.send('welcome-email', { userId: user.id })
})
```

### Pub/Sub Messaging

```typescript
// Publisher
await job.publish('user-updates', { userId: 123, action: 'login' })

// Subscriber
await job.subscribe('user-updates', async (data) => {
  console.log('User update:', data)
})
```

## CLI Commands

| Command                     | Description                           |
| --------------------------- | ------------------------------------- |
| `node ace make:job <name>`  | Create a queue job handler            |
| `node ace make:cron <name>` | Create a cron job handler             |
| `node ace job:listen`       | Process ALL queues and scheduled jobs |
| `node ace job:queue <name>` | Process a specific queue only         |
| `node ace job:cron`         | Process scheduled/cron jobs only      |

## Migration from Other Packages

### From @rlanz/bull-queue

```typescript
// Before (BullMQ)
import queue from '@rlanz/bull-queue/services/main'
await queue.dispatch(JobClass, payload)

// After (pg-boss)
import job from '@hschmaiske/jobs/services/main'
await job.send('job-name', payload)
```

### From adonisjs-scheduler

```typescript
// Before
scheduler.command('inspire').everyFiveSeconds()

// After
await job.schedule('inspire', '*/5 * * * * *')
```

## Why pg-boss?

- **PostgreSQL Native**: No Redis dependency, uses your existing database
- **ACID Compliance**: Jobs are stored in PostgreSQL with full ACID guarantees
- **Built-in Features**: Rate limiting, retries, scheduling, pub/sub all included
- **Transactional**: Jobs can be created within database transactions
- **Mature**: Battle-tested library with excellent performance

## Raw pg-boss API

This package provides zero abstractions over the raw pg-boss API. Check the **[pg-boss documentation](https://timgit.github.io/pg-boss/)** for the complete API reference including:

- [Job Creation](https://timgit.github.io/pg-boss/#job-creation)
- [Queue Processing](https://timgit.github.io/pg-boss/#queue-processing)  
- [Scheduling & Cron](https://timgit.github.io/pg-boss/#scheduling)
- [Pub/Sub Messaging](https://timgit.github.io/pg-boss/#pub-sub)
- [Configuration Options](https://timgit.github.io/pg-boss/#configuration)
- [Monitoring & Observability](https://timgit.github.io/pg-boss/#monitoring)

## License

MIT License

## Contributing

This is a personal package, but PRs are welcome for bug fixes and improvements.
