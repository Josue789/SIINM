export type SyncAction = 'insert' | 'update' | 'delete'

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface SyncQueueItem<T = Record<string, unknown>> {
  id: string
  tableName: string
  action: SyncAction
  recordId: string
  payload: T
  createdAt: string
  status: SyncStatus
  attempts: number
  lastError?: string
}

export interface SyncSummary {
  pendingCount: number
  failedCount: number
  lastSyncAt: string | null
  isSyncing: boolean
}
