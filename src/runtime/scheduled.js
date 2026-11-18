export function createScheduledHandler({ ensureProfile, run, sendDigest, dailyDigestHour = 6, getDigestPeriod, now = () => new Date() }) {
  return async function handleScheduled() {
    try {
      await ensureProfile();
    } catch (error) {
      console.error("Telegram profile sync failed:", error?.message || error);
    }

    await run();

    const current = now();
    const period = getDigestPeriod
      ? getDigestPeriod(current)
      : current.getUTCHours() === dailyDigestHour ? "morning" : "";
    if (period) {
      await sendDigest(period);
    }
  };
}
