import { parseCssColor, parseHex, solveAccent } from "./adaptive-palette.js";

const ORIGINAL_PAINT = new WeakMap();
const ACTIVE_APPLICATION = new WeakMap();
const ROOT_GENERATIONS = new WeakMap();
const PAINT_PROPERTIES = ["fill", "stroke", "color", "stop-color"];
const UNSUPPORTED_ELEMENTS = new Set([
  "filter",
  "foreignobject",
  "image",
  "link",
  "mask",
  "pattern",
  "script",
  "style",
]);
const COMPLEX_PROPERTIES = ["clip-path", "filter", "mask", "mix-blend-mode"];
const REFERENCE_PROPERTIES = ["marker-start", "marker-mid", "marker-end"];

const ROLE_TOKENS = {
  background: "background",
  surface: "panel",
  text: "text",
  muted: "muted",
  border: "border",
  grid: "grid",
  axis: "axis",
  bars: "bars",
  bar: "bars",
  "series-1": "seriesA",
  "series-a": "seriesA",
  "series-2": "seriesB",
  "series-b": "seriesB",
  "series-3": "seriesC",
  "series-c": "seriesC",
  "good-background": "goodBg",
  "good-text": "goodText",
  "warning-background": "warnBg",
  "warning-text": "warnText",
};

function tagName(element) {
  return String(element?.localName ?? element?.tagName ?? "").toLowerCase();
}

function getElements(root) {
  const descendants = typeof root.querySelectorAll === "function" ? [...root.querySelectorAll("*")] : [];
  return [root, ...descendants];
}

function stylePropertyExists(style, name) {
  if (!style) return false;
  if (typeof style.length === "number" && typeof style.item === "function") {
    for (let index = 0; index < style.length; index += 1) {
      if (style.item(index) === name) return true;
    }
    return false;
  }
  if (typeof style.has === "function") return style.has(name);
  return typeof style.getPropertyValue === "function" && style.getPropertyValue(name) !== "";
}

function captureOriginal(element, source, property) {
  let properties = ORIGINAL_PAINT.get(element);
  if (!properties) {
    properties = new Map();
    ORIGINAL_PAINT.set(element, properties);
  }
  const key = `${source}:${property}`;
  if (properties.has(key)) return properties.get(key);

  let snapshot;
  if (source === "style") {
    snapshot = {
      source,
      property,
      existed: stylePropertyExists(element.style, property),
      value: element.style?.getPropertyValue?.(property) ?? "",
      priority: element.style?.getPropertyPriority?.(property) ?? "",
    };
  } else {
    const existed = typeof element.hasAttribute === "function"
      ? element.hasAttribute(property)
      : element.getAttribute?.(property) !== null;
    snapshot = {
      source,
      property,
      existed,
      value: existed ? element.getAttribute(property) : "",
      priority: "",
    };
  }
  properties.set(key, snapshot);
  return snapshot;
}

function restoreSnapshot(element, snapshot) {
  if (snapshot.source === "style") {
    if (snapshot.existed) {
      element.style.setProperty(snapshot.property, snapshot.value, snapshot.priority);
    } else {
      element.style.removeProperty?.(snapshot.property);
    }
  } else if (snapshot.existed) {
    element.setAttribute(snapshot.property, snapshot.value);
  } else {
    element.removeAttribute?.(snapshot.property);
  }
}

function isLocalPaintReference(value) {
  return /^url\(\s*#[^)]+\s*\)$/i.test(value.trim());
}

function isPreservedPaint(value) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "none" ||
    normalized === "transparent" ||
    normalized === "currentcolor" ||
    normalized.startsWith("var(") ||
    isLocalPaintReference(normalized)
  );
}

function hasExternalReference(element) {
  for (const name of ["href", "xlink:href"]) {
    const value = element.getAttribute?.(name);
    if (value && !value.trim().startsWith("#")) return true;
  }
  return false;
}

function roleColor(element, palette) {
  const role = element.getAttribute?.("data-color-role")?.trim().toLowerCase();
  if (!role) return null;
  const tokenName = ROLE_TOKENS[role];
  return tokenName ? palette.colors[tokenName] : undefined;
}

