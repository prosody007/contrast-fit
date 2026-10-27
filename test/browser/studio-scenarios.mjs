// All-visible, independently themed product-gallery acceptance. No scenario selector.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

export async function verifyScenarios({ page, base, screenshotDir, axeCheck, renderedRatio }) {
  const names = ["interface", "commerce", "reading", "analytics"];
  const backgrounds = { interface: "#243044", commerce: "#F4EFE5", reading: "#FCFCF9", analytics: "#101D29" };
  const previews = { interface: "#live-preview", commerce: "#commerce-preview", reading: "#reading-preview", analytics: "#analytics-preview" };
  const proof = { layouts: [], isolation: [], interactions: [], colors: [] };
  const apply = async (key, color) => page.locator(`#${key}-picker`).evaluate((element, value) => { element.value = value; element.dispatchEvent(new Event("input", { bubbles: true })); }, color);
  async function capture(name, fullPage = false) { if (screenshotDir) await page.screenshot({ path: resolve(screenshotDir, `iteration3-${name}.png`), fullPage }); }
  async function inspect(key) { await page.locator("#palette-lab").evaluate(e => { e.open = true; }); await page.locator("#inspect-example").selectOption(key); }
  async function output(key) { await inspect(key); await page.locator("[data-panel=export]").click(); await page.locator("[data-format=json]").click(); return JSON.parse(await page.locator("#export-output").textContent()); }
  async function allVisible() {
    for (const key of names) {
      assert.equal(await page.locator(`#scene-${key}`).isVisible(), true, `${key} is rendered without switching`);
      assert.equal(await page.locator(`#scene-${key}`).evaluate(e => { for (let n = e; n; n = n.parentElement) if (n.hidden || getComputedStyle(n).display === "none" || getComputedStyle(n).visibility === "hidden") return false; return true; }), true, `${key}: no hidden ancestor`);
    }
    assert.equal(await page.locator("[data-scene]").count(), 0, "no old scene selector/hiding control remains");
  }
  // Fresh loads: pleasant independent defaults, all examples in natural flow, no
  // prior scrolling/tab/inspector action needed to create or reveal their content.
  for (const [width, height] of [[1440, 900], [1280, 900], [768, 1024], [375, 812], [320, 740]]) {
    await page.setViewportSize({ width, height }); await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForURL(`${base}examples/studio/`); await page.locator("[data-issue]").first().waitFor();
    await allVisible();
    assert.equal(await page.locator("#palette-lab").getAttribute("open"), null, "large inspector is secondary by default");
    const layout = await page.evaluate(() => {
      const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
      return { width: innerWidth, height: innerHeight, scroll: scrollY, overflow: document.documentElement.scrollWidth > innerWidth + 1,
        title: box("#scene-interface h3"), action: box("#workspace-filter"), task: box("[data-issue]"), examples: [...document.querySelectorAll(".example")].map(e => ({ id: e.id, top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight, position: getComputedStyle(e).position })) };
    });
    assert.equal(layout.scroll, 0); assert.equal(layout.overflow, false);
    for (const key of ["title", "action"]) assert.ok(layout[key].top >= 0 && layout[key].bottom <= height, `${width}: real first application/action in the initial fold`);
    assert.ok(layout.task.top >= 0 && layout.task.bottom <= height, "a whole readable actionable task is in the first fold, not four miniature samples");
    assert.ok(layout.examples.every(e => !["absolute", "fixed"].includes(e.position)), "normal document flow, not overlay screens");
    if (width <= 768) for (let i = 1; i < 4; i++) assert.ok(layout.examples[i].top >= layout.examples[i - 1].bottom, "mobile/tablet natural stack");
    else for (let i = 1; i < 4; i++) assert.ok(layout.examples[i].top >= layout.examples[i - 1].bottom, "generous full-width editorial stack on desktop");
    for (const key of names) assert.equal(await page.locator(`#${key}-background`).inputValue(), backgrounds[key]);
    const applied = await page.locator(".live-preview").evaluateAll(es => es.map(e => getComputedStyle(e).backgroundColor)); assert.equal(new Set(applied).size, 4);
    proof.layouts.push(layout); await capture(`firstscreen-${width}x${height}`); await capture(`gallery-${width}`, true);
    for (const key of ["commerce", "reading", "analytics"]) { await page.locator(`#example-${key}`).scrollIntoViewIfNeeded(); await capture(`${key}-${width}`); }
    if (width === 320 || width === 1440) await axeCheck(`${width}px all-visible curated defaults`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base, { waitUntil: "networkidle" }); await page.locator("[data-issue]").first().waitFor();
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

  await page.locator("#workspace-filter").selectOption("review"); assert.equal(await page.locator("[data-issue]:visible").count(), 1); assert.equal(await page.locator("#issue-count").textContent(), "1 issue shown");
  const task = page.locator('[data-issue="NS-124"]'); await task.focus(); await page.keyboard.press("Enter"); assert.equal(await page.locator("#workspace-detail-title").textContent(), "Bring search into the workspace");
  await task.evaluate(e => { window.fixtureNode = e; }); await apply("interface", "#273E4D"); await apply("reading", "#EEE5D5");
  assert.equal(await task.evaluate(e => e === window.fixtureNode && e === document.activeElement), true); assert.equal(await page.locator("#workspace-filter").inputValue(), "review");
  await page.locator("#workspace-detail-action").focus(); await page.keyboard.press("Enter"); assert.equal(await task.evaluate(e => e === document.activeElement), true); assert.equal(await page.locator(".workbench-detail").isVisible(), false);
  await page.keyboard.press("Enter"); await page.keyboard.press("Escape"); assert.equal(await task.evaluate(e => e === document.activeElement), true);
  await page.locator("#workspace-filter").selectOption("done"); assert.equal(await page.locator("[data-issue]:visible").count(), 0); assert.equal(await page.locator(".empty-issues").isVisible(), true);
  await page.locator("#workspace-filter").selectOption("all"); await page.locator('[data-issue="NS-119"]').click();
  proof.interactions.push("Project: filter/count, selected details, empty state, own/other palette node+focus identity, Enter/close/Escape focus return");

  await page.locator("#checkout-demo").click(); assert.match(await page.locator("#order-review-status").textContent(), /empty/);
  await page.locator("[data-category=home]").click(); assert.equal(await page.locator("[data-product]:visible").count(), 2);
  await page.locator("[data-add=vase]").click(); await page.locator("[data-add=vase]").click(); await page.locator("[data-add=cup]").click();
  assert.equal(await page.locator("#order-count").textContent(), "3 items"); assert.equal(await page.locator("#order-total").textContent(), "$120.00");
  await page.locator('[data-quantity=vase][data-delta="-1"]').click(); assert.equal(await page.locator("#order-total").textContent(), "$72.00");
  const plus = page.locator('[data-quantity=cup][data-delta="1"]'); await plus.focus(); await page.keyboard.press("Enter"); assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  await plus.evaluate(e => { window.fixtureNode = e; }); await apply("commerce", "#EDE0CC"); await apply("analytics", "#1A2733"); assert.equal(await plus.evaluate(e => e === window.fixtureNode && e === document.activeElement), true);
  await page.locator("[data-example-reset=commerce]").click(); assert.equal(await page.locator("#order-total").textContent(), "$96.00", "example reset retains the order");
  await page.locator("[data-category=desk]").click(); assert.equal(await page.locator("[data-product]:visible").count(), 2);
  await page.locator("[data-add=notebook]").click(); assert.equal(await page.locator("#order-total").textContent(), "$114.00");
  await page.locator('[data-quantity=notebook][data-delta="-1"]').click(); assert.equal(await page.locator("[data-add=notebook]").evaluate(e => e === document.activeElement), true); assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  await page.locator('[data-quantity=cup][data-delta="-1"]').click(); await page.locator('[data-quantity=cup][data-delta="-1"]').click();
  assert.equal(await page.locator("[data-category=desk]").evaluate(e => e === document.activeElement), true, "final removal of filtered product returns focus to selected category");
  assert.equal(await page.locator("#order-total").textContent(), "$48.00");
  await page.locator("[data-category=home]").click(); await page.locator("[data-add=cup]").click(); await page.locator("[data-add=cup]").click();
  await page.locator("#checkout-demo").click(); assert.match(await page.locator("#order-review-status").textContent(), /no order was placed and no payment/); await page.locator("[data-category=all]").click();
  proof.interactions.push("Commerce: category, empty review, Add×2, quantity arithmetic/removal, exact total, final-removal focus, own/other palette/reset state retention, truthful review");

  const toc = page.locator('#reading-toc [data-reading-target="reading-signal"]'); await toc.focus(); await page.keyboard.press("Enter"); assert.equal(new URL(page.url()).hash, "#reading-signal"); assert.equal(await page.locator("#reading-signal").evaluate(e => e === document.activeElement), true); assert.equal(await toc.getAttribute("aria-current"), "true");
  await page.locator("#reading-list").click(); assert.equal(await page.locator("#reading-list").getAttribute("aria-pressed"), "true");
  await page.locator("#reading-list").focus(); await apply("reading", "#F4EBDD"); await apply("interface", "#243044"); assert.equal(await page.locator("#reading-list").evaluate(e => e === document.activeElement), true);
  await page.locator("[data-example-reset=reading]").click(); assert.equal(await page.locator("#reading-list").getAttribute("aria-pressed"), "true"); assert.equal(await toc.getAttribute("aria-current"), "true"); assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  await page.locator(".article-callout a").focus(); await page.keyboard.press("Enter"); assert.equal(new URL(page.url()).hash, "#reading-practice"); assert.equal(await page.locator("#reading-practice").evaluate(e => e === document.activeElement), true);
  proof.interactions.push("Reading: keyboard TOC/inline link hash + heading focus, semantic saved state, own/other palette and reset retention, no scene switching");
  await page.locator('[data-quantity=vase][data-delta="-1"]').click();
  await page.locator('[data-quantity=cup][data-delta="-1"]').click(); await page.locator('[data-quantity=cup][data-delta="-1"]').click();
  assert.equal(await page.locator("#order-count").textContent(), "0 items"); assert.equal(await page.locator("#order-total").textContent(), "$0.00"); assert.equal(await page.locator(".order-empty").isVisible(), true);
  await page.locator("#checkout-demo").click(); assert.match(await page.locator("#order-review-status").textContent(), /empty/);
  await page.locator("[data-add=vase]").click(); await page.locator("[data-add=cup]").click(); await page.locator("[data-add=cup]").click(); assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  proof.interactions.push("Commerce remove-to-empty and recover; filtered-product final-removal focus fallback");
  await axeCheck("all four live application interaction states"); await capture("interactions", true);

  const samples = {
    interface: [["[data-issue] strong", "text"], ["[data-issue] .issue-meta", "muted"], ["#workspace-filter", "text"], [".workspace-summary strong", "metricText"], [".workspace-summary .sample-muted", "metricMuted"], ["#workspace-detail-title", "panelText"], ["#workspace-detail-copy", "panelMuted"], ["[data-issue] .good", "goodText"], ["[data-issue] .warn", "warnText"]],
    commerce: [[".product-title h5", "text"], [".product-mark", "metricMuted"], [".product-add", "text"], ["[data-category][aria-pressed=true]", "text"], ["#order-title", "panelText"], ["#order-total", "panelText"], [".commerce-disclaimer", "panelMuted"], [".quantity-control button", "text"]],
    reading: [[".reading-article>p", "text"], [".article-meta", "muted"], [".article-callout p", "panelText"], [".article-callout a", "panelText"], ["#reading-list", "text"], ["#reading-toc a", "text"]],
    analytics: [[".analytics-heading h3", "text"], [".analytics-heading .sample-muted", "muted"], [".analytics-metrics strong", "metricText"], [".analytics-metrics .sample-muted", "metricMuted"]],
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
    await allVisible();
    if(test.label!=="surface12-others1") await axeCheck(`${test.label} all four independent examples`);
    else {
      const unexpected=await page.evaluate(async()=> (await window.axe.run(document)).violations.filter(v=>["serious","critical"].includes(v.impact)).flatMap(v=>v.nodes.filter(n=>v.id!=="color-contrast"||!n.target.every(s=>document.querySelector(s)?.closest(".live-preview"))).map(n=>({id:v.id,target:n.target}))));
      assert.deepEqual(unexpected,[],"intentional low-target color failures scoped to the experimental examples; shell/semantics not waived");
    }
    proof.colors.push(stateProof);
  }
  for(const key of names){await inspect(key);await page.locator("#reset").click();}
  await page.locator("#palette-lab").evaluate(e=>{e.open=false;}); await allVisible();
  if(screenshotDir) await writeFile(resolve(screenshotDir,"iteration3-scenarios-proof.json"),JSON.stringify(proof,null,2)+"\n");
  console.log("PASS Studio gallery: four permanent normal-flow examples; 5 responsive widths; independent palettes/options/drafts/exports; 3 application loops; 27 actual foreground/backdrop roles × 6 states (including curated defaults)");
}
