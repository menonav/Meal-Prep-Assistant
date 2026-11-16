"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import "./planner.css";
import FridgeAssistant from "./fridge-assistant";
import FridgeInventory from "./fridge-inventory";
import FoodPreferences from "./food-preferences";
import CookingMode from "./cooking-mode";

const LEGACY_STORAGE_KEY = "meal-prep-assistant-plans-v1";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EMPTY_WEEK = { meals: [], extras: [], checked: {} };

function weekStartFor(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prettyDate(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

function formatAmount(amount) {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function shoppingItems(week, recipes) {
  const items = new Map();
  for (const meal of week.meals) {
    const recipe = meal.recipe || recipes.find((candidate) => candidate.id === meal.recipeId);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      const requiredAmount = ingredient.amount * (meal.servings / recipe.servings);
      const amount = requiredAmount - (ingredient.onHand === true ? ingredient.amount : 0);
      if (amount <= 0) continue;
      const key = `${ingredient.name.toLowerCase()}|${ingredient.unit}`;
      const existing = items.get(key);
      items.set(key, {
        key,
        name: ingredient.name,
        unit: ingredient.unit,
        category: ingredient.category,
        amount: amount + (existing?.amount || 0),
      });
    }
  }
  return [...items.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function initialsForDay(day) {
  return day.slice(0, 3).toUpperCase();
}

function hasSavedPlans(plans) {
  return Boolean(plans && typeof plans === "object" && Object.keys(plans).length);
}

export default function PlannerClient({ userId, premium, recipes }) {
  const [weekStart, setWeekStart] = useState(null);
  const [weekPlans, setWeekPlans] = useState({});
  const [tab, setTab] = useState("plan");
  const [fridgeScanVersion, setFridgeScanVersion] = useState(0);
  const [shoppingError, setShoppingError] = useState("");
  const [shoppingPending, setShoppingPending] = useState(false);
  const fridgeAssistant = useRef(null);
  const shoppingRequest = useRef(false);
  const [cooking, setCooking] = useState(null);
  const [selectedRecipes, setSelectedRecipes] = useState({});
  const [customItem, setCustomItem] = useState("");
  const [ready, setReady] = useState(false);
  const [syncMode, setSyncMode] = useState("loading");
  const [syncStatus, setSyncStatus] = useState("");
  const [legacyPlans, setLegacyPlans] = useState(null);
  const storageKey = `meal-prep-assistant-plans-v1:${userId}`;
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    const today = new Date();
    setWeekStart(weekStartFor(today));
    async function loadPlans() {
      let cachedPlans = {};
      let oldBrowserPlans = {};
      try {
        cachedPlans = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
        oldBrowserPlans = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
      } catch {
        cachedPlans = {};
        oldBrowserPlans = {};
      }
      try {
        const response = await fetch("/api/planner", { cache: "no-store" });
        if (response.ok) {
          const payload = await response.json();
          if (!active) return;
          if (hasSavedPlans(payload.plans)) {
            setWeekPlans(payload.plans);
            window.localStorage.setItem(storageKey, JSON.stringify(payload.plans));
          } else {
            setWeekPlans({});
            if (hasSavedPlans(oldBrowserPlans)) setLegacyPlans(oldBrowserPlans);
          }
          setSyncMode("cloud");
        } else {
          if (!active) return;
          setWeekPlans(hasSavedPlans(cachedPlans) ? cachedPlans : oldBrowserPlans);
          setSyncMode("local");
          setSyncStatus("Couldn’t reach account sync. Changes are saved in this browser.");
        }
      } catch {
        if (!active) return;
        setWeekPlans(hasSavedPlans(cachedPlans) ? cachedPlans : oldBrowserPlans);
        setSyncMode("local");
        setSyncStatus("Couldn’t reach account sync. Changes are saved in this browser.");
      } finally {
        if (active) setReady(true);
      }
    }
    loadPlans();
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!ready || syncMode === "loading") return;
    let active = true;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(weekPlans));
    } catch {
      // The server remains the source of truth when browser storage is unavailable.
    }
    if (syncMode !== "cloud") return;
    setSyncStatus("Saving to your account…");
    const timeout = window.setTimeout(async () => {
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (!active) return;
        try {
          const response = await fetch("/api/planner", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plans: weekPlans }),
          });
          if (!response.ok) throw new Error("save failed");
          if (active) setSyncStatus("Saved to your account.");
        } catch {
          if (active) setSyncStatus("Couldn’t sync right now. Your changes are still saved in this browser.");
        }
      });
    }, 450);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [weekPlans, ready, syncMode, storageKey]);

  function importLegacyPlans() {
    if (!legacyPlans) return;
    setWeekPlans(legacyPlans);
    setLegacyPlans(null);
    setSyncMode("cloud");
    setSyncStatus("Saving imported plan to your account…");
  }

  const currentKey = weekStart ? dateKey(weekStart) : "";
  const week = weekPlans[currentKey] || EMPTY_WEEK;
  const generatedItems = useMemo(() => premium ? shoppingItems(week, recipes) : [], [premium, week, recipes]);
  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const item of generatedItems) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    if (week.extras.length) groups.set("Added by you", week.extras);
    return [...groups.entries()];
  }, [generatedItems, week.extras]);

  function updateWeek(updater) {
    if (!currentKey) return;
    setWeekPlans((existing) => {
      const current = existing[currentKey] || EMPTY_WEEK;
      return { ...existing, [currentKey]: updater(current) };
    });
  }

  function changeWeek(offset) {
    setWeekStart((current) => {
      if (!current) return current;
      const next = new Date(current);
      next.setDate(next.getDate() + offset * 7);
      return next;
    });
  }

  function addMeal(dayIndex) {
    const recipeId = selectedRecipes[dayIndex];
    if (!recipeId) return;
    updateWeek((current) => ({
      ...current,
      meals: [...current.meals, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, dayIndex, recipeId, servings: 2 }],
    }));
    setSelectedRecipes((current) => ({ ...current, [dayIndex]: "" }));
  }

  function addAiMeal(recipe, dayIndex) {
    updateWeek((current) => ({
      ...current,
      meals: [...current.meals, {
        id: `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dayIndex,
        servings: recipe.servings,
        recipe: { ...recipe, id: `ai-${Date.now()}`, emoji: recipe.emoji || "🍽️" },
      }],
    }));
    setTab("plan");
  }

  function changeServings(mealId, amount) {
    updateWeek((current) => ({
      ...current,
      meals: current.meals.map((meal) => meal.id === mealId ? { ...meal, servings: Math.max(1, Math.min(12, meal.servings + amount)) } : meal),
    }));
  }

  function removeMeal(mealId) {
    updateWeek((current) => ({ ...current, meals: current.meals.filter((meal) => meal.id !== mealId) }));
  }

  async function toggleItem(item) {
    if (shoppingRequest.current) return;
    setShoppingError("");
    const checking = !week.checked[item.key];
    if (checking) {
      shoppingRequest.current = true;
      setShoppingPending(true);
      try {
        const response = await fetch("/api/fridge-inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name, purchased: true }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Couldn’t add this item to your fridge.");
        }
        setFridgeScanVersion((version) => version + 1);
      } catch (failure) {
        setShoppingError(failure.message || "Couldn’t add this item to your fridge.");
        return;
      } finally {
        shoppingRequest.current = false;
        setShoppingPending(false);
      }
    }
    updateWeek((current) => ({ ...current, checked: { ...current.checked, [item.key]: checking } }));
  }

  function addCustomItem(event) {
    event.preventDefault();
    const name = customItem.trim();
    if (!name) return;
    updateWeek((current) => ({
      ...current,
      extras: [...current.extras, { key: `custom-${Date.now()}`, name, category: "Added by you" }],
    }));
    setCustomItem("");
  }

  function removeCustomItem(key) {
    updateWeek((current) => ({ ...current, extras: current.extras.filter((item) => item.key !== key) }));
  }

  if (!ready || !weekStart) return <section className="planner-loading" aria-live="polite">Getting your week ready…</section>;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const plannedCount = week.meals.length;
  const checkedCount = generatedItems.filter((item) => week.checked[item.key]).length + week.extras.filter((item) => week.checked[item.key]).length;

  return (
    <main className="planner-page">
      {premium && cooking && <CookingMode recipe={cooking.recipe} servings={cooking.servings} premium={premium} onClose={() => setCooking(null)} />}
      <div className="planner-topline">
        <div>
          <p className="planner-eyebrow">A little plan goes a long way</p>
          <h1>Your week, made easier.</h1>
          <p className="planner-subtitle">Choose a few meals and build your weekly plan.</p>
        </div>
        <Link className="planner-back" href="/dashboard">← Your account</Link>
      </div>

      {premium ? <FridgeAssistant ref={fridgeAssistant} premium={premium} onAddRecipe={addAiMeal} onInventorySaved={() => setFridgeScanVersion((version) => version + 1)} /> : (
        <section className="fridge-assistant">
          <div className="fridge-heading"><div><h2>Meal Prep Assistant Plus</h2><p>Plus includes the shopping list, fridge scans, step-by-step cooking, and the AI coach.</p></div></div>
        </section>
      )}

      <div className="planner-controls">
        <div className="week-switcher" aria-label="Choose week">
          <button type="button" onClick={() => changeWeek(-1)} aria-label="Previous week">←</button>
          <span>{prettyDate(weekStart)} – {prettyDate(weekEnd, { month: "short", day: "numeric", year: "numeric" })}</span>
          <button type="button" onClick={() => changeWeek(1)} aria-label="Next week">→</button>
        </div>
        <div className="planner-tabs" role="tablist" aria-label="Meal planner views">
          <button type="button" role="tab" aria-selected={tab === "plan"} className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>Weekly plan <span>{plannedCount}</span></button>
          <button type="button" role="tab" disabled={!premium} aria-selected={premium && tab === "list"} className={premium && tab === "list" ? "active" : ""} onClick={() => setTab("list")}>Shopping list {premium ? <span>{checkedCount}/{generatedItems.length + week.extras.length}</span> : <span>Plus</span>}</button>
          {premium && <button type="button" role="tab" aria-selected={tab === "fridge"} className={tab === "fridge" ? "active" : ""} onClick={() => setTab("fridge")}>In fridge</button>}
          {premium && <button type="button" role="tab" aria-selected={tab === "preferences"} className={tab === "preferences" ? "active" : ""} onClick={() => setTab("preferences")}>Preferences</button>}
        </div>
      </div>

      {premium && <FridgeInventory open={tab === "fridge"} scanVersion={fridgeScanVersion} onOpen={() => setTab("fridge")} onFindRecipes={(id) => fridgeAssistant.current?.findRecipes(id)} />}

      {premium && tab === "preferences" && <FoodPreferences />}

      {!premium || tab === "plan" ? (
        <>
          <section className="planner-grid" aria-label="Meals by day">
            {DAYS.map((day, index) => {
              const meals = week.meals.filter((meal) => meal.dayIndex === index);
              return (
                <article className={`day-card${meals.length ? " has-meals" : ""}`} key={day}>
                  <div className="day-heading"><span className="day-monogram">{initialsForDay(day)}</span><div><h2>{day}</h2><p>{prettyDate(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index), { month: "long", day: "numeric" })}</p></div></div>
                  <div className="day-meals">
                    {meals.map((meal) => {
                      const recipe = meal.recipe || recipes.find((candidate) => candidate.id === meal.recipeId);
                      if (!recipe) return null;
                      return (
                        <div className="planned-meal" key={meal.id}>
                          <span className="meal-emoji" aria-hidden="true">{recipe.emoji}</span>
                          <div className="meal-info"><strong>{recipe.title}</strong><small>{recipe.time} min · {meal.servings} servings</small><div className="serving-controls"><button type="button" aria-label={`Decrease servings for ${recipe.title}`} onClick={() => changeServings(meal.id, -1)}>−</button><span>{meal.servings}</span><button type="button" aria-label={`Increase servings for ${recipe.title}`} onClick={() => changeServings(meal.id, 1)}>+</button></div>
                            {premium && <button type="button" className="start-cooking" aria-label={`Start cooking ${recipe.title}`} onClick={() => setCooking({ recipe, servings: meal.servings })}>Start cooking</button>}
                          </div>
                          <button className="remove-meal" type="button" onClick={() => removeMeal(meal.id)} aria-label={`Remove ${recipe.title}`}>×</button>
                        </div>
                      );
                    })}
                    {!meals.length && <p className="empty-day">Nothing planned yet</p>}
                  </div>
                  <form className="add-meal-form" onSubmit={(event) => { event.preventDefault(); addMeal(index); }}>
                    <label className="sr-only" htmlFor={`recipe-${index}`}>Choose a recipe for {day}</label>
                    <select id={`recipe-${index}`} value={selectedRecipes[index] || ""} onChange={(event) => setSelectedRecipes((current) => ({ ...current, [index]: event.target.value }))}>
                      <option value="">Add a meal…</option>
                      {recipes.map((recipe) => <option value={recipe.id} key={recipe.id}>{recipe.title}</option>)}
                    </select>
                    <button type="submit" disabled={!selectedRecipes[index]} aria-label={`Add meal to ${day}`}>+</button>
                  </form>
                </article>
              );
            })}
          </section>
          {premium && <div className="planner-tip"><span aria-hidden="true">✦</span><p><strong>Start small.</strong> Add the meals you know you’ll make; the list updates as you plan.</p><button type="button" onClick={() => setTab("list")}>See shopping list →</button></div>}
          <div className="planner-sync-notice" aria-live="polite">
            {legacyPlans && <p>We found a plan saved in this browser. <button type="button" onClick={importLegacyPlans}>Import it to this account</button></p>}
            <p className={syncMode === "local" ? "planner-storage-note" : "planner-sync-status"}>{syncMode === "cloud" ? (syncStatus || "Saved to your account.") : (syncStatus || "Loading your account plan…")}</p>
          </div>
        </>
      ) : (
        tab === "list" && <section className="shopping-panel">
          <div className="shopping-heading"><div><p className="planner-eyebrow">Everything in one place</p><h2>Your shopping list</h2><p>Check off an item to add it to your fridge.</p></div><span className="shopping-count">{generatedItems.length + week.extras.length} items</span></div>
          {shoppingError && <p role="alert" className="fridge-error">{shoppingError}</p>}
          {groupedItems.length ? <div className="shopping-groups">
            {groupedItems.map(([category, items]) => <section className="shopping-group" key={category}>
              <h3>{category}<span>{items.filter((item) => week.checked[item.key]).length}/{items.length}</span></h3>
              <ul>{items.map((item) => <li className={week.checked[item.key] ? "checked" : ""} key={item.key}>
                <label><input type="checkbox" checked={Boolean(week.checked[item.key])} disabled={shoppingPending} onChange={() => toggleItem(item)} /><span className="checkmark" aria-hidden="true">✓</span><span className="item-name">{item.name}</span></label>
                {typeof item.amount === "number" && <span className="item-amount">{formatAmount(item.amount)} {item.unit}</span>}
                {item.category === "Added by you" && <button className="remove-grocery" type="button" aria-label={`Remove ${item.name}`} onClick={() => removeCustomItem(item.key)}>×</button>}
              </li>)}</ul>
            </section>)}
          </div> : <div className="shopping-empty"><span aria-hidden="true">🛒</span><h3>{week.meals.length ? "Nothing to buy for your planned meals." : "Your list is waiting for a meal."}</h3>{!week.meals.length && <p>Add a recipe to your weekly plan and its ingredients will show up here.</p>}<button type="button" className="planner-primary" onClick={() => setTab("plan")}>Plan a meal</button></div>}
          <form className="custom-item-form" onSubmit={addCustomItem}><label className="sr-only" htmlFor="custom-grocery">Add a grocery item</label><input id="custom-grocery" value={customItem} onChange={(event) => setCustomItem(event.target.value)} placeholder="Add something else to your list" /><button type="submit" disabled={!customItem.trim()}>Add item</button></form>
          <div className="planner-sync-notice" aria-live="polite">
            {legacyPlans && <p>We found a plan saved in this browser. <button type="button" onClick={importLegacyPlans}>Import it to this account</button></p>}
            <p className={syncMode === "local" ? "planner-storage-note" : "planner-sync-status"}>{syncMode === "cloud" ? (syncStatus || "Saved to your account.") : (syncStatus || "Loading your account plan…")}</p>
          </div>
        </section>
      )}
    </main>
  );
}
