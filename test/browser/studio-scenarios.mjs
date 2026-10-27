// Bounded multi-context acceptance on the actual Studio, used by studio-smoke.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

export async function verifyScenarios({ page, base, screenshotDir, axeCheck, renderedRatio }) {
  const proof = { folds: [], interactions: [], colors: [] };
  const selectScene = async (name) => { await page.locator(`[data-scene=${name}]`).click(); };
  const applyBackgroundWithoutMovingFocus = async (color) => page.locator("#background-picker").evaluate((element, value) => {
    element.value = value; element.dispatchEvent(new Event("input", { bubbles: true }));
  }, color);
  async function capture(name, fullPage = false) {
    if (screenshotDir) await page.screenshot({ path: resolve(screenshotDir, `iteration2-${name}.png`), fullPage });
  }
  // Fresh load, exact reference heights, no See-result anchor or automatic scroll.
  for (const [width, height] of [[1440, 900], [320, 740], [375, 812]]) {
    await page.setViewportSize({ width, height }); await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForURL(`${base}examples/studio/`); await page.locator("[data-issue]").first().waitFor();
    const fold = await page.evaluate(() => {
      const box = (selector) => { const b = document.querySelector(selector).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, width: b.width, height: b.height }; };
      return { width: innerWidth, height: innerHeight, scroll: scrollY, title: box("#scene-interface h3"), task: box("[data-issue]"), action: box("#workspace-filter"), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.equal(fold.scroll, 0); assert.equal(fold.overflow, false);
    for (const key of ["title", "task", "action"]) assert.ok(fold[key].top >= 0 && fold[key].bottom <= height, `${width}×${height}: actual default ${key} fully in initial fold, ${JSON.stringify(fold)}`);
    proof.folds.push(fold); await capture(`firstscreen-${width}x${height}`);
    for (const scene of ["commerce", "reading"]) {
      await selectScene(scene);
      if (width <= 375) assert.ok(await page.locator(`#scene-${scene} h3`).evaluate((e) => e.getBoundingClientRect().top >= 0 && e.getBoundingClientRect().bottom < innerHeight), "mobile chooser reveals real changed scenario");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      if (width <= 375) { await capture(`${scene}-mobile-${width}`); await axeCheck(`${width}px ${scene} default controls`); }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base, { waitUntil: "networkidle" });
  await page.locator("[data-issue]").first().waitFor();
  await page.locator("#workspace-filter").selectOption("review");
  assert.equal(await page.locator("[data-issue]:visible").count(), 1); assert.equal(await page.locator("#issue-count").textContent(), "1 issue shown");
  const task = page.locator('[data-issue="NS-124"]'); await task.focus(); await page.keyboard.press("Enter");
  assert.equal(await page.locator("#workspace-detail-title").textContent(), "Bring search into the workspace");
  await task.evaluate((e) => { window.sceneFocus = e; }); await applyBackgroundWithoutMovingFocus("#2B3548");
  assert.equal(await task.evaluate((e) => e === window.sceneFocus && e === document.activeElement), true);
  assert.equal(await page.locator("#workspace-filter").inputValue(), "review"); assert.equal(await task.getAttribute("aria-pressed"), "true");
  await page.locator("#workspace-detail-action").focus(); await page.keyboard.press("Enter");
  assert.equal(await task.evaluate((e) => e === document.activeElement), true); assert.equal(await page.locator(".workbench-detail").isVisible(), false);
  await page.keyboard.press("Enter"); await page.keyboard.press("Escape"); assert.equal(await task.evaluate((e) => e === document.activeElement), true);
  await page.locator("#workspace-filter").selectOption("done"); assert.equal(await page.locator("[data-issue]:visible").count(), 0); assert.equal(await page.locator(".empty-issues").isVisible(), true);
  await page.locator("#workspace-filter").selectOption("all"); await page.locator('[data-issue="NS-119"]').click();
  await axeCheck("project filtered / selected blocked task"); await capture("project-selected-desktop");
  proof.interactions.push("Project: filter/count, exact selected details, empty state, palette node/focus identity, Enter/close/Escape focus return");

  await selectScene("commerce"); await page.locator("#checkout-demo").click(); assert.match(await page.locator("#order-review-status").textContent(), /empty/);
  await page.locator("[data-category=home]").click(); assert.equal(await page.locator("[data-product]:visible").count(), 2);
  await page.locator("[data-add=vase]").click(); await page.locator("[data-add=vase]").click(); await page.locator("[data-add=cup]").click();
  assert.equal(await page.locator("#order-count").textContent(), "3 items"); assert.equal(await page.locator("#order-total").textContent(), "$120.00");
  await page.locator('[data-quantity=vase][data-delta="-1"]').click(); assert.equal(await page.locator("#order-total").textContent(), "$72.00");
  const plus = page.locator('[data-quantity=cup][data-delta="1"]'); await plus.focus(); await page.keyboard.press("Enter");
  assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  await plus.evaluate((e) => { window.sceneFocus = e; }); await applyBackgroundWithoutMovingFocus("#777777");
  assert.equal(await plus.evaluate((e) => e === window.sceneFocus && e === document.activeElement), true);
  await page.locator("#reset").click(); assert.equal(await page.locator("#order-total").textContent(), "$96.00", "Reset palette does not silently empty the order");
  await page.locator("[data-category=desk]").click(); assert.equal(await page.locator("[data-product]:visible").count(), 2);
  await page.locator("[data-add=notebook]").click(); assert.equal(await page.locator("#order-total").textContent(), "$114.00");
  await page.locator('[data-quantity=notebook][data-delta="-1"]').click();
  assert.equal(await page.locator("[data-add=notebook]").evaluate((e) => e === document.activeElement), true, "removing final quantity returns focus to visible add control");
  assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  await page.locator("#checkout-demo").click(); assert.match(await page.locator("#order-review-status").textContent(), /no order was placed and no payment/);
  await page.locator("[data-category=all]").click(); await axeCheck("commerce selected category / quantities / order review"); await capture("commerce-selected-desktop");
  proof.interactions.push("Commerce: category, empty review, Add×2, quantity arithmetic/removal, total, focus on final removal, palette/reset/revisit persistence, truthful local review");

  await selectScene("reading"); const toc = page.locator('#reading-toc [data-reading-target="reading-signal"]');
  await toc.focus(); await page.keyboard.press("Enter"); assert.equal(new URL(page.url()).hash, "#reading-signal");
  assert.equal(await page.locator("#reading-signal").evaluate((e) => e === document.activeElement), true);
  assert.equal(await toc.getAttribute("aria-current"), "true");
  await page.locator("#reading-list").click(); assert.equal(await page.locator("#reading-list").getAttribute("aria-pressed"), "true");
  await page.locator("#reading-list").focus(); await applyBackgroundWithoutMovingFocus("#F5F1E9");
  assert.equal(await page.locator("#reading-list").evaluate((e) => e === document.activeElement), true);
  await selectScene("commerce"); assert.equal(await page.locator("#order-total").textContent(), "$96.00");
  await selectScene("reading"); assert.equal(await page.locator("#reading-list").getAttribute("aria-pressed"), "true");
  assert.equal(await toc.getAttribute("aria-current"), "true");
  await page.locator(".article-callout a").focus(); await page.keyboard.press("Enter"); assert.equal(new URL(page.url()).hash, "#reading-practice");
  assert.equal(await page.locator("#reading-practice").evaluate((e) => e === document.activeElement), true);
  await page.locator("#preview-frame").scrollIntoViewIfNeeded(); await axeCheck("reading saved / real chapters / inline link"); await capture("reading-selected-desktop");
  proof.interactions.push("Reading: keyboard TOC/inline link hash + actual heading focus, semantic saved state, palette focus and cross-scene state retention");

  // Independent actual computed ancestor-compositing checks for new domains. Every
  // sample compares its actual foreground/backdrop to the corresponding engine pair.
  const samples = [
    ["[data-issue] strong", "text"], ["[data-issue] .issue-meta", "muted"], ["#workspace-filter", "text"],
    [".workspace-summary strong", "metricText"], [".workspace-summary .sample-muted", "metricMuted"],
    ["#workspace-detail-title", "panelText"], ["#workspace-detail-copy", "panelMuted"],
    ["[data-issue] .good", "goodText"], ["[data-issue] .warn", "warnText"],
    [".product-title h5", "text"], [".product-mark", "metricMuted"], [".product-add", "text"],
    ["[data-category][aria-pressed=true]", "text"], ["#order-title", "panelText"], ["#order-total", "panelText"],
    [".commerce-disclaimer", "panelMuted"], [".quantity-control button", "text"],
    [".reading-article>p", "text"], [".article-meta", "muted"], [".article-callout p", "panelText"],
    [".article-callout a", "panelText"], ["#reading-list", "text"], ["#reading-toc a", "text"],
  ];
  for (const test of [
    { label: "default", bg: "#777777", strategy: "auto", targets: [8, 4.7, 3.3, 4.5] },
    { label: "preserve-unresolved", bg: "#777777", strategy: "preserve", targets: [8, 4.7, 3.3, 4.5] },
    { label: "surface12-others1", bg: "#2B3548", strategy: "auto", targets: [1, 1, 1, 12] },
    { label: "accent-only21", bg: "#2B3548", strategy: "auto", targets: [8, 4.7, 21, 4.5] },
    { label: "all21", bg: "#777777", strategy: "auto", targets: [21, 21, 21, 21] },
  ]) {
    await page.locator("#advanced-controls").evaluate((e) => { e.open = true; }); await page.locator("#target-controls").evaluate((e) => { e.open = true; });
    await page.locator(`[name=strategy][value=${test.strategy}]`).check();
    await applyBackgroundWithoutMovingFocus(test.bg);
    for (const [index, id] of ["textContrast", "mutedContrast", "accentContrast", "surfaceTextContrast"].entries()) await page.locator(`#${id}`).fill(String(test.targets[index]));
    await page.locator("[data-panel=export]").click(); await page.locator("[data-format=json]").click();
    const output = JSON.parse(await page.locator("#export-output").textContent());
    const actual = await page.evaluate((selectors) => {
      const channels = (css) => css.match(/[\d.]+/g).map(Number);
      return selectors.map(([selector, metric]) => {
        const e = document.querySelector(selector); const fg = channels(getComputedStyle(e).color); const layers = [];
        for (let n = e; n; n = n.parentElement) { const css = getComputedStyle(n); const bg = channels(css.backgroundColor); if ((bg[3] ?? 1) > 0) layers.push(bg); if ((bg[3] ?? 1) === 1) break; }
        let bg = [255, 255, 255]; for (const layer of layers.reverse()) bg = layer.slice(0, 3).map((v, i) => Math.round(v * (layer[3] ?? 1) + bg[i] * (1 - (layer[3] ?? 1))));
        return { selector, metric, fg, bg, translucentLayers: layers.filter((v) => (v[3] ?? 1) < 1).length, opacity: getComputedStyle(e).opacity };
      });
    }, samples);
    for (const sample of actual) {
      assert.equal(sample.opacity, "1"); assert.ok(sample.translucentLayers <= 1, `${test.label}: no nested translucent measured tokens at ${sample.selector}`);
      const ratio = renderedRatio(sample.fg, sample.bg); assert.ok(Math.abs(ratio - output.palette.metrics[`${sample.metric}Contrast`]) < 1e-10, `${test.label} ${sample.selector} actual ${ratio} agrees with ${sample.metric}: ${output.palette.metrics[`${sample.metric}Contrast`]}`);
      sample.ratio = ratio;
    }
    assert.equal(await page.locator("#experimental-warning").isVisible(), test.label === "surface12-others1");
    if (test.label === "preserve-unresolved") { assert.equal(output.palette.usable, false); assert.match(await page.locator("#result-status").textContent(), /Targets unresolved/); }
    // Deliberately low-target failures are scoped to the experimental preview; shell
    // and semantics remain checked, not blanket waived.
    for (const name of ["interface", "commerce", "reading"]) {
      await selectScene(name);
      if (test.label !== "surface12-others1") await axeCheck(`${test.label} ${name} new scene states`);
    }
    if (test.label === "surface12-others1") {
      await page.addScriptTag({ content: (await import("axe-core")).default.source });
      const unexpected = await page.evaluate(async () => (await window.axe.run(document)).violations.filter((v) => ["serious", "critical"].includes(v.impact)).flatMap((v) => v.nodes.filter((n) => v.id !== "color-contrast" || !n.target.every((s) => document.querySelector(s)?.closest("#live-preview"))).map((n) => ({ id: v.id, target: n.target }))));
      assert.deepEqual(unexpected, [], "intentional low-target preview text only; shell/control semantics not waived");
    }
    proof.colors.push({ label: test.label, background: output.palette.background, usable: output.palette.usable, samples: actual });
  }
  await page.locator("#reset").click(); await page.locator("#advanced-controls").evaluate((e) => { e.open = false; });
  await page.locator("[data-panel=tokens]").click(); await selectScene("interface");
  if (screenshotDir) await writeFile(resolve(screenshotDir, "iteration2-scenarios-proof.json"), JSON.stringify(proof, null, 2) + "\n");
  console.log(`PASS Studio domains: exact desktop/mobile first folds; Project/Commerce/Reading complete keyboard loops; retained local state/focus; ${samples.length} actual foreground/backdrop pairs × ${proof.colors.length} independent target states`);
}
