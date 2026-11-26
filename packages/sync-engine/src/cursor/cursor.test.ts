import { describe, expect, it } from 'vitest';
import { decodeKeysetCursor, encodeKeysetCursor } from './cursor';

const EPOCH = '1970-01-01T00:00:00.000Z';

describe('keyset cursor', () => {
  it('round-trips timestamp and id', () => {
    const cursor = encodeKeysetCursor({ timestamp: '2026-11-25T05:31:26.591+00:00', id: 'abc' });
    expect(decodeKeysetCursor(cursor, EPOCH)).toEqual({ timestamp: '2026-11-25T05:31:26.591+00:00', id: 'abc' });
  });

  it('starts from the epoch with the lowest id when there is no cursor', () => {
    expect(decodeKeysetCursor(null, EPOCH)).toEqual({
      timestamp: EPOCH,
      id: '00000000-0000-0000-0000-000000000000',
    });
  });

  it('accepts a legacy timestamp-only cursor', () => {
    expect(decodeKeysetCursor('2026-01-01T00:00:00.000Z', EPOCH)).toEqual({
      timestamp: '2026-01-01T00:00:00.000Z',
      id: '00000000-0000-0000-0000-000000000000',
    });
  });

  it('orders by id when timestamps are equal', () => {
    const a = encodeKeysetCursor({ timestamp: '2026-01-01T00:00:00+00:00', id: '1111' });
    const b = encodeKeysetCursor({ timestamp: '2026-01-01T00:00:00+00:00', id: '2222' });
    expect(b > a).toBe(true);
  });
});
