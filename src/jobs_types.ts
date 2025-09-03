/**
 * JobQueues interface for module augmentation
 * Users should manually define their queue types for better type safety
 *
 * @example
 * ```typescript
 * // In your config/jobs.ts file
 * const jobsConfig = defineConfig({
 *   queues: ['default', 'emails', 'reports'] as const,
 * })
 * export type QueueNames = NonNullable<typeof jobsConfig.queues>[number]
 *
 * // In your job classes
 * import type { QueueNames } from '#config/jobs'
 *
 * export default class SendEmailJob extends Job {
 *   static queue: QueueNames = 'emails' // ← Type-safe!
 * }
 * ```
 */
export interface JobQueues {
  queues: string
}
