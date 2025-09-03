import type PgBoss from 'pg-boss'

/**
 * Comprehensive PgBoss mock implementation for testing environments.
 * Implements all PgBoss methods with sensible default return values.
 */
export class PgBossMock {
  // Static properties (accessed as instance properties in mocks)
  readonly states = {
    created: 'created',
    retry: 'retry',
    active: 'active',
    completed: 'completed',
    expired: 'expired',
    cancelled: 'cancelled',
    failed: 'failed',
  } as const

  readonly policies = {
    standard: 'standard',
    short: 'short',
    singleton: 'singleton',
    stately: 'stately',
  } as const

  // Core lifecycle methods
  async start(): Promise<PgBoss> {
    return this as unknown as PgBoss
  }

  async stop(): Promise<void> {}

  // Job sending methods (all overloads)
  async send(): Promise<string> {
    return 'mock-job-id'
  }

  async sendAfter(): Promise<string> {
    return 'mock-job-id'
  }

  async sendThrottled(): Promise<string> {
    return 'mock-job-id'
  }

  async sendDebounced(): Promise<string> {
    return 'mock-job-id'
  }

  // Job management methods
  async insert(): Promise<void> {}

  async fetch(): Promise<unknown[]> {
    return []
  }

  async work(): Promise<string> {
    return 'mock-worker-id'
  }

  async offWork(): Promise<void> {}

  notifyWorker(): void {}

  // Pub/Sub methods
  async subscribe(): Promise<void> {}

  async unsubscribe(): Promise<void> {}

  async publish(): Promise<void> {}

  // Job state management methods (all overloads)
  async cancel(): Promise<void> {}

  async resume(): Promise<void> {}

  async retry(): Promise<void> {}

  async deleteJob(): Promise<void> {}

  async complete(): Promise<void> {}

  async fail(): Promise<void> {}

  // Job retrieval methods
  async getJobById(): Promise<null> {
    return null
  }

  // Queue management methods
  async createQueue(): Promise<void> {}

  async updateQueue(): Promise<void> {}

  async deleteQueue(): Promise<void> {}

  async purgeQueue(): Promise<void> {}

  async getQueues(): Promise<unknown[]> {
    return []
  }

  async getQueue(): Promise<null> {
    return null
  }

  async getQueueSize(): Promise<number> {
    return 0
  }

  // Storage management methods
  async clearStorage(): Promise<void> {}

  async archive(): Promise<void> {}

  async purge(): Promise<void> {}

  async expire(): Promise<void> {}

  async maintain(): Promise<void> {}

  async isInstalled(): Promise<boolean> {
    return true
  }

  async schemaVersion(): Promise<number> {
    return 1
  }

  // Scheduling methods
  async schedule(): Promise<void> {}

  async unschedule(): Promise<void> {}

  async getSchedules(): Promise<unknown[]> {
    return []
  }

  // Event handler methods (all overloads)
  on(): PgBoss {
    return this as unknown as PgBoss
  }

  off(): PgBoss {
    return this as unknown as PgBoss
  }

  // Static methods (as instance methods in mocks)
  getConstructionPlans(): string {
    return 'mock-construction-plans'
  }

  getMigrationPlans(): string {
    return 'mock-migration-plans'
  }

  getRollbackPlans(): string {
    return 'mock-rollback-plans'
  }
}
