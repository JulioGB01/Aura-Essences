(() => {
  "use strict";

  const config = window.AURA_CONFIG || {};
  const CART_KEY = "aura-essences-cart-v1";
  const CATALOG_KEY = "aura-essences-catalog-v2";
  const NO_PHOTO = "assets/sin-foto.svg";
  const cachedProducts = loadCachedCatalog();

  const state = {
    products: cachedProducts.map(normalizeProduct).filter(Boolean),
    loading: cachedProducts.length === 0,
    cart: loadCart(),
    filters: { search: "", gender: "all", format: "all", sort: "featured" },
    activeProductId: null,
    activeVariantId: null,
    modalQuantity: 1,
    lastFocus: null,
    toastTimer: null,
  };

  const elements = {
    productGrid: document.querySelector("#product-grid"),
    resultsCount: document.querySelector("#results-count"),
    emptyState: document.querySelector("#empty-state"),
    clearFilters: document.querySelector("#clear-filters"),
    searchInput: document.querySelector("#search-input"),
    sortSelect: document.querySelector("#sort-select"),
    genderFilters: document.querySelector("#gender-filters"),
    formatFilters: document.querySelector("#format-filters"),
    cartDrawer: document.querySelector("#cart-drawer"),
    cartContent: document.querySelector("#cart-content"),
    cartTotal: document.querySelector("#cart-total"),
    checkout: document.querySelector("#whatsapp-checkout"),
    overlay: document.querySelector("[data-overlay]"),
    productModal: document.querySelector("#product-modal"),
    productModalContent: document.querySelector("#product-modal-content"),
    appointmentModal: document.querySelector("#appointment-modal"),
    appointmentForm: document.querySelector("#appointment-form"),
    appointmentDate: document.querySelector("#appointment-date"),
    calendarBooking: document.querySelector("#calendar-booking"),
    calendarPreview: document.querySelector("#calendar-preview"),
    calendarFrame: document.querySelector("#calendar-frame"),
    footerWhatsapp: document.querySelector("#footer-whatsapp"),
    footerLocation: document.querySelector("#footer-location"),
    toast: document.querySelector("#toast"),
  };

  function normalizeProduct(product, index = 0) {
    if (!product || !product.id || !product.name) return null;
    const variants = Array.isArray(product.variants)
      ? product.variants.map(normalizeVariant).filter(Boolean)
      : [];

    return {
      id: String(product.id),
      name: String(product.name),
      brand: String(product.brand || "Aura Essences"),
      gender: ["mujer", "hombre", "unisex"].includes(product.gender)
        ? product.gender
        : "unisex",
      family: String(product.family || "Perfumería selecta"),
      notes: Array.isArray(product.notes)
        ? product.notes.map(String)
        : String(product.notes || "")
            .split(",")
            .map((note) => note.trim())
            .filter(Boolean),
      description: String(product.description || "Consulta sus detalles y disponibilidad."),
      image: String(product.image || "") || NO_PHOTO,
      featured: Number(product.featured) || index + 1,
      variants,
    };
  }

  function normalizeVariant(variant) {
    if (!variant || !variant.id || !variant.label) return null;
    const type = ["decant", "entero", "parcial"].includes(variant.type)
      ? variant.type
      : "entero";
    return {
      id: String(variant.id),
      type,
      label: String(variant.label),
      detail: String(variant.detail || ""),
      price: Math.max(0, Number(variant.price) || 0),
      stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
    };
  }

  function loadCachedCatalog() {
    try {
      const stored = JSON.parse(localStorage.getItem(CATALOG_KEY));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function inStock(product) {
    return product.variants.some((variant) => variant.stock > 0);
  }

  function loadCart() {
    try {
      const stored = JSON.parse(localStorage.getItem(CART_KEY));
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((item) => item && item.productId && item.variantId)
        .map((item) => ({
          productId: String(item.productId),
          variantId: String(item.variantId),
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        }));
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function formatMoney(value) {
    const amount = new Intl.NumberFormat(config.locale || "es-BO", {
      maximumFractionDigits: 0,
    }).format(value);
    return `${config.currency || "Bs."} ${amount}`;
  }

  function availableVariants(product) {
    return product.variants.filter((variant) => variant.stock > 0);
  }

  function minimumPrice(product) {
    const prices = availableVariants(product).map((variant) => variant.price);
    return prices.length ? Math.min(...prices) : 0;
  }

  function genderLabel(gender) {
    return { mujer: "Mujer", hombre: "Hombre", unisex: "Unisex" }[gender] || "Unisex";
  }

  function getFilteredProducts() {
    const query = normalizeText(state.filters.search);
    const filtered = state.products.filter((product) => {
      const haystack = normalizeText(
        [product.name, product.brand, product.family, product.notes.join(" ")].join(" "),
      );
      const matchesSearch = !query || haystack.includes(query);
      const matchesGender = state.filters.gender === "all" || product.gender === state.filters.gender;
      const matchesFormat =
        state.filters.format === "all" ||
        product.variants.some(
          (variant) => variant.type === state.filters.format && variant.stock > 0,
        );
      return matchesSearch && matchesGender && matchesFormat;
    });

    return filtered.sort((a, b) => {
      const stockOrder = Number(inStock(b)) - Number(inStock(a));
      if (stockOrder) return stockOrder;
      if (state.filters.sort === "price-asc") return minimumPrice(a) - minimumPrice(b);
      if (state.filters.sort === "price-desc") return minimumPrice(b) - minimumPrice(a);
      if (state.filters.sort === "name") return a.name.localeCompare(b.name, "es");
      return a.featured - b.featured;
    });
  }

  function renderProducts() {
    if (state.loading) {
      elements.resultsCount.textContent = "…";
      elements.emptyState.hidden = true;
      elements.productGrid.hidden = false;
      elements.productGrid.innerHTML = '<p class="catalog-loading">Cargando catálogo…</p>';
      return;
    }
    const products = getFilteredProducts();
    elements.resultsCount.textContent = products.length;
    elements.emptyState.hidden = products.length > 0;
    elements.productGrid.hidden = products.length === 0;
    elements.clearFilters.hidden = !hasActiveFilters();
    elements.productGrid.innerHTML = products.map(productCardTemplate).join("");
  }

  function productCardTemplate(product) {
    const variants = availableVariants(product);
    const types = new Set(variants.map((variant) => variant.type));
    const hasPartial = types.has("parcial");
    const lowStock = variants.some((variant) => variant.stock === 1);
    const formats = types.size === 1 ? "1 formato" : `${types.size} formatos`;
    const soldOut = variants.length === 0;
    const badges = [
      soldOut
        ? '<span class="badge badge-soldout">Agotado</span>'
        : `<span class="badge">${escapeHtml(genderLabel(product.gender))} · ${formats}</span>`,
      hasPartial ? '<span class="badge badge-special">Parcial disponible</span>' : "",
      lowStock && !hasPartial ? '<span class="badge badge-special">Últimas unidades</span>' : "",
    ].join("");

    return `
      <article class="product-card${soldOut ? " is-sold-out" : ""}">
        <button class="product-card-image" type="button" data-product-id="${escapeHtml(product.id)}" aria-label="Ver opciones de ${escapeHtml(product.name)}">
          <div class="card-badges">${badges}</div>
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="600" height="648" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${NO_PHOTO}'" />
        </button>
        <div class="product-card-info">
          <p class="product-brand">${escapeHtml(product.brand)}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <p class="product-notes">${escapeHtml(product.notes.join(" · "))}</p>
          <div class="product-card-footer">
            <div class="product-price">
              <span>${variants.length ? "Desde" : "Sin stock por ahora"}</span>
              <strong>${variants.length ? formatMoney(minimumPrice(product)) : "Consultar"}</strong>
            </div>
            <button class="card-action" type="button" data-product-id="${escapeHtml(product.id)}">
              Ver opciones
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </article>`;
  }

  function hasActiveFilters() {
    return Boolean(
      state.filters.search ||
        state.filters.gender !== "all" ||
        state.filters.format !== "all" ||
        state.filters.sort !== "featured",
    );
  }

  function resetFilters() {
    state.filters = { search: "", gender: "all", format: "all", sort: "featured" };
    elements.searchInput.value = "";
    elements.sortSelect.value = "featured";
    setActiveChip(elements.genderFilters, "all");
    setActiveChip(elements.formatFilters, "all");
    renderProducts();
  }

  function setActiveChip(container, value) {
    container.querySelectorAll("[data-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === value);
    });
  }

  function openProduct(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const firstAvailable = product.variants.find((variant) => variant.stock > 0);
    state.activeProductId = product.id;
    state.activeVariantId = firstAvailable?.id || null;
    state.modalQuantity = 1;
    state.lastFocus = document.activeElement;
    renderProductModal();
    elements.productModal.hidden = false;
    document.body.classList.add("is-locked");
    elements.productModal.querySelector("[data-close-product]").focus();
  }

  function renderProductModal() {
    const product = state.products.find((item) => item.id === state.activeProductId);
    if (!product) return;
    const selected = product.variants.find((variant) => variant.id === state.activeVariantId);
    const inStock = selected?.stock > 0;
    const stockText = selected
      ? selected.stock === 1
        ? "Última unidad disponible"
        : `${selected.stock} unidades disponibles`
      : "Producto agotado temporalmente";

    elements.productModalContent.innerHTML = `
      <div class="product-modal-layout">
        <div class="product-modal-image">
          <span class="badge">${escapeHtml(genderLabel(product.gender))}</span>
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="600" height="648" onerror="this.onerror=null;this.src='${NO_PHOTO}'" />
        </div>
        <div class="product-modal-details">
          <p class="product-brand">${escapeHtml(product.brand)}</p>
          <h2 id="product-modal-title">${escapeHtml(product.name)}</h2>
          <p class="modal-family">${escapeHtml(product.family)}</p>
          <p class="modal-description">${escapeHtml(product.description)}</p>
          <div class="note-list">${product.notes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}</div>
          <fieldset class="variant-fieldset">
            <legend>Elige tu formato <span>Precios referenciales</span></legend>
            <div class="variant-options">
              ${product.variants.map((variant) => variantTemplate(variant)).join("")}
            </div>
          </fieldset>
          <div class="modal-add-row">
            <div class="quantity-control" aria-label="Cantidad">
              <button type="button" data-modal-qty="-1" aria-label="Restar una unidad">−</button>
              <span id="modal-quantity">${state.modalQuantity}</span>
              <button type="button" data-modal-qty="1" aria-label="Sumar una unidad">+</button>
            </div>
            <button class="button button-primary" type="button" data-modal-add ${inStock ? "" : "disabled"}>
              Agregar · ${selected ? formatMoney(selected.price * state.modalQuantity) : "Agotado"}
            </button>
          </div>
          <p class="stock-message">${escapeHtml(stockText)}</p>
        </div>
      </div>`;
  }

  function variantTemplate(variant) {
    const isSelected = variant.id === state.activeVariantId;
    const soldOut = variant.stock < 1;
    return `
      <label class="variant-option ${isSelected ? "is-selected" : ""} ${soldOut ? "is-sold-out" : ""}">
        <input type="radio" name="variant" value="${escapeHtml(variant.id)}" ${isSelected ? "checked" : ""} ${soldOut ? "disabled" : ""} />
        <span>
          <strong>${escapeHtml(variant.label)}</strong>
          <small>${soldOut ? "Agotado" : escapeHtml(variant.detail)}</small>
        </span>
        <span class="variant-price">${formatMoney(variant.price)}</span>
      </label>`;
  }

  function closeProduct() {
    elements.productModal.hidden = true;
    state.activeProductId = null;
    state.activeVariantId = null;
    syncBodyLock();
    restoreFocus();
  }

  function addActiveProductToCart() {
    const product = state.products.find((item) => item.id === state.activeProductId);
    const variant = product?.variants.find((item) => item.id === state.activeVariantId);
    if (!product || !variant || variant.stock < 1) return;
    addToCart(product.id, variant.id, state.modalQuantity);
    closeProduct();
    openCart();
  }

  function addToCart(productId, variantId, quantity) {
    const product = state.products.find((item) => item.id === productId);
    const variant = product?.variants.find((item) => item.id === variantId);
    if (!variant || variant.stock < 1) return;
    const existing = state.cart.find(
      (item) => item.productId === productId && item.variantId === variantId,
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, variant.stock);
    } else {
      state.cart.push({ productId, variantId, quantity: Math.min(quantity, variant.stock) });
    }
    saveCart();
    renderCart();
    showToast(`${product.name} se agregó a tu carrito.`);
  }

  function getCartDetails() {
    const valid = [];
    state.cart.forEach((item) => {
      const product = state.products.find((entry) => entry.id === item.productId);
      const variant = product?.variants.find((entry) => entry.id === item.variantId);
      if (!product || !variant || variant.stock < 1) return;
      const quantity = Math.min(item.quantity, variant.stock);
      valid.push({ ...item, quantity, product, variant, subtotal: quantity * variant.price });
    });
    if (valid.length !== state.cart.length) {
      state.cart = valid.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }));
      saveCart();
    }
    return valid;
  }

  function renderCart() {
    const details = getCartDetails();
    const count = details.reduce((sum, item) => sum + item.quantity, 0);
    const total = details.reduce((sum, item) => sum + item.subtotal, 0);
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = count;
    });
    document.querySelectorAll("[data-cart-count-label]").forEach((node) => {
      node.textContent = `(${count})`;
    });
    elements.cartTotal.textContent = formatMoney(total);

    if (!details.length) {
      elements.cartContent.innerHTML = `
        <div class="cart-empty">
          <div>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2" /></svg>
            <h3>Tu selección está vacía</h3>
            <p>Explora el catálogo y elige el formato que quieres consultar.</p>
            <button class="button button-secondary" type="button" data-cart-shop>Ver perfumes</button>
          </div>
        </div>`;
      elements.checkout.classList.add("is-disabled");
      elements.checkout.setAttribute("aria-disabled", "true");
      elements.checkout.href = "#";
      return;
    }

    elements.cartContent.innerHTML = details.map(cartItemTemplate).join("");
    elements.checkout.classList.remove("is-disabled");
    elements.checkout.removeAttribute("aria-disabled");
    elements.checkout.href = buildOrderWhatsappUrl(details, total);
  }

  function cartItemTemplate(item) {
    return `
      <article class="cart-item">
        <img class="cart-item-image" src="${escapeHtml(item.product.image)}" alt="" />
        <div>
          <div class="cart-item-top">
            <div>
              <h3>${escapeHtml(item.product.name)}</h3>
              <p class="cart-item-variant">${escapeHtml(item.variant.label)}</p>
            </div>
            <button class="remove-item" type="button" data-remove-item="${escapeHtml(item.productId)}|${escapeHtml(item.variantId)}" aria-label="Quitar ${escapeHtml(item.product.name)}">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7" /></svg>
            </button>
          </div>
          <div class="cart-item-bottom">
            <div class="quantity-control" aria-label="Cantidad de ${escapeHtml(item.product.name)}">
              <button type="button" data-cart-qty="${escapeHtml(item.productId)}|${escapeHtml(item.variantId)}|-1" aria-label="Restar una unidad">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-qty="${escapeHtml(item.productId)}|${escapeHtml(item.variantId)}|1" aria-label="Sumar una unidad">+</button>
            </div>
            <strong class="cart-item-price">${formatMoney(item.subtotal)}</strong>
          </div>
        </div>
      </article>`;
  }

  function updateCartQuantity(productId, variantId, change) {
    const item = state.cart.find(
      (entry) => entry.productId === productId && entry.variantId === variantId,
    );
    const product = state.products.find((entry) => entry.id === productId);
    const variant = product?.variants.find((entry) => entry.id === variantId);
    if (!item || !variant) return;
    const next = item.quantity + change;
    if (next < 1) {
      removeCartItem(productId, variantId);
      return;
    }
    if (next > variant.stock) {
      showToast(`Hay ${variant.stock} unidades disponibles en esta presentación.`);
      return;
    }
    item.quantity = next;
    saveCart();
    renderCart();
  }

  function removeCartItem(productId, variantId) {
    state.cart = state.cart.filter(
      (item) => !(item.productId === productId && item.variantId === variantId),
    );
    saveCart();
    renderCart();
  }

  function buildOrderWhatsappUrl(details, total) {
    const lines = details.map(
      (item) => `• ${item.quantity} × ${item.product.name} — ${item.variant.label} — ${formatMoney(item.subtotal)}`,
    );
    const message = [
      "Hola, Aura Essences 👋",
      "",
      "Quiero consultar disponibilidad de este pedido:",
      ...lines,
      "",
      `Total referencial: ${formatMoney(total)}`,
      "",
      "¿Me confirman stock y opciones de entrega, por favor?",
    ].join("\n");
    return whatsappUrl(message);
  }

  function whatsappUrl(message) {
    const number = String(config.whatsappNumber || "59175070523").replace(/\D/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }

  function openCart() {
    if (!elements.productModal.hidden) closeProduct();
    if (!elements.appointmentModal.hidden) closeAppointment();
    state.lastFocus = document.activeElement;
    elements.overlay.hidden = false;
    elements.cartDrawer.classList.add("is-open");
    elements.cartDrawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    requestAnimationFrame(() => elements.overlay.classList.add("is-visible"));
    elements.cartDrawer.querySelector("[data-close-cart]").focus();
  }

  function closeCart({ restore = true } = {}) {
    elements.overlay.classList.remove("is-visible");
    elements.cartDrawer.classList.remove("is-open");
    elements.cartDrawer.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (!elements.cartDrawer.classList.contains("is-open")) elements.overlay.hidden = true;
    }, 230);
    syncBodyLock();
    if (restore) restoreFocus();
  }

  function openAppointment() {
    if (!elements.productModal.hidden) closeProduct();
    if (elements.cartDrawer.classList.contains("is-open")) closeCart({ restore: false });
    state.lastFocus = document.activeElement;
    elements.appointmentModal.hidden = false;
    document.body.classList.add("is-locked");
    elements.appointmentModal.querySelector("[data-close-appointment]").focus();
  }

  function closeAppointment() {
    elements.appointmentModal.hidden = true;
    syncBodyLock();
    restoreFocus();
  }

  function syncBodyLock() {
    const shouldLock =
      !elements.productModal.hidden ||
      !elements.appointmentModal.hidden ||
      elements.cartDrawer.classList.contains("is-open");
    document.body.classList.toggle("is-locked", shouldLock);
  }

  function restoreFocus() {
    if (state.lastFocus instanceof HTMLElement) state.lastFocus.focus();
    state.lastFocus = null;
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 3200);
  }

  function setFormatAndScroll(format) {
    state.filters.format = format;
    setActiveChip(elements.formatFilters, format);
    renderProducts();
    document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setupAppointment() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    elements.appointmentDate.min = minDate;

    if (config.calendarEmbedUrl) {
      elements.calendarFrame.src = config.calendarEmbedUrl;
      elements.calendarPreview.hidden = false;
    }

    if (config.bookingUrl) {
      elements.calendarBooking.href = config.bookingUrl;
      elements.calendarBooking.hidden = false;
    }

    elements.appointmentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!elements.appointmentForm.reportValidity()) return;
      const formData = new FormData(elements.appointmentForm);
      const rawDate = String(formData.get("date"));
      const date = new Date(`${rawDate}T12:00:00`);
      const prettyDate = new Intl.DateTimeFormat(config.locale || "es-BO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(date);
      const notes = String(formData.get("notes") || "").trim();
      const message = [
        "Hola, Aura Essences 👋",
        "",
        "Quisiera solicitar una cata de perfumes:",
        `• Nombre: ${formData.get("name")}`,
        `• Fecha preferida: ${prettyDate}`,
        `• Hora preferida: ${formData.get("time")}`,
        notes ? `• Me gustaría probar: ${notes}` : "",
        "",
        "¿Tienen disponibilidad en ese horario?",
      ]
        .filter(Boolean)
        .join("\n");
      window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
    });
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", (event) => {
      state.filters.search = event.target.value;
      renderProducts();
    });

    elements.sortSelect.addEventListener("change", (event) => {
      state.filters.sort = event.target.value;
      renderProducts();
    });

    elements.genderFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.filters.gender = button.dataset.filter;
      setActiveChip(elements.genderFilters, state.filters.gender);
      renderProducts();
    });

    elements.formatFilters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.filters.format = button.dataset.filter;
      setActiveChip(elements.formatFilters, state.filters.format);
      renderProducts();
    });

    elements.productGrid.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-product-id]");
      if (trigger) openProduct(trigger.dataset.productId);
    });

    elements.productModalContent.addEventListener("change", (event) => {
      if (event.target.name !== "variant") return;
      state.activeVariantId = event.target.value;
      state.modalQuantity = 1;
      renderProductModal();
    });

    elements.productModalContent.addEventListener("click", (event) => {
      const quantityButton = event.target.closest("[data-modal-qty]");
      if (quantityButton) {
        const product = state.products.find((item) => item.id === state.activeProductId);
        const variant = product?.variants.find((item) => item.id === state.activeVariantId);
        if (!variant) return;
        const next = state.modalQuantity + Number(quantityButton.dataset.modalQty);
        state.modalQuantity = Math.max(1, Math.min(next, variant.stock));
        renderProductModal();
        return;
      }
      if (event.target.closest("[data-modal-add]")) addActiveProductToCart();
    });

    elements.cartContent.addEventListener("click", (event) => {
      const shopButton = event.target.closest("[data-cart-shop]");
      if (shopButton) {
        closeCart();
        document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
        return;
      }
      const removeButton = event.target.closest("[data-remove-item]");
      if (removeButton) {
        const [productId, variantId] = removeButton.dataset.removeItem.split("|");
        removeCartItem(productId, variantId);
        return;
      }
      const qtyButton = event.target.closest("[data-cart-qty]");
      if (qtyButton) {
        const [productId, variantId, change] = qtyButton.dataset.cartQty.split("|");
        updateCartQuantity(productId, variantId, Number(change));
      }
    });

    document.querySelectorAll("[data-open-cart]").forEach((button) => {
      button.addEventListener("click", openCart);
    });
    document.querySelectorAll("[data-close-cart]").forEach((button) => {
      button.addEventListener("click", () => closeCart());
    });
    document.querySelectorAll("[data-open-appointment]").forEach((button) => {
      button.addEventListener("click", openAppointment);
    });
    document.querySelectorAll("[data-close-appointment]").forEach((button) => {
      button.addEventListener("click", closeAppointment);
    });
    document.querySelectorAll("[data-close-product]").forEach((button) => {
      button.addEventListener("click", closeProduct);
    });
    document.querySelectorAll("[data-format-link]").forEach((button) => {
      button.addEventListener("click", () => setFormatAndScroll(button.dataset.formatLink));
    });

    elements.overlay.addEventListener("click", () => closeCart());
    elements.productModal.addEventListener("click", (event) => {
      if (event.target === elements.productModal) closeProduct();
    });
    elements.appointmentModal.addEventListener("click", (event) => {
      if (event.target === elements.appointmentModal) closeAppointment();
    });
    elements.clearFilters.addEventListener("click", resetFilters);
    document.querySelector("#empty-clear").addEventListener("click", resetFilters);

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        elements.searchInput.focus();
        document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
      }
      if (event.key !== "Escape") return;
      if (!elements.productModal.hidden) closeProduct();
      else if (!elements.appointmentModal.hidden) closeAppointment();
      else if (elements.cartDrawer.classList.contains("is-open")) closeCart();
    });
  }

  async function fetchCatalog(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.products;
    if (!Array.isArray(rows) || !rows.length) throw new Error("Catálogo vacío");
    return rows;
  }

  async function loadRemoteCatalog() {
    const urls = [config.catalogEndpoint, config.catalogFallback].filter(Boolean);
    for (const url of urls) {
      try {
        const rows = await fetchCatalog(url);
        state.products = rows.map(normalizeProduct).filter(Boolean);
        state.loading = false;
        try { localStorage.setItem(CATALOG_KEY, JSON.stringify(rows)); } catch { /* sin espacio */ }
        renderProducts();
        renderCart();
        return;
      } catch (error) {
        console.warn("No se pudo cargar el catálogo desde", url, error);
      }
    }
    state.loading = false;
    renderProducts();
    if (!state.products.length) {
      elements.emptyState.hidden = true;
      elements.productGrid.hidden = false;
      elements.productGrid.innerHTML = '<p class="catalog-loading">No pudimos cargar el catálogo. Escríbenos por WhatsApp y te enviamos la lista.</p>';
    } else {
      showToast("No pudimos actualizar el catálogo. Mostramos la última versión guardada.");
    }
  }

  function init() {
    document.querySelector("#current-year").textContent = new Date().getFullYear();
    elements.footerWhatsapp.href = whatsappUrl("Hola, Aura Essences. Quisiera consultar sobre sus perfumes.");
    elements.footerLocation.href = config.locationUrl || "#";
    document.querySelectorAll('[data-business-hours="weekday"]').forEach((node) => {
      node.textContent = config.businessHours?.weekday || "Lun–Vie · 09:00–17:00";
    });
    document.querySelectorAll('[data-business-hours="weekend"]').forEach((node) => {
      node.textContent = config.businessHours?.weekend || "Sáb–Dom · 09:00–15:00";
    });
    document.querySelectorAll("[data-appointment-duration]").forEach((node) => {
      node.textContent = `${config.appointmentDurationMinutes || 60} minutos`;
    });
    renderProducts();
    renderCart();
    setupAppointment();
    bindEvents();
    loadRemoteCatalog();
  }

  init();
})();
