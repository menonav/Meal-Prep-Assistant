"use client";

import { useEffect, useState } from "react";
import { EMPTY_FOOD_PREFERENCES } from "../../../lib/food-preferences";

const LIST_FIELDS = [
  { id: "diet", label: "Dietary preferences", placeholder: "Vegetarian, high protein" },
  { id: "allergies", label: "Food allergies", placeholder: "Peanuts, shellfish" },
  { id: "avoid", label: "Ingredients to avoid", placeholder: "Mushrooms, olives" },
];

function toDraft(preferences) {
  return {
    diet: preferences.diet.join(", "),
    allergies: preferences.allergies.join(", "),
    avoid: preferences.avoid.join(", "),
    maxMinutes: preferences.maxMinutes === null ? "" : String(preferences.maxMinutes),
  };
}

export default function FoodPreferences({ onSaved }) {
  const [draft, setDraft] = useState(() => toDraft(EMPTY_FOOD_PREFERENCES));
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    async function load() {
      try {
        const result = await fetch("/api/food-preferences", { signal: controller.signal, cache: "no-store" });
        const payload = await result.json();
        if (!result.ok) throw new Error(payload.error);
        if (!controller.signal.aborted) {
          setDraft(toDraft(payload.preferences));
          setReady(true);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message || "Couldn’t load your preferences.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [retry]);

  function update(field, value) {
    setSaved(false);
    setError("");
    setDraft((previous) => ({ ...previous, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const preferences = Object.fromEntries(LIST_FIELDS.map(({ id }) => [
      id, draft[id].split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean),
    ]));
    preferences.maxMinutes = draft.maxMinutes === "" ? null : Number(draft.maxMinutes);
    try {
      const result = await fetch("/api/food-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setDraft(toDraft(payload.preferences));
      setSaved(true);
      onSaved();
    } catch (failure) {
      setError(failure.message || "Couldn’t save your preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="shopping-panel" aria-labelledby="food-preferences-title">
      <div className="shopping-heading"><div>
        <h2 id="food-preferences-title">Food preferences</h2>
        <p>New recipe ideas and cooking coach answers use the preferences you save here.</p>
      </div></div>
      {loading && <p role="status">Loading your preferences…</p>}
      {error && <p role="alert" className="fridge-error">{error}</p>}
      {!ready && !loading && <button type="button" className="cooking-secondary" onClick={() => setRetry((count) => count + 1)}>Try again</button>}
      {ready && <form className="food-preferences-form" onSubmit={save}>
        <p id="food-preferences-hint">All fields are optional. Separate entries with commas.</p>
        {LIST_FIELDS.map(({ id, label, placeholder }) => <label key={id}>
          {label}
          <input value={draft[id]} maxLength={1000} disabled={saving} placeholder={placeholder}
            aria-describedby={id === "allergies" ? "food-allergy-hint" : "food-preferences-hint"}
            onChange={(event) => update(id, event.target.value)} />
        </label>)}
        <p id="food-allergy-hint">For allergies, check ingredient labels and possible cross-contact before cooking.</p>
        <label>Preferred cooking time (minutes)
          <input type="number" min={5} max={240} step={1} value={draft.maxMinutes} disabled={saving}
            onChange={(event) => update("maxMinutes", event.target.value)} placeholder="30" />
        </label>
        <div className="food-preferences-actions">
          <button type="submit" className="planner-primary" disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
          {saved && <span role="status">Saved to your account.</span>}
        </div>
      </form>}
    </section>
  );
}
