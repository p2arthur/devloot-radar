export const number = (value: number) => value.toLocaleString();
export const signed = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${number(value)}`;
export const dateTime = (value: number | string) =>
  value === 0
    ? "Not yet recorded"
    : new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
export const relative = (value: number, now = Date.now()) =>
  value === 0
    ? "Not yet recorded"
    : now - value < 60_000
      ? "less than a minute ago"
      : now - value < 3_600_000
        ? `${Math.floor((now - value) / 60_000)} minutes ago`
        : `${Math.floor((now - value) / 3_600_000)} hours ago`;
