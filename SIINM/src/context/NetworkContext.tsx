import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { networkWatcher } from '../sync/networkWatcher'
import { syncEngine } from '../sync/syncEngine'
import { syncQueueRepository } from '../db/repositories/syncQueue.repository'

interface NetworkContextType {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  triggerSync: (forcePull?: boolean) => Promise<void>
  refreshPendingCount: () => Promise<void>
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(networkWatcher.isOnline)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const isSyncingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await syncQueueRepository.countPending()
      setPendingCount(count)
    } catch {
      // IndexedDB podría estar inicializándose
    }
  }, [])

  const triggerSync = useCallback(async (forcePull = false) => {
    if (isSyncingRef.current || !networkWatcher.isOnline) return
    isSyncingRef.current = true
    setIsSyncing(true)
    try {
      await syncEngine.syncAll({ forcePull })
      const status = syncEngine.getStatus()
      setLastSyncAt(status.lastSyncAt)
      await refreshPendingCount()
    } finally {
      isSyncingRef.current = false
      setIsSyncing(false)
    }
  }, [refreshPendingCount])

  useEffect(() => {
    // Escuchar cambios de conectividad
    const unsubscribe = networkWatcher.subscribe((online) => {
      setIsOnline(online)
    })

    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 10000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [refreshPendingCount])

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncAt,
        triggerSync,
        refreshPendingCount,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}
