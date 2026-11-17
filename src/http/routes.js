export const HTTP_ROUTES = [
  { path: "/health", methods: ["GET"] },
  { path: "/configure-telegram-webhook", methods: ["POST"] },
  { path: "/index-sources", methods: ["POST"] },
  { path: "/reprocess-content", methods: ["POST"] },
  { path: "/telegram-webhook-info", methods: ["GET"] },
  { path: "/telegram-webhook", methods: ["POST"] },
  { path: "/test-ai", methods: ["POST"] },
  { path: "/debug-env", methods: ["GET"] },
  { path: "/subscribers", methods: ["GET"] },
  { path: "/run", methods: ["POST"] },
  { path: "/bootstrap", methods: ["POST"] },
  { path: "/send-digest", methods: ["POST"] },
  { path: "/audit", methods: ["GET"] },
];

export function createHttpRouteTable(handlers) {
  return HTTP_ROUTES.map((route) => ({ ...route, handler: handlers[route.path] }));
}
