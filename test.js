/* eslint-env jest */

const {
  overlayDrafts,
  prefetchForDetailPages,
  prefetchForListPage,
} = require("./index");

describe("overlayDrafts", () => {
  test("draft replaces document with same ID", () => {
    const results = overlayDrafts([
      { _id: "abc", title: "Original" },
      { _id: "def", title: "Other" },
      { _id: "drafts.abc", title: "Draft" },
    ]);

    expect(results).toEqual([
      { _id: "abc", title: "Draft" },
      { _id: "def", title: "Other" },
    ]);
  });

  test("new draft inserted at the correct position in array", () => {
    const results = overlayDrafts([
      { _id: "abc", title: "existing 1" },
      { _id: "drafts.def", title: "new doc" },
      { _id: "ghi", title: "existing 2" },
    ]);

    expect(results).toEqual([
      { _id: "abc", title: "existing 1" },
      { _id: "def", title: "new doc" },
      { _id: "ghi", title: "existing 2" },
    ]);
  });

  test("throws exception if _id is missing", () => {
    expect(() => {
      overlayDrafts([{}]);
    }).toThrow(
      new Error(
        "documents must contain _id key; please ensure that your GROQ query selects this key"
      )
    );
  });
});

const config = () => ({
  dataset: "myset",
  projectId: "projectx",
});

describe("prefetchForDetailPages", () => {
  test("with projection and params", async () => {
    const client = { config, fetch: jest.fn() };
    client.fetch.mockResolvedValue([{ _id: "abc" }]);

    const result = await prefetchForDetailPages(client, {
      params: { type: "product" },
      projection: `{ _id, title }`,
      query: `*[_type == $type]`,
    });

    expect(client.fetch.mock.calls).toEqual([
      ["*[_type == $type]|{ _id, title }", { type: "product" }],
    ]);

    expect(result).toEqual([
      {
        params: { type: "product", __ids: ["abc", "drafts.abc"] },
        prefetchedResults: [{ _id: "abc" }],
        query: "*[_id in $__ids]|{ _id, title }",
        sanityConfig: {
          dataset: "myset",
          projectId: "projectx",
        },
      },
    ]);
  });

  test("with defaults", async () => {
    const client = { config, fetch: jest.fn() };
    client.fetch.mockResolvedValue([{ _id: "abc" }]);

    const result = await prefetchForDetailPages(client, {
      query: `*[_type == "product"]`,
    });

    expect(client.fetch.mock.calls).toEqual([
      ['*[_type == "product"]|{ ... }', {}],
    ]);

    expect(result).toEqual([
      {
        params: {
          __ids: ["abc", "drafts.abc"],
        },
        prefetchedResults: [{ _id: "abc" }],
        query: "*[_id in $__ids]|{ ... }",
        sanityConfig: {
          dataset: "myset",
          projectId: "projectx",
        },
      },
    ]);
  });

  test("throws exception if query is missing", () => {
    expect(() => {
      prefetchForDetailPages(null, {});
    }).toThrow(new Error("request must contain `query` key"));
  });
});

describe("prefetchForListPage", () => {
  test("throws exception if query is missing", () => {
    expect(() => {
      prefetchForListPage(null, {});
    }).toThrow(new Error("request must contain `query` key"));
  });
});
