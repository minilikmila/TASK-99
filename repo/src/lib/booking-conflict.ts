/**
 * Venue booking conflict detection — pure logic.
 * Overlap check: (startAt < existingEndAt) AND (endAt > existingStartAt)
 */

export interface BookingWindow {
  id: string;
  venueId: string;
  startAt: Date;
  endAt: Date;
}

export function hasConflict(
  existing: BookingWindow[],
  venueId: string,
  newStart: Date,
  newEnd: Date,
  excludeId?: string
): boolean {
  return existing.some(
    (b) =>
      b.venueId === venueId &&
      b.id !== excludeId &&
      b.startAt < newEnd &&
      b.endAt > newStart
  );
}
