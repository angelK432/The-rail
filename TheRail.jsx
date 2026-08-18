import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, X, Loader2, ImageOff, Link2, Pencil, Heart, Share2, Check, Search, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

const DEFAULT_CATEGORIES = [
  { id: "clothing", label: "Clothing", accent: "#E8A0B4" },
  { id: "shoes", label: "Shoes", accent: "#7EC9A9" },
  { id: "makeup", label: "Makeup", accent: "#B48FD1" },
  { id: "jewellery", label: "Jewellery", accent: "#D9BB6E" },
  { id: "home", label: "Home", accent: "#8FB8D9" },
];

const PASTEL_ROTATION = ["#E3B7D6", "#9FCFE0", "#F0B183", "#B8D9A0", "#D6B8E8", "#F0C6C6"];

const STORAGE_KEY = "rail-data";
const UNCATEGORISED = "Unsorted";

const CURRENCY_SYMBOLS = { NZD: "$", AUD: "$", USD: "$", GBP: "£", EUR: "€" };

// Rough, approximate conversion rates to NZD, used only to give a ballpark combined
// total when a list mixes currencies. Not live exchange rates.
const RATES_TO_NZD = { NZD: 1, AUD: 1.08, USD: 1.64, GBP: 2.08, EUR: 1.79 };

function symbolFor(currency) {
  return CURRENCY_SYMBOLS[currency] || currency + " ";
}

function computeTotals(items) {
  const byCurrency = {};
  items.forEach((i) => {
    const c = i.currency || "NZD";
    byCurrency[c] = (byCurrency[c] || 0) + (Number(i.price) || 0);
  });
  const currencies = Object.keys(byCurrency);
  const breakdown = currencies
    .map((c) => `${symbolFor(c)}${byCurrency[c].toFixed(2)}${c !== "NZD" ? " " + c : ""}`)
    .join(" + ");
  const approxNZD = currencies.reduce((sum, c) => sum + byCurrency[c] * (RATES_TO_NZD[c] || 1), 0);
  return { breakdown: breakdown || `${symbolFor("NZD")}0.00`, approxNZD, mixed: currencies.length > 1 };
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || ("cat-" + Date.now());
}

