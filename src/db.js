import {openDB} from 'idb'

// Version 2 upgrades the original 'form-fitness-v1' database in place.
// Existing records are NOT deleted during the upgrade.
export const DB_NAME = 'form-fitness-v1'
const database = openDB(DB_NAME, 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', {keyPath: 'id'})
    if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', {keyPath: 'key'})
    if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', {keyPath: 'key'})
    if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', {keyPath: 'id'})
  }
})

export const getAll = async () => (await database).getAll('records')
export const getSetting = async (key) => (await database).get('settings', key).then(x => x?.value)
export const setSetting = async (key, value) => (await database).put('settings', {key, value})
export const getDraft = async (key) => (await database).get('drafts', key).then(x => x?.value)
export const saveDraft = async (key, value) => (await database).put('drafts', {key, value})
export const clearDraft = async (key) => (await database).delete('drafts', key)

export async function put(record) {
  if (!record || typeof record.id !== 'string' || !record.type) throw Error('Invalid record')
  const db = await database
  const tx = db.transaction('records', 'readwrite')
  await tx.store.put(record)
  await tx.done // show success only after IndexedDB commits
}
export async function putMany(records) {
  if (!Array.isArray(records) || records.some(r => !r?.id || !r?.type)) throw Error('Invalid records')
  const db = await database
  const tx = db.transaction('records', 'readwrite')
  for (const record of records) await tx.store.put(record)
  await tx.done
}
export async function remove(id) {
  const db = await database
  const tx = db.transaction('records', 'readwrite')
  await tx.store.delete(id)
  await tx.done
}
// Import merges by id; it never clears a database as a side effect of import.
export async function mergeImport(records) {
  if (!Array.isArray(records) || records.some(r => !r || typeof r.id !== 'string' || typeof r.type !== 'string')) throw Error('Invalid backup records')
  const db = await database
  const tx = db.transaction('records', 'readwrite')
  for (const record of records) await tx.store.put(record)
  await tx.done
}

// Local snapshots help with accidental edits. They live in the same browser storage,
// so JSON exports remain necessary as independent backups.
export async function maybeSnapshot(force = false) {
  const db = await database
  const last = (await db.get('settings', 'last-snapshot'))?.value || 0
  if (!force && Date.now() - last < 24 * 60 * 60 * 1000) return false
  const records = await db.getAll('records')
  if (!records.length) return false
  const snapshot = {id: crypto.randomUUID(), at: new Date().toISOString(), records}
  const tx = db.transaction(['snapshots', 'settings'], 'readwrite')
  await tx.objectStore('snapshots').put(snapshot)
  await tx.objectStore('settings').put({key: 'last-snapshot', value: Date.now()})
  await tx.done
  const backups = await db.getAll('snapshots')
  backups.sort((a, b) => b.at.localeCompare(a.at))
  if (backups.length > 14) {
    const clean = db.transaction('snapshots', 'readwrite')
    for (const backup of backups.slice(14)) await clean.store.delete(backup.id)
    await clean.done
  }
  return true
}
export async function listSnapshots() {
  const backups = await (await database).getAll('snapshots')
  return backups.map(({id, at, records}) => ({id, at, count: records.length})).sort((a, b) => b.at.localeCompare(a.at))
}
export async function readSnapshot(id) { return (await database).get('snapshots', id) }
export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist()
}
