import type { JobManager } from '../job_manager.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'hschmaiske/jobs': JobManager
  }
}