function emptyData() {
  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  const folders = {};
  categories.forEach((c) => {
    folders[c.id] = [];
  });
  return { items: [], folders, categories };
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function allCategories(data) {
  return data.categories || [];
}

async function fetchProductDetails(url) {
  const response = await fetch(`/.netlify/functions/fetch-product?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "Couldn't read details from that link.");
  return {
    name: data.name || "",
    brand: data.brand || "",
    price: typeof data.price === "number" ? data.price : parseFloat(data.price) || 0,
    currency: (data.currency || "NZD").toUpperCase(),
    imageUrl: data.imageUrl || "",
  };
}

function TotalLine({ items, accent, label }) {
  const { breakdown, approxNZD, mixed } = computeTotals(items);
  return (
    <div className="rail-priority-total" style={{ color: accent }}>
      {label}: {breakdown}
      {mixed && <span className="rail-priority-approx"> (approx. {symbolFor("NZD")}{approxNZD.toFixed(2)} NZD combined)</span>}
    </div>
  );
}

function ItemCard({ item, accent, folders, onDelete, onMove, onEdit, onTogglePriority, onTogglePurchased, onUpdatePrice, categoryLabel }) {
  const [confirming, setConfirming] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  async function handleRecheck() {
    setChecking(true);
    setCheckResult(null);
    try {
      const details = await fetchProductDetails(item.url);
      setCheckResult({ price: details.price, currency: details.currency || item.currency });
    } catch (e) {
      setCheckResult({ error: true });
    } finally {
      setChecking(false);
    }
  }

  const sameCurrency = checkResult && !checkResult.error && checkResult.currency === item.currency;
  const diff = sameCurrency ? checkResult.price - item.price : null;

  return (
    <div className="rail-card">
      <div className="rail-card-notch" style={{ background: accent }} />
      <div className="rail-card-media">
        {categoryLabel && (
          <span className="rail-card-catbadge" style={{ background: accent }}>
            {categoryLabel}
          </span>
        )}
        {item.imageUrl && !imgError ? (
          <img src={item.imageUrl} alt={item.name} onError={() => setImgError(true)} />
        ) : (
          <div className="rail-card-noimg">
            <ImageOff size={22} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="rail-card-body">
        {item.brand && <div className="rail-card-brand">{item.brand}</div>}
        <div className="rail-card-name">{item.name || "Untitled item"}</div>
        <div className="rail-price-row">
          <div className="rail-card-price" style={{ color: accent }}>
            {symbolFor(item.currency)}
            {Number(item.price).toFixed(2)}
            {item.currency !== "NZD" ? <span className="rail-card-currency"> {item.currency}</span> : null}
          </div>
          <div className="rail-price-actions">
            {item.url && (
              <button
                className="rail-recheck-icon"
                onClick={handleRecheck}
                disabled={checking}
                title="Recheck price"
              >
                {checking ? <Loader2 className="rail-spin" size={15} /> : <RefreshCw size={15} color={accent} strokeWidth={1.75} />}
              </button>
            )}
            <button
              className="rail-heart"
              onClick={() => onTogglePriority(item.id)}
              title={item.priority ? "Remove from top priority buys" : "Add to top priority buys"}
            >
              <Heart size={16} fill={item.priority ? accent : "none"} color={accent} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <label className="rail-card-movelabel">Folder</label>
        <select
          className="rail-card-move"
          value={item.folder || UNCATEGORISED}
          onChange={(e) => onMove(item.id, e.target.value)}
        >
          <option value={UNCATEGORISED}>{UNCATEGORISED}</option>
          {folders.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button
          className={"rail-purchase-btn" + (item.purchased ? " purchased" : "")}
          style={item.purchased ? { background: accent, borderColor: accent } : { borderColor: accent, color: accent }}
          onClick={() => onTogglePurchased(item.id)}
        >
          <Check size={13} /> {item.purchased ? "Purchased" : "Mark as purchased"}
        </button>

        {checkResult && checkResult.error && (
          <div className="rail-recheck-result rail-recheck-error">
            <span>Couldn't check the price just now.</span>
            <button onClick={() => setCheckResult(null)}>Dismiss</button>
          </div>
        )}

        {checkResult && !checkResult.error && (
          <div
            className={
              "rail-recheck-result" +
              (sameCurrency && diff < 0 ? " drop" : sameCurrency && diff > 0 ? " rise" : "")
            }
          >
            {sameCurrency && diff < 0 && (
              <span>
                <TrendingDown size={12} /> Price dropped to {symbolFor(checkResult.currency)}
                {checkResult.price.toFixed(2)} (was {symbolFor(item.currency)}
                {Number(item.price).toFixed(2)})
              </span>
            )}
            {sameCurrency && diff > 0 && (
              <span>
                <TrendingUp size={12} /> Price went up to {symbolFor(checkResult.currency)}
                {checkResult.price.toFixed(2)} (was {symbolFor(item.currency)}
                {Number(item.price).toFixed(2)})
              </span>
            )}
            {sameCurrency && diff === 0 && <span>No change, still {symbolFor(checkResult.currency)}{checkResult.price.toFixed(2)}</span>}
            {!sameCurrency && (
              <span>
                Current price: {symbolFor(checkResult.currency)}
                {checkResult.price.toFixed(2)}
                {checkResult.currency !== "NZD" ? " " + checkResult.currency : ""}
              </span>
            )}
            <div className="rail-recheck-actions">
              {diff !== 0 && (
                <button
                  onClick={() => {
                    onUpdatePrice(item.id, checkResult.price, checkResult.currency);
                    setCheckResult(null);
                  }}
                >
                  Update price
                </button>
              )}
              <button onClick={() => setCheckResult(null)}>Dismiss</button>
            </div>
          </div>
        )}
      </div>
      {item.url && (
        <a className="rail-card-link" href={item.url} target="_blank" rel="noreferrer" title="Open product link">
          <Link2 size={14} />
        </a>
      )}
      <button className="rail-card-edit" onClick={() => onEdit(item)} title="Edit item">
        <Pencil size={13} />
      </button>
      <button
        className={"rail-card-delete" + (confirming ? " confirming" : "")}
        onClick={() => {
          if (confirming) {
            onDelete(item.id);
          } else {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 2500);
          }
        }}
        title={confirming ? "Click again to remove" : "Remove item"}
      >
        {confirming ? "Remove?" : <Trash2 size={14} />}
      </button>
    </div>
  );
}

export default function TheRail() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("clothing");
  const [activeFolder, setActiveFolder] = useState("__all__");
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sortMode, setSortMode] = useState("price");
  const [undoInfo, setUndoInfo] = useState(null);
  const [shareToast, setShareToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [managingFolders, setManagingFolders] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const undoTimeoutRef = useRef(null);
  const shareToastTimeoutRef = useRef(null);

  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        const loaded = result ? JSON.parse(result.value) : emptyData();
        if (!loaded.categories) {
          loaded.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c })).concat(loaded.customCategories || []);
          delete loaded.customCategories;
        }
        if (!loaded.folders) loaded.folders = {};
        loaded.categories.forEach((c) => {
          if (!loaded.folders[c.id]) loaded.folders[c.id] = [];
        });
        setData(loaded);
      } catch (e) {
        setData(emptyData());
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
      if (!result) setLoadError("Your change might not have saved. Give it another go.");
      else setLoadError(null);
    } catch (e) {
      setLoadError("Your change might not have saved. Give it another go.");
    }
  }, []);

  if (!data) {
    return (
      <div className="rail-root rail-loading">
        <style>{styles}</style>
        <Loader2 className="rail-spin" size={22} />
        <span>Opening the rail...</span>
      </div>
    );
  }

  const PRIORITY_VIEW_ID = "__priority__";
  const PURCHASED_VIEW_ID = "__purchased__";
  const priorityViewCategory = { id: PRIORITY_VIEW_ID, label: "Priority buys", accent: "#C77B95" };
  const purchasedViewCategory = { id: PURCHASED_VIEW_ID, label: "Purchased", accent: "#7FA88A" };
  const isPriorityView = activeCategory === PRIORITY_VIEW_ID;
  const isPurchasedView = activeCategory === PURCHASED_VIEW_ID;
  const isSpecialView = isPriorityView || isPurchasedView;
  const isSearching = searchQuery.trim().length > 0;

  const sortList = (list) =>
    list.slice().sort((a, b) =>
      sortMode === "recent" ? new Date(b.addedAt) - new Date(a.addedAt) : a.price - b.price
    );

  const categories = allCategories(data);
  const category = isPriorityView
    ? priorityViewCategory
    : isPurchasedView
    ? purchasedViewCategory
    : categories.find((c) => c.id === activeCategory) || categories[0];
  const folders = isSpecialView ? [] : data.folders[category.id] || [];
  const itemsInCategory = isSpecialView
    ? []
    : data.items.filter((i) => i.category === category.id && !i.purchased);
  const visibleItems = isSpecialView
    ? []
    : sortList(
        activeFolder === "__all__"
          ? itemsInCategory
          : itemsInCategory.filter((i) => (i.folder || UNCATEGORISED) === activeFolder)
      );
  const priorityItems = visibleItems.filter((i) => i.priority);
  const otherItems = visibleItems.filter((i) => !i.priority);
  const allPriorityItems = sortList(data.items.filter((i) => i.priority && !i.purchased));
  const allPurchasedItems = data.items
    .filter((i) => i.purchased)
    .slice()
    .sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0));
  const searchResults = isSearching
    ? sortList(
        data.items.filter((i) => {
          const q = searchQuery.trim().toLowerCase();
          return (i.name || "").toLowerCase().includes(q) || (i.brand || "").toLowerCase().includes(q);
        })
      )
    : [];
  const defaultCategoryId = isSpecialView ? categories[0].id : category.id;

  function openModal() {
    setUrlInput("");
    setFetchError(null);
    setForm(null);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(item) {
    setUrlInput("");
    setFetchError(null);
    setEditingId(item.id);
    setForm({
      name: item.name,
      brand: item.brand,
      price: item.price,
      currency: item.currency,
      imageUrl: item.imageUrl,
      url: item.url,
      category: item.category,
      folder: item.folder || UNCATEGORISED,
    });
    setModalOpen(true);
  }

  function startManual() {
    setForm({
      name: "",
      brand: "",
      price: "",
      currency: "NZD",
      imageUrl: "",
      url: urlInput.trim(),
      category: defaultCategoryId,
      folder: isSpecialView || activeFolder === "__all__" ? UNCATEGORISED : activeFolder,
    });
  }

  async function handleFetch() {
    if (!urlInput.trim()) return;
    setFetching(true);
    setFetchError(null);
    const folderDefault = isSpecialView || activeFolder === "__all__" ? UNCATEGORISED : activeFolder;
    try {
      const details = await fetchProductDetails(urlInput.trim());
      setForm({ ...details, url: urlInput.trim(), category: defaultCategoryId, folder: folderDefault });
    } catch (e) {
      setFetchError("Couldn't pull details from that link automatically. Pop them in manually below.");
      setForm({ name: "", brand: "", price: "", currency: "NZD", imageUrl: "", url: urlInput.trim(), category: defaultCategoryId, folder: folderDefault });
    } finally {
      setFetching(false);
    }
  }

  async function saveItem() {
    if (!form.name.trim() || !form.price) return;
    const isEditing = Boolean(editingId);
    const existing = isEditing ? data.items.find((i) => i.id === editingId) : null;
    const item = {
      id: isEditing ? editingId : uid(),
      name: form.name.trim(),
      brand: form.brand.trim(),
      price: parseFloat(form.price) || 0,
      currency: form.currency || "NZD",
      imageUrl: form.imageUrl.trim(),
      url: form.url.trim(),
      category: form.category,
      folder: form.folder || UNCATEGORISED,
      addedAt: isEditing && existing ? existing.addedAt : new Date().toISOString(),
      priority: isEditing && existing ? existing.priority : false,
      purchased: isEditing && existing ? existing.purchased : false,
      purchasedAt: isEditing && existing ? existing.purchasedAt : null,
    };
    const next = {
      ...data,
      items: isEditing ? data.items.map((i) => (i.id === editingId ? item : i)) : [...data.items, item],
    };
    if (item.folder !== UNCATEGORISED && !(next.folders[item.category] || []).includes(item.folder)) {
      next.folders = { ...next.folders, [item.category]: [...(next.folders[item.category] || []), item.folder] };
    }
    await persist(next);
    setModalOpen(false);
    setEditingId(null);
    setActiveCategory(item.category);
    setActiveFolder("__all__");
  }

  async function deleteItem(id) {
    const removed = data.items.find((i) => i.id === id);
    await persist({ ...data, items: data.items.filter((i) => i.id !== id) });
    if (removed) {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setUndoInfo({ item: removed });
      undoTimeoutRef.current = setTimeout(() => setUndoInfo(null), 6000);
    }
  }

  async function undoDelete() {
    if (!undoInfo) return;
    const restored = undoInfo.item;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoInfo(null);
    await persist({ ...data, items: [...data.items, restored] });
  }

  async function moveItem(id, newFolder) {
    await persist({
      ...data,
      items: data.items.map((i) => (i.id === id ? { ...i, folder: newFolder } : i)),
    });
  }

  async function togglePriority(id) {
    await persist({
      ...data,
      items: data.items.map((i) => (i.id === id ? { ...i, priority: !i.priority } : i)),
    });
  }

  async function togglePurchased(id) {
    await persist({
      ...data,
      items: data.items.map((i) => {
        if (i.id !== id) return i;
        const nextPurchased = !i.purchased;
        return { ...i, purchased: nextPurchased, purchasedAt: nextPurchased ? new Date().toISOString() : null };
      }),
    });
  }

  async function updateItemPrice(id, newPrice, newCurrency) {
    await persist({
      ...data,
      items: data.items.map((i) => (i.id === id ? { ...i, price: newPrice, currency: newCurrency } : i)),
    });
  }

  async function renameFolder(categoryId, oldName, newNameRaw) {
    const newName = newNameRaw.trim();
    const list = data.folders[categoryId] || [];
    if (!newName || newName === oldName || list.includes(newName)) return;
    const next = {
      ...data,
      folders: { ...data.folders, [categoryId]: list.map((f) => (f === oldName ? newName : f)) },
      items: data.items.map((i) =>
        i.category === categoryId && i.folder === oldName ? { ...i, folder: newName } : i
      ),
    };
    await persist(next);
    if (activeFolder === oldName) setActiveFolder(newName);
  }

  async function deleteFolder(categoryId, name) {
    if (
      typeof window !== "undefined" &&
      window.confirm &&
      !window.confirm(`Delete the "${name}" folder? Items inside will move to ${UNCATEGORISED}.`)
    ) {
      return;
    }
    const list = data.folders[categoryId] || [];
    const next = {
      ...data,
      folders: { ...data.folders, [categoryId]: list.filter((f) => f !== name) },
      items: data.items.map((i) =>
        i.category === categoryId && i.folder === name ? { ...i, folder: UNCATEGORISED } : i
      ),
    };
    await persist(next);
    if (activeFolder === name) setActiveFolder("__all__");
  }

  async function renameCategory(id, newNameRaw) {
    const newLabel = newNameRaw.trim();
    if (!newLabel) return;
    const next = { ...data, categories: categories.map((c) => (c.id === id ? { ...c, label: newLabel } : c)) };
    await persist(next);
  }

  async function deleteCategory(id) {
    if (categories.length <= 1) {
      flashShareToast("You need to keep at least one category.");
      return;
    }
    const cat = categories.find((c) => c.id === id);
    const label = cat ? cat.label : "this category";
    const remaining = categories.filter((c) => c.id !== id);
    const fallback = remaining[0];
    if (
      typeof window !== "undefined" &&
      window.confirm &&
      !window.confirm(`Delete "${label}"? Its items will move into ${fallback.label}, unsorted.`)
    ) {
      return;
    }
    const restFolders = { ...data.folders };
    delete restFolders[id];
    const next = {
      ...data,
      categories: remaining,
      folders: restFolders,
      items: data.items.map((i) => (i.category === id ? { ...i, category: fallback.id, folder: UNCATEGORISED } : i)),
    };
    await persist(next);
    if (activeCategory === id) {
      setActiveCategory(fallback.id);
      setActiveFolder("__all__");
    }
  }

  function buildShareText(title, items) {
    const { breakdown, approxNZD, mixed } = computeTotals(items);
    const lines = items.map(
      (i) =>
        `• ${i.name || "Untitled item"}${i.brand ? " (" + i.brand + ")" : ""} - ${symbolFor(i.currency)}${Number(
          i.price
        ).toFixed(2)}${i.currency !== "NZD" ? " " + i.currency : ""}`
    );
    let text = `${title}\n\n${lines.join("\n")}\n\nTotal: ${breakdown}`;
    if (mixed) text += ` (approx. ${symbolFor("NZD")}${approxNZD.toFixed(2)} NZD combined)`;
    return text;
  }

  function flashShareToast(message) {
    if (shareToastTimeoutRef.current) clearTimeout(shareToastTimeoutRef.current);
    setShareToast(message);
    shareToastTimeoutRef.current = setTimeout(() => setShareToast(null), 3000);
  }

  async function shareList(title, items) {
    if (!items.length) return;
    const text = buildShareText(title, items);
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      throw new Error("no-share-api");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        flashShareToast("Copied your list to the clipboard!");
      } catch (err) {
        flashShareToast("Couldn't share or copy that list. Give it another go.");
      }
    }
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name || folders.includes(name)) {
      setAddingFolder(false);
      setNewFolderName("");
      return;
    }
    const next = { ...data, folders: { ...data.folders, [category.id]: [...folders, name] } };
    await persist(next);
    setAddingFolder(false);
    setNewFolderName("");
    setActiveFolder(name);
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    setAddingCategory(false);
    setNewCategoryName("");
    if (!name) return;
    const id = slugify(name);
    if (categories.some((c) => c.id === id)) {
      setActiveCategory(id);
      setActiveFolder("__all__");
      return;
    }
    const accent = PASTEL_ROTATION[categories.length % PASTEL_ROTATION.length];
    const next = {
      ...data,
      categories: [...categories, { id, label: name, accent }],
      folders: { ...data.folders, [id]: [] },
    };
    await persist(next);
    setActiveCategory(id);
    setActiveFolder("__all__");
  }

  return (
    <div className="rail-root">
      <style>{styles}</style>
      <div className="rail-bgwash" />

      <div className="rail-content">
        <header className="rail-header">
          <div>
            <h1>The Rail</h1>
            <p>Everything you own, sorted cheapest to priciest.</p>
          </div>
          <div className="rail-search">
            <Search size={15} className="rail-search-icon" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or brand"
            />
            {searchQuery && (
              <button className="rail-search-clear" onClick={() => setSearchQuery("")} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
        </header>

        {loadError && <div className="rail-banner">{loadError}</div>}

        <nav className="rail-tabs">
          <button
            className={"rail-tab rail-tab-priority" + (isPriorityView ? " active" : "")}
            style={isPriorityView ? { background: priorityViewCategory.accent, color: "#fff", borderColor: priorityViewCategory.accent } : { borderColor: priorityViewCategory.accent, color: priorityViewCategory.accent }}
            onClick={() => {
              setSearchQuery("");
              setActiveCategory(PRIORITY_VIEW_ID);
              setActiveFolder("__all__");
            }}
          >
            <Heart size={12} fill={isPriorityView ? "#fff" : priorityViewCategory.accent} strokeWidth={1.75} />
            Priority buys
          </button>
          <button
            className={"rail-tab rail-tab-priority" + (isPurchasedView ? " active" : "")}
            style={isPurchasedView ? { background: purchasedViewCategory.accent, color: "#fff", borderColor: purchasedViewCategory.accent } : { borderColor: purchasedViewCategory.accent, color: purchasedViewCategory.accent }}
            onClick={() => {
              setSearchQuery("");
              setActiveCategory(PURCHASED_VIEW_ID);
              setActiveFolder("__all__");
            }}
          >
            <Check size={12} strokeWidth={2.25} />
            Purchased
          </button>
          {categories.map((c) => {
            if (managingCategories) {
              return (
                <span className="rail-editrow" key={c.id}>
                  <input
                    defaultValue={c.label}
                    onBlur={(e) => renameCategory(c.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    style={{ borderColor: c.accent }}
                  />
                  <button
                    className="rail-editrow-delete"
                    onClick={() => deleteCategory(c.id)}
                    title="Delete category"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              );
            }
            return (
              <button
                key={c.id}
                className={"rail-tab" + (c.id === category.id ? " active" : "")}
                style={c.id === category.id ? { background: c.accent, color: "#fff", borderColor: c.accent } : { borderColor: c.accent, color: c.accent }}
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory(c.id);
                  setActiveFolder("__all__");
                }}
              >
                {c.label}
              </button>
            );
          })}
          {addingCategory ? (
            <span className="rail-newfolder rail-newcategory">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createCategory();
                  if (e.key === "Escape") {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }
                }}
                placeholder="Category name"
              />
              <button onClick={createCategory}>Add</button>
            </span>
          ) : (
            <button className="rail-tab rail-tab-ghost" onClick={() => setAddingCategory(true)}>
              + New category
            </button>
          )}
          <button className="rail-tab-manage" onClick={() => setManagingCategories((v) => !v)}>
            {managingCategories ? "Done" : "Edit categories"}
          </button>
        </nav>
        {managingCategories && (
          <p className="rail-manage-hint">Deleting a category moves its items into another category, unsorted. You always need at least one category.</p>
        )}

        {!isSpecialView && !isSearching && (
          <div className="rail-folderbar">
            <button
              className={"rail-chip" + (activeFolder === "__all__" ? " active" : "")}
              style={activeFolder === "__all__" ? { background: category.accent, borderColor: category.accent } : { borderColor: category.accent }}
              onClick={() => setActiveFolder("__all__")}
            >
              All {category.label.toLowerCase()}
            </button>
            {folders.map((f) =>
              managingFolders ? (
                <span className="rail-editrow" key={f}>
                  <input
                    defaultValue={f}
                    onBlur={(e) => renameFolder(category.id, f, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    style={{ borderColor: category.accent }}
                  />
                  <button className="rail-editrow-delete" onClick={() => deleteFolder(category.id, f)} title="Delete folder">
                    <Trash2 size={12} />
                  </button>
                </span>
              ) : (
                <button
                  key={f}
                  className={"rail-chip" + (activeFolder === f ? " active" : "")}
                  style={activeFolder === f ? { background: category.accent, borderColor: category.accent } : { borderColor: category.accent }}
                  onClick={() => setActiveFolder(f)}
                >
                  {f}
                </button>
              )
            )}
            {addingFolder ? (
              <span className="rail-newfolder">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createFolder();
                    if (e.key === "Escape") {
                      setAddingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  placeholder="Folder name"
                />
                <button onClick={createFolder}>Add</button>
              </span>
            ) : (
              <button className="rail-chip rail-chip-ghost" onClick={() => setAddingFolder(true)}>
                + New folder
              </button>
            )}
            {folders.length > 0 && (
              <button className="rail-tab-manage" onClick={() => setManagingFolders((v) => !v)}>
                {managingFolders ? "Done" : "Edit folders"}
              </button>
            )}
          </div>
        )}

        <div className="rail-toolbar">
          <div className="rail-sort">
            <button className={"rail-sort-btn" + (sortMode === "price" ? " active" : "")} onClick={() => setSortMode("price")}>
              Cheapest first
            </button>
            <button className={"rail-sort-btn" + (sortMode === "recent" ? " active" : "")} onClick={() => setSortMode("recent")}>
              Newest first
            </button>
          </div>
          <button
            className="rail-share-btn"
            onClick={() =>
              isSearching
                ? shareList(`Search: ${searchQuery.trim()}`, searchResults)
                : isPriorityView
                ? shareList("My priority buys", allPriorityItems)
                : isPurchasedView
                ? shareList("What I've purchased", allPurchasedItems)
                : shareList(`${category.label}${activeFolder !== "__all__" ? " - " + activeFolder : ""}`, visibleItems)
            }
            title="Share this list"
          >
            <Share2 size={13} /> Share
          </button>
        </div>

        {shareToast && <div className="rail-sharetoast">{shareToast}</div>}

        <main className="rail-main">
          {isSearching ? (
            searchResults.length === 0 ? (
              <div className="rail-empty">
                <p>No matches.</p>
                <span>Try a different name or brand.</span>
              </div>
            ) : (
              <div className="rail-grid">
                {searchResults.map((item) => {
                  const itemCategory = categories.find((c) => c.id === item.category);
                  const itemAccent = itemCategory ? itemCategory.accent : category.accent;
                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      accent={itemAccent}
                      folders={data.folders[item.category] || []}
                      onDelete={deleteItem}
                      onMove={moveItem}
                      onEdit={openEditModal}
                      onTogglePriority={togglePriority}
                      onTogglePurchased={togglePurchased}
                      onUpdatePrice={updateItemPrice}
                      categoryLabel={itemCategory ? itemCategory.label : null}
                    />
                  );
                })}
              </div>
            )
          ) : isPriorityView ? (
            allPriorityItems.length === 0 ? (
              <div className="rail-empty">
                <p>No priority buys yet.</p>
                <span>Heart the items you love most, from any category, to see them together here.</span>
              </div>
            ) : (
              <div className="rail-priority-section rail-priority-section-standalone">
                <div className="rail-grid">
                  {allPriorityItems.map((item) => {
                    const itemCategory = categories.find((c) => c.id === item.category);
                    const itemAccent = itemCategory ? itemCategory.accent : priorityViewCategory.accent;
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        accent={itemAccent}
                        folders={data.folders[item.category] || []}
                        onDelete={deleteItem}
                        onMove={moveItem}
                        onEdit={openEditModal}
                        onTogglePriority={togglePriority}
                        onTogglePurchased={togglePurchased}
                      onUpdatePrice={updateItemPrice}
                        categoryLabel={itemCategory ? itemCategory.label : null}
                      />
                    );
                  })}
                </div>
                <TotalLine items={allPriorityItems} accent={priorityViewCategory.accent} label="Priority buys total" />
              </div>
            )
          ) : isPurchasedView ? (
            allPurchasedItems.length === 0 ? (
              <div className="rail-empty">
                <p>Nothing purchased yet.</p>
                <span>Mark an item as purchased once you've bought it, and it'll land here.</span>
              </div>
            ) : (
              <div className="rail-priority-section rail-priority-section-standalone">
                <div className="rail-grid">
                  {allPurchasedItems.map((item) => {
                    const itemCategory = categories.find((c) => c.id === item.category);
                    const itemAccent = itemCategory ? itemCategory.accent : purchasedViewCategory.accent;
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        accent={itemAccent}
                        folders={data.folders[item.category] || []}
                        onDelete={deleteItem}
                        onMove={moveItem}
                        onEdit={openEditModal}
                        onTogglePriority={togglePriority}
                        onTogglePurchased={togglePurchased}
                      onUpdatePrice={updateItemPrice}
                        categoryLabel={itemCategory ? itemCategory.label : null}
                      />
                    );
                  })}
                </div>
                <TotalLine items={allPurchasedItems} accent={purchasedViewCategory.accent} label="Total spent" />
              </div>
            )
          ) : visibleItems.length === 0 ? (
            <div className="rail-empty">
              <p>Nothing here yet.</p>
              <span>Add your first {category.label.toLowerCase()} item to start this rail.</span>
            </div>
          ) : (
            <>
              {priorityItems.length > 0 && (
                <div className="rail-priority-section">
                  <div className="rail-priority-header">
                    <Heart size={14} fill={category.accent} color={category.accent} />
                    Top priority buys
                  </div>
                  <div className="rail-grid">
                    {priorityItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        accent={category.accent}
                        folders={folders}
                        onDelete={deleteItem}
                        onMove={moveItem}
                        onEdit={openEditModal}
                        onTogglePriority={togglePriority}
                        onTogglePurchased={togglePurchased}
                      onUpdatePrice={updateItemPrice}
                      />
                    ))}
                  </div>
                  <TotalLine items={priorityItems} accent={category.accent} label="Priority buys total" />
                </div>
              )}

              {otherItems.length > 0 && (
                <div className="rail-grid">
                  {otherItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      accent={category.accent}
                      folders={folders}
                      onDelete={deleteItem}
                      onMove={moveItem}
                      onEdit={openEditModal}
                      onTogglePriority={togglePriority}
                      onTogglePurchased={togglePurchased}
                      onUpdatePrice={updateItemPrice}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {undoInfo && (
        <div className="rail-toast">
          <span>Removed "{undoInfo.item.name || "item"}".</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}

      <button className="rail-fab" style={{ background: category.accent }} onClick={openModal}>
        <Plus size={20} /> Add item
      </button>

      {modalOpen && (
        <div className="rail-overlay" onClick={() => setModalOpen(false)}>
          <div className="rail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="rail-modal-close" onClick={() => setModalOpen(false)}>
              <X size={18} />
            </button>
            <h2>{editingId ? "Edit item" : "Add to the rail"}</h2>

            {!form && (
              <>
                <label className="rail-label">Product link</label>
                <div className="rail-urlrow">
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste a product URL" onKeyDown={(e) => e.key === "Enter" && handleFetch()} />
                  <button className="rail-btn-primary" style={{ background: category.accent }} disabled={fetching || !urlInput.trim()} onClick={handleFetch}>
                    {fetching ? <Loader2 className="rail-spin" size={16} /> : "Fetch details"}
                  </button>
                </div>
                <button className="rail-manual-link" onClick={startManual}>
                  Or add the details manually instead
                </button>
              </>
            )}

            {form && (
              <>
                {fetchError && <div className="rail-banner rail-banner-inline">{fetchError}</div>}
                <label className="rail-label">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" />

                <label className="rail-label">Brand</label>
                <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand (optional)" />

                <div className="rail-formrow">
                  <div>
                    <label className="rail-label">Price</label>
                    <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="rail-label">Currency</label>
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                      {["NZD", "AUD", "USD", "GBP", "EUR"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="rail-label">Image URL</label>
                <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://... (optional)" />

                <div className="rail-formrow">
                  <div>
                    <label className="rail-label">Category</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, folder: UNCATEGORISED })}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="rail-label">Folder</label>
                    <select value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })}>
                      <option value={UNCATEGORISED}>{UNCATEGORISED}</option>
                      {(data.folders[form.category] || []).map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button className="rail-btn-primary rail-btn-save" style={{ background: category.accent }} disabled={!form.name.trim() || !form.price} onClick={saveItem}>
                  {editingId ? "Save changes" : "Add to rail"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

.rail-root {
  --bg: #F6F0F8;
  --surface: #FFFFFF;
  --ink: #4A3B57;
  --ink-soft: #9384A3;
  --line: #E8DCEE;
  position: relative;
  font-family: 'Inter', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100%;
  box-sizing: border-box;
  border-radius: 16px;
  overflow: hidden;
}

.rail-bgwash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(circle at 12% 8%, rgba(232,160,180,0.35), transparent 40%),
    radial-gradient(circle at 85% 0%, rgba(159,207,224,0.35), transparent 42%),
    radial-gradient(circle at 60% 20%, rgba(180,143,209,0.28), transparent 38%);
}

.rail-content {
  position: relative;
  z-index: 1;
  padding: 28px 20px 100px;
}

.rail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 200px;
  color: var(--ink-soft);
}

.rail-spin { animation: rail-spin 1s linear infinite; }
@keyframes rail-spin { to { transform: rotate(360deg); } }

.rail-header h1 {
  font-family: 'Fraunces', serif;
  font-size: 34px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
  color: #55415F;
}
.rail-header p {
  margin: 4px 0 22px;
  color: var(--ink-soft);
  font-size: 14px;
}
.rail-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.rail-search {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 4px;
}
.rail-search-icon {
  position: absolute;
  left: 12px;
  color: var(--ink-soft);
  pointer-events: none;
}
.rail-search input {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  padding: 9px 34px 9px 34px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: rgba(255,255,255,0.75);
  color: var(--ink);
  width: 220px;
  box-sizing: border-box;
}
.rail-search-clear {
  position: absolute;
  right: 8px;
  border: none;
  background: none;
  color: var(--ink-soft);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
}

.rail-banner {
  background: #FBE4EE;
  color: #8A4A66;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 16px;
}
.rail-banner-inline { margin: 4px 0 14px; }

.rail-tab-priority {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.rail-card-catbadge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  color: #fff;
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 999px;
  z-index: 1;
}
.rail-priority-section-standalone {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}
.rail-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.rail-tab {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 12.5px;
  padding: 8px 15px;
  border-radius: 999px;
  border: 1.5px solid;
  background: rgba(255,255,255,0.6);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.rail-tab:hover { transform: translateY(-1px); }
.rail-tab-ghost {
  border-style: dashed;
  color: var(--ink-soft);
  border-color: var(--line);
  background: transparent;
}

.rail-folderbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 22px;
  padding-bottom: 18px;
  border-bottom: 1px dashed var(--line);
}
.rail-chip {
  font-family: 'Inter', sans-serif;
  font-size: 12.5px;
  font-weight: 500;
  padding: 7px 13px;
  border-radius: 8px;
  border: 1.5px solid;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.rail-chip.active { color: #fff; }
.rail-chip-ghost {
  border-style: dashed;
  color: var(--ink-soft);
  border-color: var(--line) !important;
}
.rail-newfolder { display: flex; gap: 6px; }
.rail-newfolder input {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--line);
  background: var(--surface);
  width: 130px;
}
.rail-newfolder button {
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 8px;
  border: none;
  background: #B48FD1;
  color: #fff;
  cursor: pointer;
}
.rail-newcategory input { width: 150px; }

.rail-tab-manage {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-soft);
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  padding: 8px 4px;
}
.rail-manage-hint {
  font-size: 12px;
  color: var(--ink-soft);
  margin: -6px 0 14px;
}
.rail-editrow {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border-radius: 999px;
  padding: 3px 4px 3px 10px;
}
.rail-editrow input {
  font-family: 'Inter', sans-serif;
  font-size: 12.5px;
  border: none;
  background: transparent;
  width: 100px;
  padding: 4px 0;
  color: var(--ink);
}
.rail-editrow input:focus { outline: none; }
.rail-editrow-delete {
  border: none;
  background: #FBE4EE;
  color: #C77B95;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.rail-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.rail-sort {
  display: flex;
  gap: 6px;
}
.rail-sort-btn {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: rgba(255,255,255,0.6);
  color: var(--ink-soft);
  cursor: pointer;
}
.rail-sort-btn.active {
  background: var(--ink);
  border-color: var(--ink);
  color: #fff;
}
.rail-share-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1.5px solid var(--line);
  background: rgba(255,255,255,0.6);
  color: var(--ink);
  cursor: pointer;
}
.rail-sharetoast {
  background: #E4E9DD;
  color: #3E5238;
  font-size: 13px;
  padding: 9px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
}
.rail-priority-approx {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  font-size: 11.5px;
  color: var(--ink-soft);
}
.rail-toast {
  position: fixed;
  left: 50%;
  bottom: calc(90px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  background: #3A2E42;
  color: #fff;
  font-size: 13px;
  padding: 11px 14px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.2);
  z-index: 3;
  max-width: calc(100% - 44px);
}
.rail-toast span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rail-toast button {
  border: none;
  background: none;
  color: #F0C6C6;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
}

.rail-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--ink-soft);
}
.rail-empty p {
  font-family: 'Fraunces', serif;
  font-size: 20px;
  color: var(--ink);
  margin: 0 0 6px;
}
.rail-empty span { font-size: 13.5px; }

.rail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.rail-card {
  position: relative;
  background: var(--surface);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 10px rgba(180,143,209,0.08);
}
.rail-card-notch {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  z-index: 2;
  box-shadow: 0 0 0 3px var(--surface);
}
.rail-card-media {
  width: 100%;
  aspect-ratio: 1;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.rail-card-media img { width: 100%; height: 100%; object-fit: cover; }
.rail-card-noimg { color: #E3D6EA; }
.rail-card-body { padding: 10px 12px 12px; border-top: 1px dashed var(--line); }
.rail-card-brand {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
  margin-bottom: 2px;
}
.rail-card-name {
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rail-card-price { font-family: 'IBM Plex Mono', monospace; font-weight: 500; font-size: 15px; }
.rail-card-currency { font-size: 10px; color: var(--ink-soft); }
.rail-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rail-price-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.rail-heart {
  border: none;
  background: none;
  padding: 8px;
  margin: -8px -8px -8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.rail-recheck-icon {
  border: none;
  background: none;
  padding: 8px;
  margin: -8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.rail-recheck-icon:disabled { cursor: default; opacity: 0.7; }
.rail-priority-section {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px dashed var(--line);
}
.rail-priority-header {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'Fraunces', serif;
  font-size: 16px;
  font-weight: 600;
  color: #55415F;
  margin-bottom: 12px;
}
.rail-priority-total {
  margin-top: 14px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  text-align: right;
}
.rail-card-movelabel {
  display: block;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  margin: 9px 0 3px;
}
.rail-card-move {
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 11.5px;
  padding: 5px 7px;
  border-radius: 7px;
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--ink);
  box-sizing: border-box;
}
.rail-purchase-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  margin-top: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 11.5px;
  font-weight: 600;
  padding: 6px 7px;
  border-radius: 7px;
  border: 1.5px solid;
  background: #fff;
  cursor: pointer;
  box-sizing: border-box;
}
.rail-purchase-btn.purchased { color: #fff; }

.rail-recheck-result {
  margin-top: 6px;
  padding: 8px 9px;
  border-radius: 8px;
  background: #F1EEF5;
  font-size: 11.5px;
  color: var(--ink);
}
.rail-recheck-result span {
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.35;
}
.rail-recheck-result.drop { background: #E4EFE6; color: #2F6E45; }
.rail-recheck-result.rise { background: #F6E9E4; color: #9A5A32; }
.rail-recheck-error { background: #FBE4EE; color: #8A4A66; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rail-recheck-error span { display: block; }
.rail-recheck-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.rail-recheck-actions button,
.rail-recheck-error button {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 6px;
  border: none;
  background: rgba(255,255,255,0.7);
  color: inherit;
  cursor: pointer;
}
.rail-card-link {
  position: absolute;
  top: 6px;
  right: 74px;
  color: var(--ink-soft);
  background: var(--surface);
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rail-card-edit {
  position: absolute;
  top: 6px;
  right: 40px;
  border: none;
  background: var(--surface);
  color: var(--ink-soft);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.rail-card-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  border: none;
  background: var(--surface);
  color: #C77B95;
  border-radius: 999px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10.5px;
  font-weight: 600;
}
.rail-card-delete.confirming { width: auto; padding: 0 10px; background: #C77B95; color: #fff; }

.rail-fab {
  position: fixed;
  bottom: calc(22px + env(safe-area-inset-bottom));
  right: 22px;
  border: none;
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 14px;
  padding: 13px 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(180,143,209,0.35);
  z-index: 2;
}

.rail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(74,59,87,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 10;
}
.rail-modal {
  background: var(--surface);
  border-radius: 18px;
  padding: 26px;
  width: 100%;
  max-width: 380px;
  max-height: 86vh;
  max-height: 86dvh;
  overflow-y: auto;
  position: relative;
}
.rail-modal h2 { font-family: 'Fraunces', serif; font-size: 22px; margin: 0 0 16px; color: #55415F; }
.rail-modal-close { position: absolute; top: 16px; right: 16px; border: none; background: transparent; color: var(--ink-soft); cursor: pointer; }
.rail-label {
  display: block;
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ink-soft);
  margin: 12px 0 5px;
}
.rail-modal input, .rail-modal select {
  width: 100%;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  padding: 10px 11px;
  border-radius: 9px;
  border: 1.5px solid var(--line);
  background: #fff;
  box-sizing: border-box;
  color: var(--ink);
}
.rail-urlrow { display: flex; gap: 8px; }
.rail-urlrow input { flex: 1; }
.rail-btn-primary {
  border: none;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  padding: 0 16px;
  border-radius: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}
.rail-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.rail-btn-save { width: 100%; padding: 12px; margin-top: 20px; font-size: 14px; }
.rail-manual-link {
  display: block;
  background: none;
  border: none;
  color: var(--ink-soft);
  font-size: 12.5px;
  text-decoration: underline;
  margin-top: 12px;
  cursor: pointer;
  padding: 0;
}
.rail-formrow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
`;
