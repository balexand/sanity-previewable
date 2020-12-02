const { partition, throttle } = require("lodash");

const isPublished = ({ _id: _id }) => !_id.startsWith("drafts.");

const sanityFetch = (client, { params, projection, query }) => {
  return client
    .fetch([query, projection].join("|"), params)
    .then((results) => results.filter(isPublished));
};

const applyRequestDefaults = (request) => {
  return {
    ...request,
    params: request.params || {},
    projection: request.projection || `{ ... }`,
  };
};

const prefetchForDetailPages = (client, request) => {
  request = applyRequestDefaults(request);

  return sanityFetch(client, request).then((results) =>
    results.map((doc) => ({
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
    }))
  );
};

const prefetchForListPage = (client, request) => {
  request = applyRequestDefaults(request);

  return sanityFetch(client, request).then((prefetchedResults) => ({
    params: request.params,
    prefetchedResults,
    query: [request.query, request.projection].join("|"),
    sanityConfig: {
      dataset: client.config().dataset,
      projectId: client.config().projectId,
    },
  }));
};

// TODO test coverage
const overlayDrafts = (docs) => {
  const [drafts, originals] = partition(docs, (doc) =>
    doc._id.startsWith("drafts.")
  );

  return drafts.reduce((originals, draft) => {
    draft = { ...draft, _id: draft._id.replace("drafts.", "") };

    if (originals.some((original) => original._id === draft._id)) {
      return originals.map((original) =>
        original._id === draft._id ? draft : original
      );
    } else {
      // TODO this will mess up the sort order of drafts
      return originals.concat([draft]);
    }
  }, originals);
};

const startLivePreview = (previewClient, { params, query }, setResults) => {
  const refreshResults = throttle(() => {
    previewClient.fetch(query, params).then((newResults) => {
      setResults(overlayDrafts(newResults));
    });
  }, 2500);

  refreshResults();

  return previewClient
    .listen(query, params, {
      includePreviousRevision: false,
      includeResult: false,
      visibility: "query",
    })
    .subscribe(() => {
      refreshResults();
      // https://www.sanity.io/docs/listening documents that even with visibility: 'query', the
      // listener may be notified before new results are availabe to a query. Add a second refresh
      // that will catch any delayed results.
      setTimeout(refreshResults, 4000);
    });
};

module.exports = {
  prefetchForDetailPages,
  prefetchForListPage,
  startLivePreview,
};
