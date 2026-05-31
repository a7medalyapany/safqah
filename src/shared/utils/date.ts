export function normalizeDateInput(value: string) {
  return value.includes("T") ? value : value.replace(" ", "T");
}

export function formatDate(value: string) {
  const date = new Date(normalizeDateInput(value));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateOnly(value: string) {
  const date = new Date(normalizeDateInput(value));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
  }).format(date);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function monthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}
