import { useEffect, useState } from 'react'

export type RecordNotes = Record<
  string,
  { saved?: boolean; read?: boolean; folders?: string[]; tags?: string[]; highlight?: string }
>
export function useLocal<T>(key: string, initial: T) {
  const read = () => {
    try {
      return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? initial
    } catch {
      return initial
    }
  }
  const [value, setValue] = useState(read)
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === key) setValue(read())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])
  return [
    value,
    (update: T | ((old: T) => T)) => {
      const next = typeof update === 'function' ? (update as (old: T) => T)(read()) : update
      localStorage.setItem(key, JSON.stringify(next))
      setValue(next)
    },
  ] as const
}
