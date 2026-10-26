export function csvEscape(value: string | number | boolean | null | undefined) {
  if (value == null) {
    return "";
  }

  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
) {
  const lines = [headers.map((header) => csvEscape(header)).join(",")];

  for (const row of rows) {
    lines.push(row.map((cell) => csvEscape(cell)).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}`;
}
