/**
 * JobQueues interface for module augmentation
 * Users should manually define their queue types for better type safety
 *
 * @example
 * ```typescript
 * // In your config/jobs.ts file
 * export type QueueNames = 'default' | 'emails' | 'reports'
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
