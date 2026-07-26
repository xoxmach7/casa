import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// @testing-library/react's auto-cleanup only registers when a global
// `afterEach` exists (see its dist/index.js). This project doesn't enable
// vitest's `test.globals`, so `afterEach` is never a global and DOM trees
// from earlier tests were leaking into later ones within the same file,
// causing "multiple elements found" failures whenever a test file has more
// than one test that queries the same label/role. Registering cleanup
// explicitly restores per-test isolation.
afterEach(() => {
  cleanup();
});
