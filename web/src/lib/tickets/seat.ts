// Canonical seat-label parsing. The SeatMap renders labels with a middot
// ("Row 1 · Seat 4") for readability, but the stored/canonical form uses plain
// spaces ("Row 1 Seat 4"). These helpers accept BOTH so the seat round-trips
// cleanly from map → assignment → voucher → verify regardless of separator.

// Separator may be a middot (U+00B7), bullet (U+2022), or plain whitespace.
const SEAT_LABEL_RE = /Row\s+(\d+)\s*[·•]?\s*Seat\s+(\d+)/i;

/** Collapse middot/bullet separators to single spaces so validation/storage is uniform. */
export function normalizeSeatLabel(seat: string): string {
  if (!seat) return "";
  return seat.replace(/\s*[·•]\s*/g, " ").replace(/\s+/g, " ").trim();
}

export function ticketSeatLabel(seat: string): string {
  if (!seat || seat === "Unassigned") return "TBD";
  const m = seat.match(SEAT_LABEL_RE);
  if (m) return `R${m[1]}S${m[2]}`;
  return normalizeSeatLabel(seat).replace("Row ", "R").replace(" Seat ", "S");
}

export function convertToSeatId(seatStr: string, tier: string): string | undefined {
  if (!seatStr || seatStr === "Unassigned" || !tier) return undefined;
  const m = seatStr.match(SEAT_LABEL_RE);
  if (!m) return undefined;
  return `${tier[0]}-${m[1]}-${m[2]}`;
}
