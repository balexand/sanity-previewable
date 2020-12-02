const isPublished = ({ _id: _id }) => !_id.startsWith("drafts.");

const sanityFetch = async (client, { params, projection, query }) => {
  return (await client.fetch([query, projection].join("|"), params)).filter(
    isPublished
  );
};

const applyRequestDefaults = (request) => {
  return {
    ...request,
    params: request.params || {},
    projection: request.projection || `{ ... }`,
  };
};

const prefetchForDetailPages = async (client, request) => {
  request = applyRequestDefaults(request);

  return (await sanityFetch(client, request)).map((doc) => {
    return {
      params: {
        ...request.params,
        __ids: [doc._id, `drafts.${doc._id}`],
      },
      prefetchedResults: [doc],
      query: [`*[_id in $__ids]`, request.projection].join("|"),
      sanityConfig: {
        dataset: client.config().dataset,
        projectId: client.config().projectId,
      },
    };
  });
};

const prefetchForListPage = async (client, request) => {
  request = applyRequestDefaults(request);

  return {
    params: request.params,
    prefetchedResults: await sanityFetch(client, request),
    query: [request.query, request.projection].join("|"),
    sanityConfig: {
      dataset: client.config().dataset,
      projectId: client.config().projectId,
    },
  };
};

module.exports = { prefetchForDetailPages, prefetchForListPage };