function isRootBackgroundRect(element, root) {
  if (tagName(element) !== "rect") return false;
  const width = element.getAttribute?.("width")?.trim();
  const height = element.getAttribute?.("height")?.trim();
  const x = element.getAttribute?.("x")?.trim() ?? "0";
  const y = element.getAttribute?.("y")?.trim() ?? "0";
  if (width === "100%" && height === "100%" && Number(x) === 0 && Number(y) === 0) return true;

  const viewBox = root.getAttribute?.("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length !== 4 || !viewBox.every(Number.isFinite)) return false;
  const [, , viewBoxWidth, viewBoxHeight] = viewBox;
  return Number(x) === 0 && Number(y) === 0 && Number(width) === viewBoxWidth && Number(height) === viewBoxHeight;
}

function choosePaint(element, property, originalValue, root, palette, options, cache) {
  const cacheKey = [
    tagName(element),
    property,
    originalValue,
    element.getAttribute?.("data-color-role") ?? "",
    property === "fill" && isRootBackgroundRect(element, root) ? "root-background" : "",
  ].join("|");
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const finish = (decision) => {
    cache.set(cacheKey, decision);
    return decision;
  };

  if (isPreservedPaint(originalValue)) return finish({ preserve: true });

  const explicitRoleColor = roleColor(element, palette);
  if (explicitRoleColor === undefined) {
    return finish({ unsupported: `unknown-role:${element.getAttribute("data-color-role")}` });
  }
  if (explicitRoleColor) return finish({ value: explicitRoleColor });

  const parsed = parseCssColor(originalValue);
  if (!parsed) return finish({ unsupported: `unsupported-paint:${originalValue}` });
  if (parsed.alpha === 0) return finish({ preserve: true });

  const name = tagName(element);
  if (name === "text" || name === "tspan") return finish({ value: palette.colors.text });
  if (property === "stop-color") {
    const result = solveAccent(parseHex(palette.background), parsed, options.seriesContrast, {
      alpha: parsed.alpha,
    });
    return finish(result.targetMet ? { value: result.css } : { unsupported: "gradient-stop-contrast" });
  }
  if (property === "fill" && isRootBackgroundRect(element, root)) {
    return finish({ value: palette.colors.background });
  }

  const result = solveAccent(parseHex(palette.background), parsed, options.graphicContrast, {
    alpha: parsed.alpha,
  });
  return finish(result.targetMet ? { value: result.css } : { unsupported: `${property}-contrast` });
}

function validateStructure(elements, options) {
  const reasons = new Set();
  const localIds = new Set(
    elements.map((element) => element.getAttribute?.("id")).filter((value) => typeof value === "string" && value),
  );
  if (elements.length > options.maxNodes) reasons.add(`node-limit:${elements.length}`);

  for (const element of elements) {
    const name = tagName(element);
    if (UNSUPPORTED_ELEMENTS.has(name)) reasons.add(`unsupported-element:${name}`);
    if (hasExternalReference(element)) reasons.add(`external-reference:${name || "unknown"}`);

    for (const property of COMPLEX_PROPERTIES) {
      const attributeValue = element.getAttribute?.(property);
      const styleValue = stylePropertyExists(element.style, property)
        ? element.style.getPropertyValue(property)
        : null;
      for (const value of [attributeValue, styleValue]) {
        if (value && value.trim().toLowerCase() !== "none") reasons.add(`unsupported-property:${property}`);
      }
    }

    for (const property of REFERENCE_PROPERTIES) {
      const values = [element.getAttribute?.(property)];
      if (stylePropertyExists(element.style, property)) values.push(element.style.getPropertyValue(property));
      for (const value of values.filter(Boolean)) {
        if (/url\(/i.test(value) && !isLocalPaintReference(value)) {
          reasons.add(`external-reference:${property}`);
        }
      }
    }

    for (const property of PAINT_PROPERTIES) {
      const values = [];
      if (element.getAttribute?.(property) !== null && element.getAttribute?.(property) !== undefined) {
        values.push(element.getAttribute(property));
      }
      if (stylePropertyExists(element.style, property)) {
        values.push(element.style.getPropertyValue(property));
      }
      for (const value of values) {
        if (/url\(/i.test(value) && !isLocalPaintReference(value)) {
          reasons.add(`external-paint-reference:${property}`);
        } else if (isLocalPaintReference(value)) {
          const reference = value.match(/^url\(\s*#([^)\s]+)\s*\)$/i)?.[1];
          if (reference && !localIds.has(reference)) reasons.add(`dangling-paint-reference:${reference}`);
        }
      }
    }
  }
  return [...reasons];
}

function noOpRestore() {}

export function adaptSvgPaint(root, palette, options = {}) {
  if (!root || typeof root !== "object") throw new TypeError("root must be an SVG element or subtree");
  if (!palette?.colors || !palette?.background) {
    throw new TypeError("palette must be created by createAdaptivePalette");
  }

  ACTIVE_APPLICATION.get(root)?.restore();
  const generation = (ROOT_GENERATIONS.get(root) ?? 0) + 1;
  ROOT_GENERATIONS.set(root, generation);

  const settings = {
    maxNodes: options.maxNodes ?? 2000,
    graphicContrast: options.graphicContrast ?? palette.compliance?.targets?.graphic ?? 3,
    seriesContrast: options.seriesContrast ?? palette.compliance?.targets?.series ?? 3.3,
  };
  if (!Number.isInteger(settings.maxNodes) || settings.maxNodes <= 0) {
    throw new RangeError("maxNodes must be a positive integer");
  }

  const elements = getElements(root);
  const fallbackReasons = validateStructure(elements, settings);
  if (fallbackReasons.length > 0) {
    return {
      status: "fallback",
      adapted: false,
      fallback: true,
      changed: 0,
      skipped: 0,
      uniquePaints: 0,
      unsupported: fallbackReasons,
      fallbackReasons,
      restore: noOpRestore,
    };
  }

  const operations = [];
  const capturedElements = new Set();
  const paintCache = new Map();
  let skipped = 0;
  for (const element of elements) {
    for (const property of PAINT_PROPERTIES) {
      for (const source of ["attribute", "style"]) {
        const present =
          source === "style"
            ? stylePropertyExists(element.style, property)
            : element.getAttribute?.(property) !== null && element.getAttribute?.(property) !== undefined;
        if (!present) continue;

        const snapshot = captureOriginal(element, source, property);
        capturedElements.add(element);
        const decision = choosePaint(element, property, snapshot.value, root, palette, settings, paintCache);
        if (decision.unsupported) {
          fallbackReasons.push(decision.unsupported);
        } else if (decision.preserve || decision.value === snapshot.value) {
          skipped += 1;
        } else {
          operations.push({ element, snapshot, value: decision.value });
        }
      }
    }
  }

  if (fallbackReasons.length > 0) {
    const uniqueReasons = [...new Set(fallbackReasons)];
    capturedElements.forEach((element) => ORIGINAL_PAINT.delete(element));
    return {
      status: "fallback",
      adapted: false,
      fallback: true,
      changed: 0,
      skipped,
      uniquePaints: paintCache.size,
      unsupported: uniqueReasons,
      fallbackReasons: uniqueReasons,
      restore: noOpRestore,
    };
  }

  for (const operation of operations) {
    if (operation.snapshot.source === "style") {
      operation.element.style.setProperty(
        operation.snapshot.property,
        operation.value,
        operation.snapshot.priority,
      );
    } else {
      operation.element.setAttribute(operation.snapshot.property, operation.value);
    }
  }

  let restored = false;
  const restore = () => {
    if (restored || ACTIVE_APPLICATION.get(root)?.generation !== generation) return;
    for (const operation of operations) restoreSnapshot(operation.element, operation.snapshot);
    capturedElements.forEach((element) => ORIGINAL_PAINT.delete(element));
    ACTIVE_APPLICATION.delete(root);
    restored = true;
  };
  ACTIVE_APPLICATION.set(root, { generation, restore });

  return {
    status: operations.length > 0 ? "adapted" : "noop",
    adapted: operations.length > 0,
    fallback: false,
    changed: operations.length,
    skipped,
    uniquePaints: paintCache.size,
    unsupported: [],
    fallbackReasons: [],
    restore,
  };
}
