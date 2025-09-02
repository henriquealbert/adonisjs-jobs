import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export class JobFileScanner {
  async scanJobFiles(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          await this.scanJobFiles(fullPath, files)
          continue
        }

        if (this.isJobFile(entry.name)) {
          files.push(fullPath)
        }
      }

      return files
    } catch (error) {
      return []
    }
  }

  private isJobFile(filename: string): boolean {
    return filename.endsWith('_job.ts') || filename.endsWith('_job.js')
  }
}
