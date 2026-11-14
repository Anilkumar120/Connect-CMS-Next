const adminDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: Date | string) {
  return adminDateFormatter.format(
    value instanceof Date ? value : new Date(value)
  );
}
