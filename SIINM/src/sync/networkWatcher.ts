type Listener = (isOnline: boolean) => void

class NetworkWatcher {
  private listeners: Set<Listener> = new Set()
  private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleStatusChange(true))
      window.addEventListener('offline', () => this.handleStatusChange(false))
    }
  }

  get isOnline(): boolean {
    return this._isOnline
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this._isOnline)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private handleStatusChange(status: boolean) {
    this._isOnline = status
    this.listeners.forEach((listener) => listener(status))
  }
}

export const networkWatcher = new NetworkWatcher()
