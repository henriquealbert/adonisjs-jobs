/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import { JobManager } from './job_manager.js'

declare module '@adonisjs/core/types' {
  export interface ContainerBindings {
    'hschmaiske/jobs': JobManager
  }
}
