// All-visible, color-first fixture acceptance. No scenario or business controls.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

export async function verifyScenarios({ page, base, screenshotDir, axeCheck, renderedRatio }) {
  const names = ["interface", "commerce", "reading", "analytics"];
  const backgrounds = { interface: "#243044", commerce: "#F4EFE5", reading: "#FCFCF9", analytics: "#101D29" };
  const previews = { interface: "#live-preview", commerce: "#commerce-preview", reading: "#reading-preview", analytics: "#analytics-preview" };
  const proof = { layouts: [], isolation: [], interactions: [], colors: [] };
  const apply = async (key, color) => page.locator(`#${key}-picker`).evaluate((element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); }, color);
  async function capture(name, fullPage = false) { if (screenshotDir) await page.screenshot({ path: resolve(screenshotDir, `iteration4-${name}.png`), fullPage }); }
  async function inspect(key) { await page.locator("#palette-lab").evaluate(e => { e.open = true; }); await page.locator("#inspect-example").selectOption(key); }
  async function output(key) { await inspect(key); await page.locator("[data-panel=export]").click(); await page.locator("[data-format=json]").click(); return JSON.parse(await page.locator("#export-output").textContent()); }
  async function allVisible() {
    for (const key of names) {
      assert.equal(await page.locator(`#scene-${key}`).isVisible(), true, `${key} is rendered without switching`);
      assert.equal(await page.locator(`#scene-${key}`).evaluate(e => { for (let n = e; n; n = n.parentElement) if (n.hidden || getComputedStyle(n).display === "none" || getComputedStyle(n).visibility === "hidden") return false; return true; }), true, `${key}: no hidden ancestor`);
    }
    assert.equal(await page.locator("[data-scene]").count(), 0, "no old scene selector/hiding control remains");
  }
  async function noBusinessControls() {
    assert.equal(await page.locator(".live-preview button,.live-preview select,.live-preview a,.live-preview input,.live-preview [role=button],.live-preview [role=link],.live-preview [aria-pressed],.live-preview [onclick]").count(), 0, "previews contain no real or impersonated business controls");
    assert.equal(await page.locator(".live-preview [data-category],.live-preview [data-add],.live-preview [data-quantity],#workspace-filter,.workbench-detail,#reading-list,#reading-toc,#order-lines,#checkout-demo").count(), 0, "removed workflows are absent, not disabled or hidden");
    assert.equal(await page.locator("[data-project]").count(), 3);
    assert.equal(await page.locator("[data-product]").count(), 3);
    assert.equal(await page.locator(".reading-article>p").count(), 2, "reading fixture stays short");
    assert.equal(await page.locator(".live-preview details").count(), 1, "only equivalent chart-data disclosure remains");
  }
  async function fixtureContent() {
    return page.locator(".live-preview").evaluateAll(es => es.map(e => ({
      id: e.id, content: e.textContent.replace(/\s+/g, " ").trim().replace(/Color separation heuristic passes\..*|Color-only separation fails\..*/, ""),
      objects: [...e.querySelectorAll(".product-art svg")].map(svg => svg.innerHTML),
      geometry: [...e.querySelectorAll("#chart .series-path")].map(path => path.getAttribute("d")),
      values: [...e.querySelectorAll("#fixture-data tr")].map(row => row.textContent),
    })));
  }
  // Fresh loads: pleasant independent defaults, all examples in natural flow, no
  // prior scrolling/tab/inspector action needed to create or reveal their content.
  for (const [width, height] of [[1440, 900], [1280, 900], [768, 1024], [375, 812], [320, 740]]) {
    await page.setViewportSize({ width, height }); await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForURL(`${base}examples/studio/`); await page.locator("[data-product]").first().waitFor();
    await allVisible(); await noBusinessControls();
    assert.equal(await page.locator("#palette-lab").getAttribute("open"), null, "large inspector is secondary by default");
    const layout = await page.evaluate(() => {
      const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
      return { width: innerWidth, height: innerHeight, scroll: scrollY, overflow: document.documentElement.scrollWidth > innerWidth + 1,
        title: box("#scene-interface h3"), palette: box("#interface-background"), content: box("[data-project]"), examples: [...document.querySelectorAll(".example")].map(e => ({ id: e.id, top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight, position: getComputedStyle(e).position })) };
    });
    assert.equal(layout.scroll, 0); assert.equal(layout.overflow, false);
    for (const key of ["title", "palette"]) assert.ok(layout[key].top >= 0 && layout[key].bottom <= height, `${width}: color preview and palette control in the initial fold`);
    assert.ok(layout.content.top >= 0 && layout.content.bottom <= height, "a whole readable colored status row is in the first fold");
    assert.ok(layout.examples.every(e => !["absolute", "fixed"].includes(e.position)), "normal document flow, not overlay screens");
    if (width <= 768) for (let i = 1; i < 4; i++) assert.ok(layout.examples[i].top >= layout.examples[i - 1].bottom, "mobile/tablet natural stack");
    else for (let i = 1; i < 4; i++) assert.ok(layout.examples[i].top >= layout.examples[i - 1].bottom, "generous full-width editorial stack on desktop");
    for (const key of names) assert.equal(await page.locator(`#${key}-background`).inputValue(), backgrounds[key]);
    const applied = await page.locator(".live-preview").evaluateAll(es => es.map(e => getComputedStyle(e).backgroundColor)); assert.equal(new Set(applied).size, 4);
    proof.layouts.push(layout); await capture(`firstscreen-${width}x${height}`); await capture(`gallery-${width}`, true);
    for (const key of ["commerce", "reading", "analytics"]) { await page.locator(`#example-${key}`).scrollIntoViewIfNeeded(); await capture(`${key}-${width}`); }
    if (width === 320 || width === 1440) await axeCheck(`${width}px all-visible curated defaults`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base, { waitUntil: "networkidle" }); await page.locator("[data-product]").first().waitFor();
  const defaults = {};
  for (const key of names) defaults[key] = await output(key);
  for (const key of names) {
    await page.locator("#chart .series-path").first().evaluate(e => { window.chartIdentity = e; });
    const input = page.locator(`#${key}-background`);
    await input.fill(" #abc "); await input.press("Enter"); assert.equal(await input.inputValue(), "#AABBCC");
    const accepted = await output(key); assert.equal(accepted.inputBackground, "#AABBCC");
    const exact = await page.evaluate(async ({ base, state }) => (await import(`${base}src/contrast-fit.js`)).createContrastFit(state.inputBackground, state.options), { base, state: accepted });
    assert.deepEqual(accepted.palette, exact, "independent output equals same-browser source engine exactly");
    await input.fill("#12XZ"); await input.press("Tab"); assert.equal(await input.getAttribute("aria-invalid"), "true");
    assert.deepEqual(await output(key), accepted, "invalid example draft retains full accepted transaction");
    for (const other of names.filter(n => n !== key)) assert.deepEqual(await output(other), defaults[other], `${key} color/invalid input cannot change ${other} options or output`);
    assert.equal(await input.inputValue(), "#12XZ", "inspector switching preserves invalid independent drafts");
    if (key !== "analytics") assert.equal(await page.locator("#chart .series-path").first().evaluate(e => e === window.chartIdentity), true, "unrelated palette and inspector target edits do not rebuild Analytics");
    await input.press("Escape"); assert.equal(await input.inputValue(), "#AABBCC");
    await input.fill(""); await input.pressSequentially("#abcdef"); assert.equal(await input.inputValue(), "#abcdef"); await input.press("Enter"); assert.equal(await input.inputValue(), "#ABCDEF");
    await page.locator(`[data-example-preset=${key}]`).nth(1).click();
    assert.equal((await output(key)).inputBackground, await page.locator(`[data-example-preset=${key}]`).nth(1).getAttribute("data-color"));
    await page.locator(`[data-example-reset=${key}]`).click(); assert.deepEqual(await output(key), defaults[key]);
    proof.isolation.push(`${key}: shorthand, six-digit typing, picker, invalid/blur/Escape, exact export, all other examples unchanged`);
  }
  await inspect("analytics"); await page.locator("#chart .series-path").first().evaluate(e => { window.chartIdentity = e; });
  await page.locator("#prefix").fill("chart_tokens");
  assert.equal(await page.locator("#chart .series-path").first().evaluate(e => e === window.chartIdentity), true, "export prefix changes do not rebuild chart graphics");
  await page.locator("[data-example-reset=analytics]").click();
  // Advanced state/drafts/prefix are independent too, not merely four CSS wrappers.
  await inspect("commerce"); await page.locator("#advanced-controls").evaluate(e => { e.open = true; }); await page.locator("#target-controls").evaluate(e => { e.open = true; });
  await page.locator("#textContrast").fill("12"); await page.locator("#prefix").fill("shop_tokens"); await page.locator("#seriesB").evaluate(e => { e.value = "invalid seed"; e.dispatchEvent(new Event("input", { bubbles: true })); });
  const shop = await output("commerce"); assert.equal(shop.options.textContrast, 12); assert.equal(shop.prefix, "shop_tokens");
  await page.locator("#inspect-example").focus(); const inspectorY = await page.evaluate(() => scrollY);
  await page.locator("#inspect-example").selectOption("reading"); assert.equal(await page.evaluate(() => scrollY), inspectorY, "changing inspector target does not move the viewport");
  assert.equal(await page.locator("#textContrast").inputValue(), "8"); assert.equal(await page.locator("#prefix").inputValue(), "contrast-fit");
  await inspect("commerce"); assert.equal(await page.locator("#seriesB").inputValue(), "invalid seed"); assert.equal(await page.locator("#seriesB").getAttribute("aria-invalid"), "true"); assert.equal(await page.locator("#prefix").inputValue(), "shop_tokens");
  await page.locator("#reset").click(); assert.deepEqual(await output("commerce"), defaults.commerce); await allVisible();
  proof.isolation.push("Inspector target changes only inspected record; advanced targets/prefix/errors/drafts retained independently; reset affects one palette only");

  // Palette controls are the complete interaction model. Content, artwork and
  // data stay identical; computed content colors must change through the engine.
  const stableContent = await fixtureContent();
  await page.locator(".project-list").evaluate(e => { window.fixtureNodes = [...document.querySelectorAll("[data-project],[data-product],.reading-article")]; });
  const changedColors = [];
  for (const key of names) {
    await noBusinessControls();
    const before = await output(key);
    const element = page.locator(previews[key]);
    const colors = () => element.evaluate(e => ({ background: getComputedStyle(e).backgroundColor, text: getComputedStyle(e).color,
      muted: getComputedStyle(e.querySelector(".sample-muted")).color,
      surface: getComputedStyle(e.querySelector(".sample-metric,.sample-panel,.product-art,.article-callout")).backgroundColor,
      status: e.querySelector(".sample-status") ? getComputedStyle(e.querySelector(".sample-status")).backgroundColor : null,
      statusText: e.querySelector(".sample-status") ? getComputedStyle(e.querySelector(".sample-status")).color : null,
      series: [...e.querySelectorAll("#chart .series-path")].map(p => getComputedStyle(p).stroke) }));
    const oldColors = await colors();
    const input = page.locator(`#${key}-background`); await input.focus();
    await input.fill("#B7C9D6");
    assert.equal(await input.evaluate(e => e === document.activeElement), true, "typing preserves palette focus");
    await input.evaluate(e => { window.paletteSelection = [e.selectionStart,e.selectionEnd]; });
    await apply(names.find(n => n !== key), "#313B49");
    assert.equal(await input.evaluate(e => e === document.activeElement && e.selectionStart === window.paletteSelection[0] && e.selectionEnd === window.paletteSelection[1]), true, "unrelated palette picker preserves focus/caret");
    await input.press("Tab");
    assert.equal(await page.locator(`[data-example-preset=${key}]`).first().evaluate(e => e === document.activeElement && e.matches(":focus-visible") && parseFloat(getComputedStyle(e).outlineWidth)>=2), true, "presets are keyboard reachable after hex");
    await page.keyboard.press("Enter");
    await input.fill("#12XZ"); assert.equal(await input.evaluate(e => e === document.activeElement), true);
    const valid = await colors(); await input.press("Tab"); assert.equal(await input.getAttribute("aria-invalid"), "true"); assert.deepEqual(await colors(), valid, "invalid/blur cannot partially recolor actual content");
    await input.press("Escape");
    await apply(key, "#B7C9D6");
    const newColors = await colors();
    for (const role of ["background","text","muted","surface"]) assert.notEqual(newColors[role], oldColors[role], `${key}: real ${role} color visibly changes`);
    if (key === "analytics") assert.notDeepEqual(newColors.series, oldColors.series, "chart actually recolors returned series");
    const accepted = await output(key);
    const exact = await page.evaluate(async ({base,state}) => (await import(`${base}src/contrast-fit.js`)).createContrastFit(state.inputBackground,state.options), {base,state:accepted});
    assert.deepEqual(accepted.palette, exact);
    const rgb = hex => `rgb(${[1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(", ")})`;
    for (const role of ["background","text","muted"]) assert.equal(newColors[role], rgb(role === "background" ? exact.background : exact.colors[role]), `${key}: computed ${role} is the exact real-engine output`);
    assert.equal(newColors.surface, exact.colors[key === "reading" ? "panel" : "metric"], `${key}: actual surface uses the exact returned alpha CSS`);
    if (newColors.status) { assert.equal(newColors.status,rgb(exact.colors.goodBg)); assert.equal(newColors.statusText,rgb(exact.colors.goodText)); }
    if (key === "analytics") assert.deepEqual(newColors.series,["seriesA","seriesB","seriesC"].map(role => rgb(exact.colors[role])));
    assert.deepEqual(await fixtureContent(), stableContent, "color changes preserve text, artwork geometry and fixture data");
    assert.equal(await page.evaluate(() => window.fixtureNodes.every(e => e.isConnected && !e.hasAttribute("tabindex"))), true, "static fixture identities remain stable, not fake clickable rows");
    await page.locator(`[data-example-reset=${key}]`).focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator(`[data-example-reset=${key}]`).evaluate(e => e === document.activeElement), true, "keyboard reset retains focus");
    assert.deepEqual(await output(key), before, "reset restores exact palette/options/export");
    changedColors.push({key,before:oldColors,after:newColors});
    for (const other of names.filter(n => n !== key)) { await page.locator(`[data-example-reset=${other}]`).click(); }
    proof.interactions.push(`${key}: color-only controls, stable content/objects/data/node identity, input/caret/preset/reset focus, computed background/text/muted/surface updates, exact real engine`);
  }
  proof.computedUpdates = changedColors;
  await noBusinessControls(); await axeCheck("all four simple color-only fixtures"); await capture("color-only", true);

  const samples = {
    interface: [["[data-project] strong", "text"], ["[data-project] .sample-muted", "muted"], [".workspace-overview .sample-metric strong", "metricText"], [".workspace-overview .sample-metric .sample-muted", "metricMuted"], [".workspace-overview .sample-panel h4", "panelText"], [".workspace-overview .sample-panel p", "panelMuted"], ["[data-project] .good", "goodText"], ["[data-project] .warn", "warnText"]],
    commerce: [[".product-title h4", "text"], [".product-title strong", "text"], [".product-card>p", "muted"], [".product-mark", "metricMuted"], [".collection-note>strong", "panelText"], [".collection-note>p", "panelMuted"], [".scene-commerce .good", "goodText"], [".collection-note .warn", "warnText"]],
    reading: [[".reading-article>p", "text"], [".reading-article h4", "text"], [".reading-top .sample-muted", "muted"], [".article-callout p", "panelText"], [".article-callout .sample-muted", "panelMuted"]],
    analytics: [[".analytics-heading h3", "text"], ["#chart-legend>span", "text"], [".analytics-heading .sample-muted", "muted"], [".analytics-metrics strong", "metricText"], [".analytics-metrics .sample-muted", "metricMuted"], [".analytics-heading .good", "goodText"]],
  };
  for (const test of [
    { label: "curated-defaults", bg: null, strategy: "auto", targets: [8, 4.7, 3.3, 4.5] },
    { label: "default", bg: "#777777", strategy: "auto", targets: [8, 4.7, 3.3, 4.5] },
    { label: "preserve-unresolved", bg: "#777777", strategy: "preserve", targets: [8, 4.7, 3.3, 4.5] },
    { label: "surface12-others1", bg: "#2B3548", strategy: "auto", targets: [1, 1, 1, 12] },
    { label: "accent-only21", bg: "#2B3548", strategy: "auto", targets: [8, 4.7, 21, 4.5] },
    { label: "all21", bg: "#777777", strategy: "auto", targets: [21, 21, 21, 21] },
  ]) {
    const stateProof = { label: test.label, examples: [] };
    for (const key of names) {
      await inspect(key); await page.locator("#advanced-controls").evaluate(e => { e.open = true; }); await page.locator("#target-controls").evaluate(e => { e.open = true; });
      await page.locator(`[name=strategy][value=${test.strategy}]`).check(); await apply(key, test.bg ?? backgrounds[key]);
      for (const [index, id] of ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast"].entries()) await page.locator(`#${id}`).fill(String(test.targets[index]));
      const data = await output(key);
      const actual = await page.evaluate(selectors => {
        const channels = css => css.match(/[\d.]+/g).map(Number);
        return selectors.map(([selector, metric]) => {
          const e = document.querySelector(selector), fg = channels(getComputedStyle(e).color), layers = [];
          for (let n = e; n; n = n.parentElement) { const bg = channels(getComputedStyle(n).backgroundColor); if ((bg[3] ?? 1) > 0) layers.push(bg); if ((bg[3] ?? 1) === 1) break; }
          let bg = [255,255,255]; for (const layer of layers.reverse()) bg = layer.slice(0,3).map((v,i) => Math.round(v*(layer[3]??1)+bg[i]*(1-(layer[3]??1))));
          return { selector, metric, fg, bg, translucentLayers: layers.filter(v => (v[3]??1)<1).length, opacity:getComputedStyle(e).opacity };
        });
      }, samples[key]);
      for (const sample of actual) { assert.equal(sample.opacity,"1"); assert.ok(sample.translucentLayers<=1); sample.ratio=renderedRatio(sample.fg,sample.bg); assert.ok(Math.abs(sample.ratio-data.palette.metrics[`${sample.metric}Contrast`])<1e-10, `${test.label}/${key} ${sample.selector}: actual backdrop agrees with engine metric`); }
      assert.equal(await page.locator("#experimental-warning").isVisible(),test.label==="surface12-others1");
      if (test.label==="preserve-unresolved") { assert.equal(data.palette.usable,false); assert.match(await page.locator(`#${key}-feedback`).textContent(),/Targets unresolved/); }
      stateProof.examples.push({key,background:data.palette.background,usable:data.palette.usable,samples:actual});
    }
    await allVisible(); await noBusinessControls();
    if(test.label!=="surface12-others1") await axeCheck(`${test.label} all four independent examples`);
    else {
      const unexpected=await page.evaluate(async()=> (await window.axe.run(document)).violations.filter(v=>["serious","critical"].includes(v.impact)).flatMap(v=>v.nodes.filter(n=>v.id!=="color-contrast"||!n.target.every(s=>document.querySelector(s)?.closest(".live-preview"))).map(n=>({id:v.id,target:n.target}))));
      assert.deepEqual(unexpected,[],"intentional low-target color failures scoped to the experimental examples; shell/semantics not waived");
    }
    proof.colors.push(stateProof);
  }
  for(const key of names){await inspect(key);await page.locator("#reset").click();}
  await page.locator("#palette-lab").evaluate(e=>{e.open=false;}); await allVisible();
  if(screenshotDir) await writeFile(resolve(screenshotDir,"iteration4-scenarios-proof.json"),JSON.stringify(proof,null,2)+"\n");
  console.log("PASS Studio gallery: four permanent normal-flow examples; 5 responsive widths; independent palettes/options/drafts/exports; no business controls; stable fixtures + computed color updates; 27 actual foreground/backdrop roles × 6 states (including curated defaults)");
}
