/**
 * Unit tests for venue booking conflict detection.
 * Validates the overlap check: (startAt < existingEndAt) AND (endAt > existingStartAt)
 */

interface Booking {
  id: string;
  venueId: string;
  startAt: Date;
  endAt: Date;
}

function hasConflict(
  existing: Booking[],
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

const d = (h: number, m = 0): Date =>
  new Date(2026, 3, 1, h, m, 0, 0); // April 1, 2026

const existing: Booking[] = [
  { id: "b1", venueId: "v1", startAt: d(10), endAt: d(12) }, // 10:00–12:00
];

describe("Venue booking conflict detection", () => {
  test("no conflict when booking is entirely before existing", () => {
    expect(hasConflict(existing, "v1", d(8), d(10))).toBe(false);
  });

  test("no conflict when booking is entirely after existing", () => {
    expect(hasConflict(existing, "v1", d(12), d(14))).toBe(false);
  });

  test("conflict when booking overlaps start of existing", () => {
    expect(hasConflict(existing, "v1", d(9), d(11))).toBe(true);
  });

  test("conflict when booking overlaps end of existing", () => {
    expect(hasConflict(existing, "v1", d(11), d(13))).toBe(true);
  });

  test("conflict when booking is completely inside existing", () => {
    expect(hasConflict(existing, "v1", d(10, 30), d(11, 30))).toBe(true);
  });

  test("conflict when booking completely wraps existing", () => {
    expect(hasConflict(existing, "v1", d(9), d(13))).toBe(true);
  });

  test("conflict when booking exactly matches existing", () => {
    expect(hasConflict(existing, "v1", d(10), d(12))).toBe(true);
  });

  test("no conflict in different venue even with same time", () => {
    expect(hasConflict(existing, "v2", d(10), d(12))).toBe(false);
  });

  test("no conflict when updating own booking (excludeId)", () => {
    expect(hasConflict(existing, "v1", d(10), d(12), "b1")).toBe(false);
  });
});
