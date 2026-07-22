import test from "node:test";
import assert from "node:assert/strict";

import {
  contrastRatio,
  createAdaptivePalette,
  parseCssColor,
  parseHex,
} from "../src/adaptive-palette.js";
import { adaptSvgPaint } from "../src/svg-paint-adapter.js";

class FakeStyle {
  #values = new Map();
  #priorities = new Map();

  get length() {
    return this.#values.size;
  }

  item(index) {
    return [...this.#values.keys()][index] ?? "";
  }

  has(name) {
    return this.#values.has(name);
  }

  getPropertyValue(name) {
    return this.#values.get(name) ?? "";
  }

  getPropertyPriority(name) {
    return this.#priorities.get(name) ?? "";
  }

  setProperty(name, value, priority = "") {
    this.#values.set(name, String(value));
    this.#priorities.set(name, priority);
  }

  removeProperty(name) {
    this.#values.delete(name);
    this.#priorities.delete(name);
  }
}

class FakeElement {
  constructor(name, attributes = {}, children = []) {
    this.localName = name;
    this.attributes = new Map(Object.entries(attributes).map(([key, value]) => [key, String(value)]));
    this.children = children;
    this.style = new FakeStyle();
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelectorAll(selector) {
    assert.equal(selector, "*");
    const descendants = [];
    const visit = (element) => {
      for (const child of element.children) {
        descendants.push(child);
        visit(child);
      }
    };
    visit(this);
    return descendants;
  }
}

function createSupportedFixture() {
  const background = new FakeElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "#FFFFFF",
  });
  const label = new FakeElement("text", { fill: "#111111" });
  const line = new FakeElement("path", { fill: "none" });
  line.style.setProperty("stroke", "#007AFF", "important");
  const stop = new FakeElement("stop", { "stop-color": "rgba(240, 107, 138, .8)" });
  const gradient = new FakeElement("linearGradient", { id: "series-gradient" }, [stop]);
  const gradientShape = new FakeElement("path", { fill: "url(#series-gradient)" });
  const inherited = new FakeElement("circle", { fill: "currentColor" });
  const svg = new FakeElement(
    "svg",
    { viewBox: "0 0 100 100" },
    [gradient, background, label, line, gradientShape, inherited],
  );

  return { svg, background, label, line, stop, gradientShape, inherited };
}

test("adapts supported inline SVG paints and preserves semantic paint references", () => {
  const fixture = createSupportedFixture();
  const palette = createAdaptivePalette("#1B212D");
  const result = adaptSvgPaint(fixture.svg, palette);

  assert.equal(result.status, "adapted");
  assert.equal(result.fallback, false);
  assert.equal(result.unsupported.length, 0);
  assert.equal(fixture.background.getAttribute("fill"), palette.colors.background);
  assert.equal(fixture.label.getAttribute("fill"), palette.colors.text);
  assert.equal(fixture.gradientShape.getAttribute("fill"), "url(#series-gradient)");
  assert.equal(fixture.inherited.getAttribute("fill"), "currentColor");
  assert.equal(fixture.line.style.getPropertyPriority("stroke"), "important");

  const stroke = parseCssColor(fixture.line.style.getPropertyValue("stroke"));
  assert.ok(contrastRatio(stroke, parseHex(palette.background)) >= 3);
  const stop = parseCssColor(fixture.stop.getAttribute("stop-color"));
  assert.ok(stop.alpha > 0 && stop.alpha <= 1);

  result.restore();
  assert.equal(fixture.background.getAttribute("fill"), "#FFFFFF");
  assert.equal(fixture.label.getAttribute("fill"), "#111111");
  assert.equal(fixture.line.style.getPropertyValue("stroke"), "#007AFF");
  assert.equal(fixture.line.style.getPropertyPriority("stroke"), "important");
  assert.equal(fixture.stop.getAttribute("stop-color"), "rgba(240, 107, 138, .8)");
});

