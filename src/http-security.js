export async function isAdminAuthorized(request, env) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return timingSafeEqual(match?.[1] || "", env.ADMIN_SECRET || "");
}

export async function isTelegramWebhookAuthorized(request, env) {
  const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
  return timingSafeEqual(supplied, env.TELEGRAM_WEBHOOK_SECRET || "");
}

export function methodNotAllowed(methods) {
  return Response.json(
    { ok: false, error: "Method Not Allowed" },
    { status: 405, headers: { Allow: methods.join(", ") } }
  );
}

export function safeErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (/^Missing [A-Z0-9_, -]+$/i.test(message)) return message;
  return "Internal server error";
}

async function timingSafeEqual(left, right) {
  const leftValue = String(left || "");
  const rightValue = String(right || "");

  if (!leftValue || !rightValue) return false;

  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(leftValue)),
    crypto.subtle.digest("SHA-256", encoder.encode(rightValue)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}
