/**
 * A monotonic server-side cursor. In this scaffold it is the server timestamp
 * watermark of the last successfully applied Pull response.
 */
export type SyncCursor = string;

export function advanceCursor(current: SyncCursor | null, serverTimestamp: string): SyncCursor {
  if (current === null) {
    return serverTimestamp;
  }
  return serverTimestamp > current ? serverTimestamp : current;
}

const KEYSET_SEPARATOR = '|';
const MIN_KEY = '00000000-0000-0000-0000-000000000000';

export interface KeysetPosition {
  /** Server timestamp watermark of the last applied row. */
  timestamp: string;
  /** Id of the last applied row; breaks ties between rows that share a timestamp. */
  id: string;
}

/**
 * Keyset cursor: `<timestamp>|<id>`. Paging by timestamp alone skips rows that share a
 * timestamp across a page boundary. A legacy cursor without an id resumes from the lowest id.
 */
export function encodeKeysetCursor(position: KeysetPosition): SyncCursor {
  return `${position.timestamp}${KEYSET_SEPARATOR}${position.id}`;
}

export function decodeKeysetCursor(cursor: SyncCursor | null, epoch: string): KeysetPosition {
  if (cursor === null) {
    return { timestamp: epoch, id: MIN_KEY };
  }
  const index = cursor.lastIndexOf(KEYSET_SEPARATOR);
  if (index === -1) {
    return { timestamp: cursor, id: MIN_KEY };
  }
  return { timestamp: cursor.slice(0, index), id: cursor.slice(index + 1) };
}