test("reapplies from immutable originals without theme-switch drift", () => {
  const fixture = createSupportedFixture();
  const dark = createAdaptivePalette("#1B212D");
  const light = createAdaptivePalette("#F5F7F9");
  const original = {
    background: fixture.background.getAttribute("fill"),
    label: fixture.label.getAttribute("fill"),
    line: fixture.line.style.getPropertyValue("stroke"),
    stop: fixture.stop.getAttribute("stop-color"),
  };
  const states = new Map();
  let latest;

  for (let index = 0; index < 20; index += 1) {
    const name = index % 2 === 0 ? "dark" : "light";
    latest = adaptSvgPaint(fixture.svg, name === "dark" ? dark : light);
    const state = JSON.stringify({
      background: fixture.background.getAttribute("fill"),
      label: fixture.label.getAttribute("fill"),
      line: fixture.line.style.getPropertyValue("stroke"),
      stop: fixture.stop.getAttribute("stop-color"),
    });
    if (states.has(name)) assert.equal(state, states.get(name));
    else states.set(name, state);
  }

  latest.restore();
  assert.deepEqual(
    {
      background: fixture.background.getAttribute("fill"),
      label: fixture.label.getAttribute("fill"),
      line: fixture.line.style.getPropertyValue("stroke"),
      stop: fixture.stop.getAttribute("stop-color"),
    },
    original,
  );
});

test("fails atomically for unsupported SVG structures", () => {
  const path = new FakeElement("path", { stroke: "#111111" });
  const filter = new FakeElement("filter", { id: "shadow" });
  const svg = new FakeElement("svg", { viewBox: "0 0 100 100" }, [path, filter]);
  const result = adaptSvgPaint(svg, createAdaptivePalette("#1B212D"));

  assert.equal(result.status, "fallback");
  assert.equal(result.changed, 0);
  assert.ok(result.fallbackReasons.includes("unsupported-element:filter"));
  assert.equal(path.getAttribute("stroke"), "#111111");
});

test("rejects complex paint properties and dangling local references", () => {
  const masked = new FakeElement("path", { fill: "#111111", mask: "url(#mask)" });
  const dangling = new FakeElement("path", { fill: "url(#missing-gradient)" });
  const svg = new FakeElement("svg", {}, [masked, dangling]);
  const result = adaptSvgPaint(svg, createAdaptivePalette("#1B212D"));

  assert.equal(result.fallback, true);
  assert.ok(result.fallbackReasons.includes("unsupported-property:mask"));
  assert.ok(result.fallbackReasons.includes("dangling-paint-reference:missing-gradient"));
  assert.equal(masked.getAttribute("fill"), "#111111");
});

test("rejects external resources and unknown semantic roles", () => {
  const image = new FakeElement("use", { href: "https://example.com/icon.svg#shape" });
  const svgWithExternal = new FakeElement("svg", {}, [image]);
  const externalResult = adaptSvgPaint(svgWithExternal, createAdaptivePalette("#1B212D"));
  assert.equal(externalResult.fallback, true);
  assert.ok(externalResult.fallbackReasons.includes("external-reference:use"));

  const shape = new FakeElement("path", { fill: "#FF0000", "data-color-role": "mystery" });
  const svgWithRole = new FakeElement("svg", {}, [shape]);
  const roleResult = adaptSvgPaint(svgWithRole, createAdaptivePalette("#1B212D"));
  assert.equal(roleResult.fallback, true);
  assert.ok(roleResult.fallbackReasons.includes("unknown-role:mystery"));
  assert.equal(shape.getAttribute("fill"), "#FF0000");
});

test("enforces a bounded traversal", () => {
  const svg = new FakeElement("svg", {}, [
    new FakeElement("path", { stroke: "#111111" }),
    new FakeElement("path", { stroke: "#222222" }),
  ]);
  const result = adaptSvgPaint(svg, createAdaptivePalette("#1B212D"), { maxNodes: 2 });

  assert.equal(result.fallback, true);
  assert.ok(result.fallbackReasons.includes("node-limit:3"));
});

test("caches repeated paint decisions for large supported SVGs", () => {
  const colors = [
    "#007AFF",
    "#18B7A6",
    "#F06B8A",
    "#8F7DFF",
    "#FF9500",
    "#34C759",
    "#AF52DE",
    "#5AC8FA",
    "#FF3B30",
    "#5856D6",
  ];
  const paths = Array.from(
    { length: 1000 },
    (_, index) => new FakeElement("path", { fill: "none", stroke: colors[index % colors.length] }),
  );
  const svg = new FakeElement("svg", {}, paths);
  const result = adaptSvgPaint(svg, createAdaptivePalette("#1B212D"));

  assert.equal(result.fallback, false);
  assert.ok(result.changed > 0);
  assert.equal(result.changed + result.skipped, 2000);
  assert.equal(result.uniquePaints, colors.length + 1);
});
