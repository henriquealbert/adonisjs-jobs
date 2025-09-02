import { test } from '@japa/runner'
import { JobFileScanner } from '../src/job_file_scanner.js'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

test.group('JobFileScanner', () => {
  test('scans job files recursively', async ({ assert }) => {
    const scanner = new JobFileScanner()
    const testDir = './tmp_test_jobs_1'

    try {
      await mkdir(testDir, { recursive: true })
      await mkdir(join(testDir, 'nested'), { recursive: true })
      await writeFile(join(testDir, 'send_email_job.ts'), 'export default class SendEmailJob {}')
      await writeFile(join(testDir, 'process_job.js'), 'module.exports = class ProcessJob {}')
      await writeFile(
        join(testDir, 'nested', 'cleanup_job.ts'),
        'export default class CleanupJob {}'
      )
      await writeFile(join(testDir, 'regular_class.ts'), 'export default class RegularClass {}')

      const files = await scanner.scanJobFiles(testDir)

      assert.lengthOf(files, 3)
      assert.includeMembers(files, [
        join(testDir, 'send_email_job.ts'),
        join(testDir, 'process_job.js'),
        join(testDir, 'nested', 'cleanup_job.ts'),
      ])
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test('returns empty array for non-existent directory', async ({ assert }) => {
    const scanner = new JobFileScanner()
    const files = await scanner.scanJobFiles('./non-existent-dir')
    assert.lengthOf(files, 0)
  })

  test('identifies job files correctly', async ({ assert }) => {
    const scanner = new JobFileScanner()
    const testDir = './tmp_test_jobs_2'

    try {
      await mkdir(testDir, { recursive: true })
      await writeFile(join(testDir, 'send_email_job.ts'), '')
      await writeFile(join(testDir, 'process_job.js'), '')
      await writeFile(join(testDir, 'regular_class.ts'), '')
      await writeFile(join(testDir, 'another_class.js'), '')

      const files = await scanner.scanJobFiles(testDir)

      assert.lengthOf(files, 2)
      assert.includeMembers(files, [
        join(testDir, 'send_email_job.ts'),
        join(testDir, 'process_job.js'),
      ])
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})
