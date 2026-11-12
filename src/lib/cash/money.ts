export function moneyToCents(value: string) {
  const normalized = value.trim();
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("Escribe un importe válido con máximo dos decimales.");
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(cents / 100);
}
