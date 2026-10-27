// Authored decorative object studies, initialized once. Palette edits only recolor them.
// No business controls, simulated orders, category state, or network requests.
function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  if (text != null) element.textContent = text;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}
export function initializeScenes() {
  const products = [
    { id: "vase", name: "Contour vase", price: "$48", mark: "01", description: "Stoneware · chalk", shape: "vase" },
    { id: "lamp", name: "Arc desk lamp", price: "$128", mark: "02", description: "Powder coat · graphite", shape: "lamp" },
    { id: "notebook", name: "Field notebook", price: "$18", mark: "03", description: "Dot grid · 160 pages", shape: "book" },
  ];
  for (const product of products) {
    const card = node("article", null, { class: "product-card", "data-product": product.id });
    const art = node("div", null, { class: `product-art art-${product.shape}`, "aria-hidden": "true" });
    art.append(node("span", product.mark, { class: "product-mark" }));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 120 120"); svg.setAttribute("aria-hidden", "true");
    // Authored vector object studies: decorative, local, and palette-aware.
    const objects = {
      vase: '<ellipse class="object-highlight" cx="61" cy="103" rx="26" ry="4"/><path class="object-body" d="M46 26Q60 21 74 26L71 42Q85 56 85 78Q83 101 62 103Q39 102 37 80Q36 57 49 42Z"/><ellipse class="object-highlight" cx="60" cy="26" rx="14" ry="4"/><path class="object-line" d="M47 58Q42 81 51 94M55 29V39"/>',
      lamp: '<ellipse class="object-body" cx="61" cy="102" rx="27" ry="5"/><path class="object-body" d="M58 46H64V100H58Z"/><path class="object-body" d="M28 49Q32 19 61 18Q90 20 94 49Z"/><ellipse class="object-highlight" cx="61" cy="49" rx="33" ry="5"/><path class="object-line" d="M37 41Q42 27 56 25M56 101H67"/>',
      book: '<g transform="rotate(-9 60 61)"><path class="object-body" d="M29 20H83L91 27V102H36L29 95Z"/><path class="object-highlight" d="M36 27H91V102H36Z"/><path class="object-line" d="M36 27L29 20M83 20V27M42 33V95M52 43H77M52 49H69M38 97H87"/></g>',
    };
    svg.innerHTML = objects[product.shape]; art.append(svg);
    const title = node("div", null, { class: "product-title" });
    title.append(node("h4", product.name), node("strong", product.price));
    card.append(art, title, node("p", product.description, { class: "sample-muted" }));
    document.querySelector("#product-grid").append(card);
  }
}
