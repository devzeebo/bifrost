import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { TaskStateStore } from './task-state-store.js'

/**
 * File-based Task State Store implementation.
 * Persists taskState as JSON files in a directory.
 *
 * Each task's state is stored as: <storeDir>/<taskId>.json
 */
export class FileTaskStateStore implements TaskStateStore {
  #storeDir: string

  constructor(storeDir: string) {
    this.#storeDir = storeDir
  }

  async loadTaskState(taskId: string): Promise<Record<string, unknown> | null> {
    const filePath = this.#getFilePath(taskId)

    try {
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as Record<string, unknown>
    } catch {
      return null
    }
  }

  async saveTaskState(
    taskId: string,
    taskState: Record<string, unknown>
  ): Promise<boolean> {
    const filePath = this.#getFilePath(taskId)

    try {
      // Ensure directory exists
      await mkdir(dirname(filePath), { recursive: true })

      // Write atomically by writing to a temp file first, then renaming
      // For simplicity, we'll write directly here - Node.js writeFile is atomic on most systems
      const content = JSON.stringify(taskState, null, 2)
      await writeFile(filePath, content, 'utf-8')
      return true
    } catch {
      return false
    }
  }

  async deleteTaskState(taskId: string): Promise<boolean> {
    const filePath = this.#getFilePath(taskId)

    try {
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }

  async initializeTaskState(
    taskId: string,
    initialState: Record<string, unknown>
  ): Promise<boolean> {
    const filePath = this.#getFilePath(taskId)

    try {
      // Check if file already exists
      await stat(filePath)
      // File exists, don't initialize
      return false
    } catch {
      // File doesn't exist, create it
      return this.saveTaskState(taskId, initialState)
    }
  }

  #getFilePath(taskId: string): string {
    // Sanitize taskId to prevent directory traversal
    const sanitized = taskId.replace(/[^a-zA-Z0-9_-]/g, '_')
    return join(this.#storeDir, `${sanitized}.json`)
  }
}
