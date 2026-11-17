export function createNewsRepository(env, options) {
  const {
    latestPrefix,
    digestPrefix,
    latestLimit,
    digestLimit,
    serialize,
    filterFresh,
    filterWithinHours,
    isPublishable,
    sortByDate,
  } = options;

  return {
    saveLatestItem(item) {
      return putSerialized(latestPrefix, item);
    },

    saveDigestItem(item) {
      return putSerialized(digestPrefix, item);
    },

    async getLatestItems(windowHours) {
      const items = filterFresh(
        await readStoredItems(latestPrefix, latestLimit),
      ).filter(isPublishable);
      return windowHours ? filterWithinHours(items, windowHours) : items;
    },

    async getDigestItems() {
      return filterFresh(
        await readStoredItems(digestPrefix, digestLimit),
      ).filter(isPublishable);
    },
  };

  async function putSerialized(prefix, item) {
    const id = await options.createItemId(item);
    await env.SHOPIFY_RADAR_KV.put(
      prefix + id,
      JSON.stringify(serialize(item)),
      { expirationTtl: options.ttlSeconds },
    );
  }

  async function readStoredItems(prefix, limit) {
    const individualItems = await readJsonObjectsByPrefix(prefix, limit * 2);
    const itemsByUrl = new Map();

    for (const item of individualItems) {
      if (item?.url) itemsByUrl.set(item.url, item);
    }

    return sortBy([...itemsByUrl.values()]).slice(0, limit);
  }

  async function readJsonObjectsByPrefix(prefix, limit) {
    const items = [];
    let cursor;

    do {
      const page = await env.SHOPIFY_RADAR_KV.list({ prefix, cursor, limit: 1000 });
      const values = await Promise.all(
        page.keys
          .slice(0, Math.max(0, limit - items.length))
          .map(async ({ name }) => {
            try {
              const raw = await env.SHOPIFY_RADAR_KV.get(name);
              return raw ? JSON.parse(raw) : null;
            } catch {
              return null;
            }
          }),
      );

      items.push(...values.filter(Boolean));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && items.length < limit);

    return items.slice(0, limit);
  }
}
