// Local illustrative application state. Initialized once, never rebuilt on palette edits.
// No network, persistence, account, order placement or payment integration.
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
function text(id, value) { $(`#${id}`).textContent = value; }
export function initializeScenes() {
  const issues = [
    { id: "NS-128", title: "Make the empty state useful", status: "doing", label: "In progress", owner: "Maya Chen", initials: "MC", priority: "High", text: "Turn an empty project into a clear first step. The next pass adds a concise explanation and one useful action.", next: "Review copy and the first-run checklist." },
    { id: "NS-124", title: "Bring search into the workspace", status: "review", label: "In review", owner: "Leo Park", initials: "LP", priority: "Medium", text: "Keep people in context while they find a task, teammate, or decision. The keyboard-first prototype is ready for review.", next: "Test the result grouping with the product team." },
    { id: "NS-119", title: "Resolve the handoff checklist", status: "blocked", label: "Blocked", owner: "Ari James", initials: "AJ", priority: "High", text: "The handoff is waiting on a final content decision. Keep the blocker visible rather than implying the work is complete.", next: "Confirm the release owner and acceptance notes." },
    { id: "NS-116", title: "Tidy the component inventory", status: "doing", label: "In progress", owner: "Noor Ali", initials: "NA", priority: "Low", text: "Audit the small inconsistencies before they become new patterns. Work through spacing, naming, and duplicated components.", next: "Publish the inventory for the next design review." },
  ];
  let selectedIssue = issues[0].id;
  let detailOpen = true;
  const issueButtons = new Map();
  for (const issue of issues) {
    const button = node("button", null, { type: "button", class: "issue-button", "data-issue": issue.id,
      "aria-pressed": String(issue.id === selectedIssue), "aria-controls": "workspace-detail-title" });
    const meta = node("span", `${issue.id} · ${issue.priority} priority`, { class: "sample-muted issue-meta" });
    const status = node("span", issue.label, { class: `sample-status ${issue.status === "blocked" ? "warn" : "good"}` });
    const bottom = node("span", null, { class: "issue-bottom" });
    bottom.append(status, node("span", issue.initials, { class: "issue-owner", "aria-label": issue.owner }));
    button.append(meta, node("strong", issue.title), bottom);
    issueButtons.set(issue.id, button); $("#workspace-issues").append(button);
  }
  const issueEmpty = node("p", "No completed issues in this fixture. Choose All issues to return to the queue.", { class: "sample-muted empty-issues", hidden: "" });
  $("#workspace-issues").append(issueEmpty);
  function showIssue() {
    const issue = issues.find((item) => item.id === selectedIssue);
    $(".workbench-detail").hidden = !detailOpen;
    text("workspace-detail-title", issue.title); text("workspace-detail-copy", issue.text);
    const status = node("span", issue.label, { class: `sample-status ${issue.status === "blocked" ? "warn" : "good"}` });
    $("#workspace-detail-meta").replaceChildren(status, node("p", `${issue.owner} · ${issue.priority} priority`, { class: "sample-muted" }), node("strong", "Next move"), node("p", issue.next, { class: "sample-muted" }));
    for (const [id, button] of issueButtons) button.setAttribute("aria-pressed", String(id === selectedIssue && detailOpen));
  }
  $("#workspace-issues").addEventListener("click", (event) => {
    const button = event.target.closest("[data-issue]"); if (!button) return;
    selectedIssue = button.dataset.issue; detailOpen = true; showIssue();
  });
  $("#workspace-filter").addEventListener("change", () => {
    const filter = $("#workspace-filter").value; let count = 0;
    for (const issue of issues) { const visible = filter === "all" || issue.status === filter; issueButtons.get(issue.id).hidden = !visible; if (visible) count++; }
    issueEmpty.hidden = count > 0; text("issue-count", `${count} ${count === 1 ? "issue" : "issues"} shown`);
    if (issueButtons.get(selectedIssue).hidden) { detailOpen = false; showIssue(); }
  });
  function closeIssue() {
    detailOpen = false; showIssue();
    const button = issueButtons.get(selectedIssue);
    if (!button.hidden) button.focus(); else $("#workspace-filter").focus();
  }
  $("#workspace-detail-action").addEventListener("click", closeIssue);
  $("#scene-interface").addEventListener("keydown", (event) => { if (event.key === "Escape" && detailOpen) { event.preventDefault(); closeIssue(); } });
  text("issue-count", "4 issues shown"); showIssue();

  const products = [
    { id: "vase", name: "Contour vase", category: "home", price: 4800, mark: "01", description: "Stoneware · chalk", shape: "vase" },
    { id: "lamp", name: "Arc desk lamp", category: "desk", price: 12800, mark: "02", description: "Powder coat · graphite", shape: "lamp" },
    { id: "notebook", name: "Field notebook", category: "desk", price: 1800, mark: "03", description: "Dot grid · 160 pages", shape: "book" },
    { id: "tote", name: "Weekender tote", category: "travel", price: 6400, mark: "04", description: "Heavy canvas · natural", shape: "tote" },
    { id: "cup", name: "Everyday cup", category: "home", price: 2400, mark: "05", description: "Stoneware · 300 ml", shape: "cup" },
    { id: "pouch", name: "Utility pouch", category: "travel", price: 3200, mark: "06", description: "Waxed cotton · small", shape: "pouch" },
  ];
  const order = new Map(products.map((item) => [item.id, 0]));
  const productNodes = new Map(); const orderNodes = new Map();
  const money = (cents) => `$${(cents / 100).toFixed(2)}`;
  for (const product of products) {
    const card = node("div", null, { class: "product-card", "data-product": product.id });
    const art = node("div", null, { class: `product-art art-${product.shape}`, "aria-hidden": "true" });
    art.append(node("span", product.mark, { class: "product-mark" }), node("i"));
    const title = node("div", null, { class: "product-title" }); title.append(node("h5", product.name), node("strong", money(product.price)));
    card.append(art, title, node("p", product.description, { class: "sample-muted" }), node("button", "+ Add to order", { type: "button", class: "product-add", "data-add": product.id, "aria-label": `+ Add to order: ${product.name}` }));
    $("#product-grid").append(card); productNodes.set(product.id, card);
    const row = node("div", null, { class: "order-line", "data-order-line": product.id, hidden: "" });
    const heading = node("div", null, { class: "order-line-heading" }); heading.append(node("strong", product.name), node("span", money(0), { "data-subtotal": product.id }));
    const quantity = node("div", null, { class: "quantity-control" });
    quantity.append(node("button", "−", { type: "button", "data-quantity": product.id, "data-delta": "-1", "aria-label": `Remove one ${product.name}` }), node("span", "0", { "data-count": product.id }), node("button", "+", { type: "button", "data-quantity": product.id, "data-delta": "1", "aria-label": `Add one ${product.name}` }));
    row.append(heading, quantity); orderNodes.set(product.id, row);
  }
  const orderEmpty = node("p", "Your order starts here. Add a product from the shelf.", { class: "sample-muted order-empty" });
  $("#order-lines").replaceChildren(orderEmpty, ...orderNodes.values());
  function updateOrder() {
    let quantity = 0; let total = 0;
    for (const product of products) {
      const count = order.get(product.id); quantity += count; total += count * product.price;
      const row = orderNodes.get(product.id); row.hidden = count === 0;
      row.querySelector("[data-count]").textContent = count;
      row.querySelector("[data-subtotal]").textContent = money(count * product.price);
      const add = productNodes.get(product.id).querySelector("[data-add]");
      add.textContent = count ? `＋ Add more · ${count} in order` : "+ Add to order";
      add.setAttribute("aria-label", `${add.textContent}: ${product.name}`);
    }
    orderEmpty.hidden = quantity > 0; text("order-count", `${quantity} ${quantity === 1 ? "item" : "items"}`); text("order-total", money(total));
    text("order-review-status", "Fixture only · no checkout or payment is connected.");
  }
  $("#product-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]"); if (!button) return;
    const id = button.dataset.add; order.set(id, order.get(id) + 1); updateOrder();
  });
  $("#order-lines").addEventListener("click", (event) => {
    const button = event.target.closest("[data-quantity]"); if (!button) return;
    const id = button.dataset.quantity; order.set(id, Math.max(0, order.get(id) + Number(button.dataset.delta))); updateOrder();
    if (order.get(id) === 0) {
      const add = productNodes.get(id).querySelector("button");
      if (!productNodes.get(id).hidden) add.focus(); else $("[data-category][aria-pressed=true]").focus();
    }
  });
  for (const button of $$("[data-category]")) button.addEventListener("click", () => {
    let count = 0;
    for (const item of $$("[data-category]")) item.setAttribute("aria-pressed", String(item === button));
    for (const product of products) { const visible = button.dataset.category === "all" || product.category === button.dataset.category; productNodes.get(product.id).hidden = !visible; if (visible) count++; }
    text("commerce-filter-label", `${count} products`);
  });
  $("#checkout-demo").addEventListener("click", () => text("order-review-status", [...order.values()].some(Boolean)
    ? `Local order reviewed: ${$("#order-count").textContent}, ${$("#order-total").textContent}. Fixture only; no order was placed and no payment is connected.`
    : "Your order is empty. Add a product to review this local fixture; no checkout is connected."));

  $("#reading-list").addEventListener("click", () => {
    const saved = $("#reading-list").getAttribute("aria-pressed") !== "true";
    $("#reading-list").setAttribute("aria-pressed", String(saved));
    $("#reading-list").textContent = saved ? "✓ In your reading list" : "＋ Save to reading list";
    text("reading-save-status", saved ? "Saved locally for this session" : "Not saved");
  });
  for (const link of $$("[data-reading-target]")) link.addEventListener("click", () => {
    const heading = $(`#${link.dataset.readingTarget}`); heading.focus({ preventScroll: true });
    for (const item of $$("#reading-toc a")) item.setAttribute("aria-current", String(item.dataset.readingTarget === link.dataset.readingTarget));
  });
}
