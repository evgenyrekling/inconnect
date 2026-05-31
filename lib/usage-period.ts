export function getCurrentWeeklyUsagePeriod(now = new Date()) {
  const utcDay = now.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  periodStart.setUTCDate(periodStart.getUTCDate() - daysSinceMonday);

  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);

  return {
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
  };
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
