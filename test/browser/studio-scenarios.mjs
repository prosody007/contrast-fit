// Browser acceptance for the complete color-only Studio; no production test hooks.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

export async function verifyScenarios({ page, base, screenshotDir, axeCheck, renderedRatio }) {
  const names = ["interface", "commerce", "reading", "analytics"];
  const backgrounds = { interface: "#243044", commerce: "#F4EFE5", reading: "#FCFCF9", analytics: "#101D29" };
  const previews = { interface: "#live-preview", commerce: "#commerce-preview", reading: "#reading-preview", analytics: "#analytics-preview" };
  const proof = { layouts: [], isolation: [], interactions: [], colors: [], computedUpdates: [] };
  const picker = async (key, color) => page.locator(`#${key}-picker`).evaluate((element, value) => {
    element.value = value; element.dispatchEvent(new Event("input", { bubbles: true }));
  }, color);
  const reset = async key => page.locator(`[data-example-reset=${key}]`).click();
  const fill = async (key, value, end = "Enter") => { const input = page.locator(`#${key}-background`); await input.fill(value); if (end) await input.press(end); };
  const color = hex => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  const engine = async background => page.evaluate(async ({ base, background }) => (await import(`${base}src/contrast-fit.js`)).createContrastFit(background), { base, background });
  async function capture(name, fullPage = false) {
    if (screenshotDir) await page.screenshot({ path: resolve(screenshotDir, `iteration5-${name}.png`), fullPage });
  }
  async function allVisible() {
    for (const key of names) {
      assert.equal(await page.locator(`#scene-${key}`).isVisible(), true, `${key} is rendered without switching`);
      assert.equal(await page.locator(`#scene-${key}`).evaluate(e => {
        for (let n = e; n; n = n.parentElement) if (n.hidden || ["none"].includes(getComputedStyle(n).display) || ["hidden", "collapse"].includes(getComputedStyle(n).visibility)) return false;
        return true;
      }), true, `${key}: no hidden ancestor`);
    }
  }
  async function noRetiredUI() {
    assert.equal(await page.locator("#palette-lab,.palette-lab,[data-inspect],.inspect-button,#inspect-example,.inspector,[data-panel],[data-format],#token-list,#token-detail,#measurements-body,#panel-compare,#baseline-preview,#fitted-preview,#advanced-controls,#target-controls,#accent-controls,#extreme-targets,#same-seeds,#prefix,#export-output,#copy,#download,[name=strategy],[data-preset],[data-scene],input[type=number],select,textarea").count(), 0, "retired tools are absent, not hidden");
    assert.doesNotMatch(await page.locator("body").textContent(), /Palette tools|Inspect palette|Advanced tools|Options & seeds/);
    assert.equal(await page.locator("a[href*='palette-lab'],a[href*='inspector'],a[href*='panel-export']").count(), 0);
    assert.equal(await page.locator("details").count(), 1, "only chart-local equivalent data disclosure exists");
    assert.equal(await page.locator(".live-preview button,.live-preview select,.live-preview a,.live-preview input,.live-preview [role=button],.live-preview [role=link],.live-preview [aria-pressed],.live-preview [onclick]").count(), 0, "no real or imitated business controls");
    assert.equal(await page.locator(".live-preview [data-category],.live-preview [data-add],.live-preview [data-quantity],#workspace-filter,.workbench-detail,#reading-list,#reading-toc,#order-lines,#checkout-demo").count(), 0);
    assert.equal(await page.locator("[data-project]").count(), 3); assert.equal(await page.locator("[data-product]").count(), 3);
    assert.equal(await page.locator(".reading-article>p").count(), 2);
    assert.equal(await page.locator("input[type=color]").count(), 4); assert.equal(await page.locator("input[type=text]").count(), 4);
    assert.equal(await page.locator("button").count(), 16, "only 12 presets and 4 reset buttons");
  }
  // Fetch what the browser actually loaded; absence checks cover obsolete code as
  // well as live DOM, without adding any shim to the production modules.
  const retired = /palette-lab|data-inspect|inspect-example|renderTools|syncTools|renderTokens|renderMeasurements|renderComparison|exportContent|renderExport|tokenInfo|selectedToken|paletteToCssVariables|navigator\.clipboard|execCommand|createObjectURL|backgroundStrategy|textContrast|mutedContrast|accentContrast|surfaceTextContrast|data-panel|data-format|data-seed-result|experimental-warning|summary-action/;
  for (const path of ["examples/studio/index.html", "examples/studio/studio.js", "examples/studio/studio.css", "examples/studio/scenes.js"]) {
    const response = await page.request.get(`${base}${path}`); assert.equal(response.status(), 200);
    assert.doesNotMatch(await response.text(), retired, `${path}: obsolete production surface/behavior removed`);
  }
  const fixtureContent = async () => page.locator(".live-preview").evaluateAll(es => es.map(e => ({
    id: e.id, content: e.textContent.replace(/\s+/g, " ").trim().replace(/Color separation heuristic passes\..*|Color-only separation fails\..*/, ""),
    objects: [...e.querySelectorAll(".product-art svg")].map(svg => svg.innerHTML),
    geometry: [...e.querySelectorAll("#chart .series-path")].map(path => path.getAttribute("d")),
    values: [...e.querySelectorAll("#fixture-data tr")].map(row => row.textContent),
  })));
  const snapshot = async key => page.locator(`#example-${key}`).evaluate(e => {
    const preview = e.querySelector(".live-preview");
    return { input: e.querySelector("input[type=text]").value, picker: e.querySelector("input[type=color]").value,
      invalid: e.querySelector("input[type=text]").getAttribute("aria-invalid"), error: e.querySelector(".field-error").textContent,
      feedback: e.querySelector(".palette-feedback").textContent, style: preview.getAttribute("style"), resolved: preview.dataset.resolved,
      usable: preview.dataset.usable, chart: [...e.querySelectorAll(".series-path")].map(p => p.outerHTML) };
  });
  async function rendered(key, background) {
    const expected = await engine(background);
    const actual = await page.locator(previews[key]).evaluate(e => {
      const css = node => node ? getComputedStyle(node) : null;
      const status = kind => [...e.querySelectorAll(`.${kind}`)].map(n => ({ background: css(n).backgroundColor, text: css(n).color }));
      return { background: css(e).backgroundColor, text: css(e).color, muted: css(e.querySelector(".sample-muted")).color,
        variables: Object.fromEntries([...e.style].map(k => [k, e.style.getPropertyValue(k)])),
        frame: css(e.parentElement).borderTopColor, metric: [...e.querySelectorAll(".sample-metric,.product-art")].map(n => css(n).backgroundColor),
        panel: [...e.querySelectorAll(".sample-panel,.article-callout")].map(n => css(n).backgroundColor), good: status("good"), warn: status("warn"),
        series: [...e.querySelectorAll("#chart .series-path")].map(n => css(n).stroke), resolved: e.dataset.resolved, usable: e.dataset.usable };
    });
    const variables = await page.evaluate(async ({ base, expected }) => (await import(`${base}src/contrast-fit.js`)).paletteToCssVariables(expected), { base, expected });
    assert.deepEqual(actual.variables, variables, `${key}: all 17 real CSS properties exactly match browser engine`);
    assert.equal(actual.background, color(expected.background)); assert.equal(actual.text, color(expected.colors.text));
    assert.equal(actual.muted, color(expected.colors.muted)); assert.equal(actual.frame, color(expected.inputBackground));
    assert.equal(actual.resolved, expected.background); assert.equal(actual.usable, String(expected.usable));
    for (const value of actual.metric) assert.equal(value, expected.colors.metric);
    for (const value of actual.panel) assert.equal(value, expected.colors.panel);
    for (const kind of ["good", "warn"]) for (const value of actual[kind]) assert.deepEqual(value, { background: color(expected.colors[`${kind}Bg`]), text: color(expected.colors[`${kind}Text`]) });
    if (key === "analytics") assert.deepEqual(actual.series, ["seriesA", "seriesB", "seriesC"].map(k => color(expected.colors[k])));
    const feedback = await page.locator(`#${key}-feedback`).textContent();
    if (expected.background !== expected.inputBackground) assert.ok(feedback.includes(`Applied ${expected.background}`), "truthful applied-background feedback");
    else assert.doesNotMatch(feedback, /Applied/);
    if (!expected.meetsTarget.seriesDistinct && key === "analytics") assert.match(feedback, /Color-only separation fails/);
    return { expected, actual };
  }

  for (const [width, height] of [[1440, 900], [1280, 900], [768, 1024], [375, 812], [320, 740]]) {
    await page.setViewportSize({ width, height }); await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForURL(`${base}examples/studio/`); await page.locator("[data-product]").first().waitFor();
    await allVisible(); await noRetiredUI();
    const layout = await page.evaluate(() => {
      const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
      return { width: innerWidth, height: innerHeight, scroll: scrollY, overflow: document.documentElement.scrollWidth > innerWidth + 1,
        title: box("#scene-interface h3"), palette: box("#interface-background"), content: box("[data-project]"),
        examples: [...document.querySelectorAll(".example")].map(e => ({ id: e.id, top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight, position: getComputedStyle(e).position })) };
    });
    assert.equal(layout.scroll, 0); assert.equal(layout.overflow, false);
    for (const key of ["title", "palette", "content"]) assert.ok(layout[key].top >= 0 && layout[key].bottom <= height, `${width}: readable ${key} in first fold`);
    assert.ok(layout.examples.every(e => !["absolute", "fixed"].includes(e.position)));
    for (let i = 1; i < 4; i++) assert.ok(layout.examples[i].top >= layout.examples[i - 1].bottom, "normal-flow full-width stack");
    for (const key of names) { assert.equal(await page.locator(`#${key}-background`).inputValue(), backgrounds[key]); await rendered(key, backgrounds[key]); }
    assert.equal(new Set(await page.locator(".live-preview").evaluateAll(es => es.map(e => getComputedStyle(e).backgroundColor))).size, 4);
    proof.layouts.push(layout); await capture(`firstscreen-${width}x${height}`); await capture(`gallery-${width}`, true);
    for (const key of ["commerce", "reading", "analytics"]) { await page.locator(`#example-${key}`).scrollIntoViewIfNeeded(); await capture(`${key}-${width}`); }
    const minText = await page.locator("#chart text").evaluateAll(es => Math.min(...es.map(e => parseFloat(getComputedStyle(e).fontSize) * Math.hypot(e.getScreenCTM().a, e.getScreenCTM().b))));
    assert.ok(minText >= 10, `${width}: original chart label minimum`);
    if (width <= 768) {
      await page.locator(".chart-scroll").focus(); await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector(".chart-scroll").scrollLeft > 0);
      assert.equal(await page.evaluate(() => scrollX), 0);
      assert.equal(await page.locator(".chart-scroll").evaluate(e => e.matches(":focus-visible") && parseFloat(getComputedStyle(e).outlineWidth) >= 2), true);
    }
    await page.locator(".sample-data summary").focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator(".sample-data").evaluate(e => e.open), true); assert.equal(await page.locator("#fixture-data").isVisible(), true);
    await page.keyboard.press("Enter"); assert.equal(await page.locator(".sample-data").evaluate(e => e.open), false);
    if (width === 320 || width === 1440) await axeCheck(`${width}px color-only defaults and chart disclosure`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base, { waitUntil: "networkidle" }); await page.locator("[data-product]").first().waitFor();
  const initial = Object.fromEntries(await Promise.all(names.map(async key => [key, await snapshot(key)])));
  const stableContent = await fixtureContent();
  await page.evaluate(() => { window.fixtureNodes = [...document.querySelectorAll("[data-project],[data-product],.reading-article,#fixture-data tr")]; });
  for (const key of names) {
    const input = page.locator(`#${key}-background`), other = names.find(n => n !== key);
    const before = (await rendered(key, backgrounds[key])).actual;
    await page.locator("#chart .series-path").first().evaluate(e => { window.chartIdentity = e; });
    await fill(key, " #abc "); assert.equal(await input.inputValue(), "#AABBCC"); await rendered(key, "#AABBCC");
    const accepted = await snapshot(key);
    await fill(key, "#12XZ", "Tab"); assert.equal(await input.inputValue(), "#12XZ"); assert.equal(await input.getAttribute("aria-invalid"), "true");
    assert.match(await page.locator(`#${key}-error`).textContent(), /Last valid palette retained/); assert.equal(await page.locator(`#${key}-error`).isVisible(), true);
    const invalid = await snapshot(key); for (const role of ["style", "resolved", "usable", "picker", "chart"]) assert.deepEqual(invalid[role], accepted[role], "invalid/blur preserves last valid applied transaction");
    for (const n of names.filter(n => n !== key)) assert.deepEqual(await snapshot(n), initial[n], `${key}: no unrelated palette mutation`);
    if (key !== "analytics") assert.equal(await page.locator("#chart .series-path").first().evaluate(e => e === window.chartIdentity), true, "unrelated edits retain chart node identity");
    await input.press("Escape"); assert.equal(await input.inputValue(), "#AABBCC"); assert.equal(await input.getAttribute("aria-invalid"), "false");
    await input.fill(""); await input.pressSequentially("#abcdef"); assert.equal(await input.inputValue(), "#abcdef", "typing not rewritten after valid shorthand");
    assert.equal(await input.evaluate(e => e === document.activeElement && e.selectionStart === 7 && e.selectionEnd === 7), true);
    await input.press("Enter"); assert.equal(await input.inputValue(), "#ABCDEF"); await rendered(key, "#ABCDEF");
    await fill(key, " #f0a ", "Tab"); assert.equal(await input.inputValue(), "#FF00AA"); await rendered(key, "#FF00AA");
    await input.fill("#B7C9D6"); await input.evaluate(e => { e.setSelectionRange(2, 5); window.paletteSelection = [e.selectionStart, e.selectionEnd]; });
    await picker(other, "#313B49");
    assert.equal(await input.evaluate(e => e === document.activeElement && e.selectionStart === window.paletteSelection[0] && e.selectionEnd === window.paletteSelection[1]), true, "unrelated picker preserves focus/caret");
    await reset(other); await input.focus(); await input.press("Tab");
    assert.equal(await page.locator(`[data-example-preset=${key}]`).first().evaluate(e => e === document.activeElement && e.matches(":focus-visible") && parseFloat(getComputedStyle(e).outlineWidth) >= 2), true);
    await page.keyboard.press("Enter"); await rendered(key, backgrounds[key]);
    await picker(key, "#B7C9D6"); assert.equal(await input.inputValue(), "#B7C9D6");
    const after = (await rendered(key, "#B7C9D6")).actual;
    for (const role of ["background", "text", "muted"]) assert.notEqual(after[role], before[role], `${key}: actual ${role} changes`);
    for (const role of ["metric", "panel", "series"]) if (before[role].length) assert.notDeepEqual(after[role], before[role], `${key}: actual ${role} changes`);
    for (let index = 0; index < 3; index++) {
      const button = page.locator(`[data-example-preset=${key}]`).nth(index); await button.click();
      await rendered(key, await button.getAttribute("data-color")); assert.equal(await button.getAttribute("aria-pressed"), "true");
    }
    assert.deepEqual(await fixtureContent(), stableContent, "all text, object artwork, chart geometry and data stay stable");
    assert.equal(await page.evaluate(() => window.fixtureNodes.every(e => e.isConnected && !e.hasAttribute("tabindex"))), true);
    await page.locator(`[data-example-reset=${key}]`).focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator(`[data-example-reset=${key}]`).evaluate(e => e === document.activeElement), true);
    assert.deepEqual(await snapshot(key), initial[key], "reset restores exact local palette");
    proof.computedUpdates.push({ key, before, after }); proof.isolation.push(`${key}: independent last-valid/draft/picker/preset/reset state, focus/caret and stable content/nodes`);
    await allVisible(); await noRetiredUI();
  }

  const samples = {
    interface: [["[data-project] strong", "text"], ["[data-project] .sample-muted", "muted"], [".workspace-overview .sample-metric strong", "metricText"], [".workspace-overview .sample-metric .sample-muted", "metricMuted"], [".workspace-overview .sample-panel h4", "panelText"], [".workspace-overview .sample-panel p", "panelMuted"], ["[data-project] .good", "goodText"], ["[data-project] .warn", "warnText"]],
    commerce: [[".product-title h4", "text"], [".product-title strong", "text"], [".product-card>p", "muted"], [".product-mark", "metricMuted"], [".collection-note>strong", "panelText"], [".collection-note>p", "panelMuted"], [".scene-commerce .good", "goodText"], [".collection-note .warn", "warnText"]],
    reading: [[".reading-article>p", "text"], [".reading-article h4", "text"], [".reading-top .sample-muted", "muted"], [".article-callout p", "panelText"], [".article-callout .sample-muted", "panelMuted"]],
    analytics: [[".analytics-heading h3", "text"], ["#chart-legend>span", "text"], [".analytics-heading .sample-muted", "muted"], [".analytics-metrics strong", "metricText"], [".analytics-metrics .sample-muted", "metricMuted"], [".analytics-heading .good", "goodText"]],
  };
  assert.equal(Object.values(samples).reduce((n, v) => n + v.length, 0), 27);
  const states = [
    { label: "curated-defaults", action: reset, bg: key => backgrounds[key] },
    ...[0, 1, 2].map(index => ({ label: `preset-${index + 1}`, action: async key => page.locator(`[data-example-preset=${key}]`).nth(index).click(), bg: async key => page.locator(`[data-example-preset=${key}]`).nth(index).getAttribute("data-color") })),
    ...["#000000", "#FFFFFF", "#FF00FF", "#FFFF00", "#090D12", "#777777", "#204060", "#B7C9D6"].map(bg => ({ label: `hex-${bg.slice(1)}`, action: key => fill(key, bg), bg: () => bg })),
    { label: "shorthex-enter", action: key => fill(key, " #f0a "), bg: () => "#FF00AA" },
    { label: "native-picker", action: key => picker(key, "#313B49"), bg: () => "#313B49" },
    { label: "invalid-retains-last-valid", action: async key => { await fill(key, "#777777"); await fill(key, "#12XZ", "Tab"); }, bg: () => "#777777" },
    { label: "escape-recovery", action: async key => { await page.locator(`#${key}-background`).press("Escape"); }, bg: () => "#777777" },
    { label: "blur-normalizes", action: key => fill(key, " #abc ", "Tab"), bg: () => "#AABBCC" },
    { label: "reset", action: reset, bg: key => backgrounds[key] },
  ];
  for (const state of states) {
    const stateProof = { label: state.label, examples: [] };
    for (const key of names) {
      await state.action(key); const background = await state.bg(key), { expected } = await rendered(key, background);
      const actual = await page.evaluate(selectors => {
        const channels = css => css.match(/[\d.]+/g).map(Number);
        return selectors.map(([selector, metric]) => {
          const e = document.querySelector(selector), fg = channels(getComputedStyle(e).color), layers = [];
          for (let n = e; n; n = n.parentElement) {
            const bg = channels(getComputedStyle(n).backgroundColor);
            if ((bg[3] ?? 1) > 0) layers.push(bg); if ((bg[3] ?? 1) === 1) break;
          }
          let bg = [255, 255, 255]; for (const layer of layers.reverse()) bg = layer.slice(0, 3).map((v, i) => Math.round(v * (layer[3] ?? 1) + bg[i] * (1 - (layer[3] ?? 1))));
          return { selector, metric, fg, bg, translucentLayers: layers.filter(v => (v[3] ?? 1) < 1).length, opacity: getComputedStyle(e).opacity };
        });
      }, samples[key]);
      for (const sample of actual) {
        assert.equal(sample.opacity, "1"); assert.ok(sample.translucentLayers <= 1);
        sample.ratio = renderedRatio(sample.fg, sample.bg);
        assert.ok(Math.abs(sample.ratio - expected.metrics[`${sample.metric}Contrast`]) < 1e-10, `${state.label}/${key}/${sample.selector}: actual composed backdrop agrees with engine`);
        const target = sample.metric === "text" ? 8 : sample.metric === "muted" ? 4.7 : 4.5;
        assert.ok(sample.ratio >= target, `${state.label}/${key}/${sample.selector}: actual WCAG contrast >= unchanged default ${target}`);
      }
      stateProof.examples.push({ key, input: background, background: expected.background, usable: expected.usable, samples: actual });
    }
    await allVisible(); await noRetiredUI(); await axeCheck(`${state.label}: all four independent color previews`);
    proof.colors.push(stateProof);
  }
  await page.locator(".sample-data summary").click(); await axeCheck("expanded equivalent chart data table");
  assert.deepEqual(await fixtureContent(), stableContent);
  const ids = await page.locator("[id]").evaluateAll(es => es.map(e => e.id)); assert.equal(new Set(ids).size, ids.length);
  for (const key of names) await picker(key, "#B7C9D6");
  await page.reload({ waitUntil: "networkidle" }); await page.locator("[data-product]").first().waitFor();
  for (const key of names) assert.deepEqual(await snapshot(key), initial[key], "reload deterministically restores local curated defaults");
  await allVisible(); await noRetiredUI(); await capture("final-desktop", true);
  await page.setViewportSize({ width: 375, height: 812 }); await capture("final-mobile", true);
  proof.interactions.push("native picker, short/full/invalid hex, Enter/blur/Escape, all presets, keyboard reset, visible focus, caret isolation, chart scrolling/disclosure, reload determinism");
  if (screenshotDir) await writeFile(resolve(screenshotDir, "iteration5-scenarios-proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(`PASS Studio color-only: retired DOM/scripts/styles/links absent; four normal-flow examples at 5 widths; independent color transactions, stable fixtures and actual browser-engine CSS; 27 real foreground/backdrop roles × ${states.length} reachable states`);
}
