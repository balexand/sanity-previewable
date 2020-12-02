/* eslint-env jest */

const { overlayDrafts } = require("./index");

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
