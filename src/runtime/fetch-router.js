export function createFetchRouter({ routes, fallback, methodNotAllowed }) {
  const routeMap = new Map(routes.map((route) => [route.path, route]));

  return function handleFetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = routeMap.get(url.pathname);

    if (!route) return fallback(request, env, ctx, url);
    if (!route.methods.includes(request.method)) {
      return methodNotAllowed(route.methods);
    }

    return route.handler(request, env, ctx, url);
  };
}
