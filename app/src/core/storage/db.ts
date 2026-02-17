import Dexie, { type EntityTable } from 'dexie'
import type { CheckinRecord } from '../models/checkin'
import type { AppEventRecord } from '../models/event'

export const schemaVersion = 1

class GamnoDb extends Dexie {
  checkins!: EntityTable<CheckinRecord, 'id'>
  events!: EntityTable<AppEventRecord, 'id'>

  constructor() {
    super('gamno-db')
    this.version(schemaVersion).stores({
      checkins: '++id,ts',
      events: '++id,ts,type',
    })
  }
}

export const db = new GamnoDb()
