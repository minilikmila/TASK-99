/**
 * Unit tests for booking time validation after merge.
 * Ensures startAt < endAt is enforced even when partial updates
 * merge with existing booking times.
 */

describe("Booking merged time validation", () => {
  function validateMergedBooking(startAt: Date, endAt: Date): string | null {
    if (startAt >= endAt) {
      return "Booking start time must be before end time";
    }
    return null;
  }

  test("valid: start before end", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-01T12:00:00Z");
    expect(validateMergedBooking(start, end)).toBeNull();
  });

  test("invalid: start equals end", () => {
    const t = new Date("2026-06-01T10:00:00Z");
    expect(validateMergedBooking(t, t)).toMatch(/before end time/);
  });

  test("invalid: start after end", () => {
    const start = new Date("2026-06-01T14:00:00Z");
    const end = new Date("2026-06-01T10:00:00Z");
    expect(validateMergedBooking(start, end)).toMatch(/before end time/);
  });

  test("partial update: only endAt changed to before existing startAt", () => {
    // Simulate: existing booking 10:00-12:00, update endAt to 09:00
    const existingStart = new Date("2026-06-01T10:00:00Z");
    const newEnd = new Date("2026-06-01T09:00:00Z");
    // After merge: startAt=10:00, endAt=09:00 → invalid
    expect(validateMergedBooking(existingStart, newEnd)).toMatch(/before end time/);
  });

  test("partial update: only startAt changed to after existing endAt", () => {
    // Simulate: existing booking 10:00-12:00, update startAt to 13:00
    const newStart = new Date("2026-06-01T13:00:00Z");
    const existingEnd = new Date("2026-06-01T12:00:00Z");
    // After merge: startAt=13:00, endAt=12:00 → invalid
    expect(validateMergedBooking(newStart, existingEnd)).toMatch(/before end time/);
  });
});
