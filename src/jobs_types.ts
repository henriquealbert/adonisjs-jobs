/**
 * JobQueues interface for module augmentation
 * Two approaches for better type safety:
 *
 * @example
 * ```typescript
 * // Approach 1: Manual type definition (recommended for reliability)
 * // In your config/jobs.ts file
 * const jobsConfig = defineConfig({
 *   queues: ['default', 'emails', 'reports'] as const,
 * })
 * export type QueueNames = NonNullable<typeof jobsConfig.queues>[number]
 *
 * // In your job classes
 * import type { QueueNames } from '#config/jobs'
 * export default class SendEmailJob extends Job {
 *   static queue: QueueNames = 'emails' // ← Type-safe!
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Approach 2: Module augmentation (automatic inference)
 * // In your config/jobs.ts file
 * import type { InferQueues } from '@hschmaiske/jobs'
 *
 * const jobsConfig = defineConfig({
 *   queues: ['default', 'emails', 'reports'] as const,
 * })
 *
 * declare module '@hschmaiske/jobs' {
 *   interface JobQueues {
 *     queues: InferQueues<typeof jobsConfig>
 *   }
 * }
 *
 * // In your job classes - queue will be auto-inferred!
 * export default class SendEmailJob extends Job {
 *   static queue = 'emails' // ← Auto-complete and type-safe!
 * }
 * ```
 */
export interface JobQueues {
  queues: any // This allows module augmentation to override the type
}

// Default fallback for when no augmentation is provided
export interface DefaultJobQueues {
  queues: string
}
