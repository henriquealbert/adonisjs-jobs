/**
 * @hschmaiske/jobs
 *
 * @license MIT
 */

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { glob } from 'node:fs/promises'
import type { ApplicationService } from '@adonisjs/core/types'
import type { PgBossConfig } from './types.js'
import type { JobManager } from './job_manager.js'
import { Dispatchable } from './dispatchable.js'
import { Schedulable } from './schedulable.js'

export class JobDiscovery {
  constructor(private app: ApplicationService) {}

  private get logger() {
    return console
  }

  async discoverAll(jobManager: JobManager) {
    await this.discoverDispatchableJobs(jobManager)
    await this.discoverSchedulableJobs(jobManager)
  }

  private async discoverDispatchableJobs(jobManager: JobManager) {
    const config = this.app.config.get<PgBossConfig>('jobs') || {}
    const jobsPath = this.app.makePath(config.paths?.jobs || 'app/jobs')

    // Use Node.js native glob to find all JS/TS files
    const pattern = resolve(jobsPath, '**/*.{js,ts}')

    try {
      for await (const filePath of glob(pattern)) {
        try {
          // Dynamic import the job file
          const module = await import(filePath)
          const JobClass = module.default

          // Check if it extends Dispatchable
          if (JobClass?.prototype instanceof Dispatchable) {
            // Construct importable path from discovered file (no $$filepath needed!)
            const jobPath = pathToFileURL(filePath).href

            // Pre-register worker for this specific job path
            await jobManager.registerJob(jobPath, JobClass, {
              teamSize: JobClass.workOptions?.teamSize,
              batchSize: JobClass.workOptions?.batchSize,
              ...JobClass.workOptions,
            })
          }
        } catch (error) {
          // Skip files that can't be imported (not valid JS/TS modules)
        }
      }
    } catch (globError) {
      // Directory doesn't exist or other glob error - skip silently
    }
  }

  private async discoverSchedulableJobs(jobManager: JobManager) {
    const config = this.app.config.get<PgBossConfig>('jobs') || {}
    const cronPath = this.app.makePath(config.paths?.cron || 'app/cron')

    this.logger.log(`🔍 Scanning for cron jobs in: ${cronPath}`)

    // Use Node.js native glob to find all JS/TS files
    const pattern = resolve(cronPath, '**/*.{js,ts}')

    try {
      for await (const filePath of glob(pattern)) {
        try {
          this.logger.log(`📁 Found file: ${filePath}`)

          // Dynamic import the job file
          const module = await import(filePath)
          const CronClass = module.default

          // Check if it extends Schedulable and has schedule property
          if (CronClass?.prototype instanceof Schedulable && CronClass.schedule) {
            // Construct importable path from discovered file (no $$filepath needed!)
            const jobPath = pathToFileURL(filePath).href

            this.logger.log(`⏰ Discovered cron job: ${CronClass.name}`)
            this.logger.log(`   Schedule: ${CronClass.schedule}`)
            this.logger.log(`   Queue: ${CronClass.queue || 'default'}`)
            this.logger.log(`   Job Path: ${jobPath}`)

            // Build schedule options including queue from static properties
            const scheduleOptions = {
              ...CronClass.scheduleOptions,
              ...(CronClass.queue && { queue: CronClass.queue }),
            }

            // Auto-register with PgBoss
            await jobManager.schedule(CronClass, CronClass.schedule, {}, scheduleOptions)

            // Also register worker for this cron job
            await jobManager.registerJob(jobPath, CronClass, {
              teamSize: CronClass.workOptions?.teamSize,
              batchSize: CronClass.workOptions?.batchSize,
              ...CronClass.workOptions,
            })

            this.logger.log(`✅ Registered cron job: ${CronClass.name}`)
          } else {
            this.logger.log(`❌ Skipping ${filePath}: Not a valid Schedulable class`)
          }
        } catch (error) {
          this.logger.log(`❌ Error importing ${filePath}:`, error.message)
          // Skip files that can't be imported (not valid JS/TS modules)
        }
      }
    } catch (globError) {
      this.logger.log(`❌ Error scanning directory ${cronPath}:`, globError.message)
      // Directory doesn't exist or other glob error - skip silently
    }
  }
}
