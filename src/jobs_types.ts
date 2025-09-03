/**
 * Infer queue types from job configuration
 */
export type InferJobQueues<T extends { queues?: readonly string[] }> =
  T['queues'] extends readonly string[] ? T['queues'][number] : string

/**
 * JobQueues interface for module augmentation
 * Users should augment this interface to get type-safe queue names
 *
 * @example
 * ```typescript
 * declare module '@hschmaiske/jobs/types' {
 *   export interface JobQueues {
 *     queues: InferJobQueues<typeof jobsConfig>
 *   }
 * }
 * ```
 */
export interface JobQueues {
  queues: string
}
