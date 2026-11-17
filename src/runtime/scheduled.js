export function createScheduledHandler({ ensureProfile, run, sendDigest, dailyDigestHour = 6, now = () => new Date() }) {
  return async function handleScheduled() {
    try {
      await ensureProfile();
    } catch (error) {
      console.error("Telegram profile sync failed:", error?.message || error);
    }

    await run();

    if (now().getUTCHours() === dailyDigestHour) {
      await sendDigest();
    }
  };
}
