"use client";

import { useEffect, useRef, useState } from "react";

const EMPTY_ITEM = { name: "", expiryDate: "" };

function localDateKey(day) {
  return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
}

function getExpiryStatus(date, today, soon) {
  if (!date) return null;
  if (date < today) return "Past marked date";
  if (date === today) return "Use today";
  return date <= soon ? "Use soon" : null;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(date + "T00:00:00Z"));
}

export default function FridgeInventory({ open, scanVersion, onOpen, onFindRecipes }) {
  const nameInput = useRef(null);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_ITEM);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    async function loadItems() {
      try {
        const result = await fetch("/api/fridge-inventory", { signal: controller.signal, cache: "no-store" });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setItems(data.items);
      } catch (failure) {
        if (!controller.signal.aborted) setLoadError(failure.message || "Couldn’t load your fridge list.");
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }
    loadItems();
    return () => controller.abort();
  }, [scanVersion, refreshCount]);

  async function changeItem(method, body) {
    setBusy(true);
    setActionError("");
    try {
      const result = await fetch("/api/fridge-inventory", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await result.json();
      if (!result.ok) {
        if (result.status === 404) setRefreshCount((count) => count + 1);
        throw new Error(data.error);
      }
      if (method !== "DELETE" || editingId === body.id) {
        setEditingId(null);
        setDraft(EMPTY_ITEM);
      }
      setRefreshCount((count) => count + 1);
    } catch (failure) {
      setActionError(failure.message || "Couldn’t update your fridge list.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(item) {
    setActionError("");
    setEditingId(item.id);
    setDraft({ name: item.name, expiryDate: item.expiryDate ?? "" });
    nameInput.current?.focus();
  }

  function submitItem(event) {
    event.preventDefault();
    if (busy || !draft.name.trim()) return;
    changeItem(editingId ? "PATCH" : "POST", { ...draft, id: editingId });
  }

  const [selectedSoonId, setSelectedSoonId] = useState("");

  const now = new Date();
  const today = localDateKey(now);
  now.setDate(now.getDate() + 3);
  const soon = localDateKey(now);
  const attention = items.filter((item) => getExpiryStatus(item.expiryDate, today, soon));

  const useSoonItems = attention.filter((item) => item.expiryDate >= today);
  const soonId = useSoonItems.some((item) => item.id === selectedSoonId) ? selectedSoonId : useSoonItems[0]?.id;

  if (!open) {
    if (attention.length === 0) return null;
    return <div className="fridge-reminder">
      <p><strong>Fridge reminder</strong> · {attention.slice(0, 3).map((item) => item.name).join(", ")}{attention.length > 3 ? " and more" : ""} {attention.length === 1 ? "has" : "have"} a marked date coming up or past.</p>
      <button type="button" className="cooking-secondary" onClick={onOpen}>Open fridge</button>
    </div>;
  }

  return (
    <section className="shopping-panel" aria-labelledby="fridge-inventory-title">
      <div className="shopping-heading">
        <div>
          <h2 id="fridge-inventory-title">In fridge</h2>
          <p>Scans and checked groceries appear here. Replace estimated dates with package dates when you have them.</p>
          <p>Items are marked “Use soon” within three days of the listed date. Each new set of recipes uses one daily request.</p>
        </div>
        <span className="shopping-count">{items.length} {items.length === 1 ? "item" : "items"}</span>
      </div>

      {loadError && <p role="alert" className="fridge-error">{loadError} <button type="button" className="cooking-secondary" onClick={() => setRefreshCount((count) => count + 1)}>Retry</button></p>}
      {!loaded ? <p role="status">Loading fridge items…</p> : !loadError && items.length === 0 && <p>Scan your fridge or add an ingredient below.</p>}

      {useSoonItems.length > 0 && <div className="fridge-item-form">
        <label>Use up soon
          <select value={soonId} onChange={(event) => setSelectedSoonId(event.target.value)}>
            {useSoonItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatDate(item.expiryDate)}</option>)}
          </select>
        </label>
        <button type="button" className="planner-primary" onClick={() => onFindRecipes(soonId)}>Find recipes</button>
      </div>}

      {items.length > 0 && <ul className="fridge-item-list">
        {items.map((item) => {
          const status = getExpiryStatus(item.expiryDate, today, soon);
          return <li key={item.id}>
            <div className="fridge-item-info">
              <strong>{item.name}</strong>
              <span>{item.expiryDate ? (item.expiryEstimated ? "Estimated · " : "") + formatDate(item.expiryDate) : "No expiry date"}</span>
              {status && <span className="fridge-date-status">{status}</span>}
            </div>
            <div className="fridge-item-actions">
              {status !== "Past marked date" && <button type="button" className="cooking-secondary" aria-label={"Find recipes with " + item.name} onClick={() => onFindRecipes(item.id)}>Find recipes</button>}
              <button type="button" className="cooking-secondary" disabled={busy} aria-label={"Edit " + item.name} onClick={() => beginEdit(item)}>Edit</button>
              <button type="button" className="cooking-secondary" disabled={busy} aria-label={"Remove " + item.name} onClick={() => changeItem("DELETE", { id: item.id })}>Remove</button>
            </div>
          </li>;
        })}
      </ul>}

      <form className="fridge-item-form" onSubmit={submitItem}>
        <label>Ingredient
          <input ref={nameInput} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={120} required disabled={busy} />
        </label>
        <label>Expiry date (optional)
          <input type="date" value={draft.expiryDate} onChange={(event) => setDraft({ ...draft, expiryDate: event.target.value })} max="9999-12-31" disabled={busy} />
        </label>
        <button type="submit" className="planner-primary" disabled={busy || !draft.name.trim()}>{editingId ? "Save changes" : "Add ingredient"}</button>
        {editingId && <button type="button" className="cooking-secondary" disabled={busy} onClick={() => {
          setEditingId(null); setDraft(EMPTY_ITEM); setActionError("");
        }}>Cancel</button>}
      </form>
      {actionError && <p role="alert" className="fridge-error">{actionError}</p>}
    </section>
  );
}
