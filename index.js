const { partition, throttle } = require("lodash");

const isPublished = ({ _id }) => {
  if (typeof _id !== "string") {
    throw new Error(
      "documents must contain _id key; please ensure that your GROQ query selects this key"
    );
  }
  return !_id.startsWith("drafts.");
};

const isDraft = (doc) => !isPublished(doc);

const publishedId = (id) => id.replace("drafts.", "");

const prefetchPublished = (client, { params, projection, query }) => {
  return client
    .fetch([query, projection].join("|"), params)
    .then((results) => results.filter(isPublished));
};

const applyRequestDefaults = (request) => {
  if (typeof request.query !== "string") {
    throw new Error("request must contain `query` key");
  }

  return {
    ...request,
    params: request.params || {},
    projection: request.projection || `{ ... }`,
  };
};

// TODO doc comment
const prefetchForDetailPages = (client, request) => {
  request = applyRequestDefaults(request);

  return prefetchPublished(client, request).then((results) =>
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

// TODO doc comment; mention consistent ordering
const prefetchForListPage = (client, request) => {
  request = applyRequestDefaults(request);

  return prefetchPublished(client, request).then((prefetchedResults) => ({
    params: request.params,
    prefetchedResults,
    query: [request.query, request.projection].join("|"),
    sanityConfig: {
      dataset: client.config().dataset,
      projectId: client.config().projectId,
    },
  }));
};

const overlayDrafts = (docs) => {
  const [replacements, results] = partition(
    docs,
    (doc) =>
      isDraft(doc) &&
      docs.find((original) => original._id === publishedId(doc._id))
  ).map((list) => list.map((doc) => ({ ...doc, _id: publishedId(doc._id) })));

  replacements.forEach((doc) => {
    results[results.findIndex((original) => original._id === doc._id)] = doc;
  });

  return results;
};

// TODO doc comment
const startLivePreview = (client, { params, query }, setResults) => {
  const refreshResults = throttle(() => {
    client.fetch(query, params).then((newResults) => {
      setResults(overlayDrafts(newResults));
    });
  }, 2500);

  refreshResults();

  return client
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
  overlayDrafts,
  prefetchForDetailPages,
  prefetchForListPage,
  startLivePreview,
};
