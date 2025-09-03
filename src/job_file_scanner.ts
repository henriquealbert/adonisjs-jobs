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
      return this.handleScanError(dir, error)
    }
  }

  private handleScanError(dir: string, error: unknown): string[] {
    const nodeError = error as NodeJS.ErrnoException

    // Handle expected filesystem errors gracefully
    switch (nodeError.code) {
      case 'ENOENT':
        // Directory doesn't exist - this is expected and not an error
        return []

      case 'EACCES':
        console.warn(`JobFileScanner: Permission denied accessing directory ${dir}`)
        return []

      case 'ENOTDIR':
        console.warn(`JobFileScanner: Path is not a directory ${dir}`)
        return []

      default:
        // Log unexpected filesystem errors with more context
        console.warn(`JobFileScanner: Unexpected error scanning directory ${dir}:`, {
          code: nodeError.code,
          message: nodeError.message,
          path: nodeError.path,
        })
        return []
    }
  }

  private isJobFile(filename: string): boolean {
    return filename.endsWith('_job.ts') || filename.endsWith('_job.js')
  }
}
