/* SIDEQUEST / POCKET ARCADE — content contract tests for the public experience. */
import { describe, expect, it } from "vitest";
import { prompts, routeData } from "./sidequest";

describe("SIDEQUEST content model", () => {
  it("exposes three distinct routes with complete visitor actions", () => {
    const routes = Object.values(routeData);

    expect(routes).toHaveLength(3);
    expect(routes.map((route) => route.label)).toEqual(["MAKE", "WANDER", "PLAY"]);
    expect(routes.every((route) => route.title && route.description && route.result)).toBe(true);
  });

  it("keeps the prompt machine stocked with five unique prompts", () => {
    expect(prompts).toHaveLength(5);
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(prompts.every((prompt) => prompt.endsWith(".") && prompt.length > 20)).toBe(true);
  });
});
