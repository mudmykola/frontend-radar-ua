const workerUrl = (process.env.WORKER_URL || "https://shopify-radar-ua.tovarinfobud.workers.dev").replace(/\/$/, "");
const strict = process.argv.includes("--strict");
const attempts = Number(process.env.HEALTH_ATTEMPTS || 5);
const retryDelayMs = Number(process.env.HEALTH_RETRY_DELAY_MS || 3000);

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(`${workerUrl}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => null);

    if (response.ok && body?.ok === true) {
      console.log(`✅ Production health OK (${workerUrl}/health)`);
      console.log(JSON.stringify(body));
      process.exit(0);
    }

    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    const message = String(error?.cause?.code || error?.message || error);
    console.warn(`⚠️ Health attempt ${attempt}/${attempts} failed: ${message}`);
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

if (strict) {
  console.error("❌ Production health could not be verified.");
  process.exit(1);
}

console.warn("⚠️ Deployment completed, but production health could not be verified from this network.");
console.warn(`   Verify manually: ${workerUrl}/health`);
