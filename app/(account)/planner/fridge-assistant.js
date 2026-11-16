"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FRIDGE_DAILY_LIMIT, MAX_PREVIOUS_RECIPE_TITLES } from "../../../lib/fridge-limits";

import { RECIPE_TYPES } from "../../../lib/recipe-types";

function ingredientMatchKey(name) {
  return name.trim().toLowerCase().replace(/^(carton|block|bag|bunch|head) of\s+/, "");
}

const FridgeAssistant = forwardRef(function FridgeAssistant({ premium, onAddRecipe, onInventorySaved }, ref) {
  const sectionRef = useRef(null);
  const photoInput = useRef(null);
  const busyRef = useRef(false);
  const preferencesRevision = useRef(0);
  const [recipeType, setRecipeType] = useState("meal");
  const [focusItemId, setFocusItemId] = useState(null);
  const [usingInventory, setUsingInventory] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [ideaSets, setIdeaSets] = useState([]);
  const [setIndex, setSetIndex] = useState(0);
  const [remainingScans, setRemainingScans] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [message, setMessage] = useState("");

  const { recipes = [], ingredients = [], selectedIngredient = null, hasAllergyPreferences = false } = ideaSets[setIndex] ?? {};

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function scanFridge({ regenerate = false, itemId = focusItemId, inventory = usingInventory } = {}) {
    if ((!photo && !itemId && !inventory) || busyRef.current) return;
    if (remainingScans === 0) {
      setError("You’re out of recipe requests for today. Try again tomorrow.");
      return;
    }
    const startedAtRevision = preferencesRevision.current;
    busyRef.current = true;
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("recipeType", recipeType);
    if (itemId) form.set("itemId", itemId);
    else if (inventory) form.set("source", "inventory");
    else form.set("photo", photo);
    if (regenerate) {
      form.set("previousTitles", JSON.stringify(ideaSets.flatMap((set) => set.recipes.map((recipe) => recipe.title)).slice(-MAX_PREVIOUS_RECIPE_TITLES)));
    }
    try {
      const response = await fetch("/api/ai/fridge", { method: "POST", body: form });
      const payload = await response.json();
      if (Number.isInteger(payload.remainingScans)) setRemainingScans(payload.remainingScans);
      if (startedAtRevision !== preferencesRevision.current) {
        if (payload.inventorySaved === true) onInventorySaved();
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Could not scan this photo.");
      const spotted = payload.ingredients || [];
      const spottedNames = new Set([...spotted, ...(payload.onHandIngredients || [])].map(ingredientMatchKey));
      for (const name of payload.pastMarkedIngredients || []) spottedNames.delete(ingredientMatchKey(name));
      const nextRecipes = payload.recipes.map((recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) => ({
          ...ingredient,
          onHand: spottedNames.has(ingredientMatchKey(ingredient.name)),
        })),
      }));
      const nextSet = { recipes: nextRecipes, ingredients: spotted, selectedIngredient: payload.selectedIngredient, hasAllergyPreferences: payload.hasAllergyPreferences };
      setFocusItemId(itemId);
      setUsingInventory(inventory);
      setIdeaSets((current) => regenerate ? [...current, nextSet] : [nextSet]);
      setSetIndex(regenerate ? ideaSets.length : 0);
      if (payload.inventorySaved === true) {
        onInventorySaved();
        if (spotted.length > 0) setMessage("Ingredients saved to In fridge.");
      } else if (payload.inventorySaved === false) {
        setError("Recipe ideas are ready, but your fridge list couldn’t be updated.");
      }
    } catch (scanError) {
      if (startedAtRevision === preferencesRevision.current) setError(scanError.message);
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  useImperativeHandle(ref, () => ({
    clearRecipeIdeas() {
      preferencesRevision.current += 1;
      setFocusItemId(null);
      setUsingInventory(false);
      setIdeaSets([]);
      setSetIndex(0);
      setError("");
      setMessage("Preferences updated. Find new recipe ideas to apply them.");
    },
    findRecipes(itemId) {
      sectionRef.current?.scrollIntoView({ block: "start" });
      scanFridge({ itemId, inventory: true });
    },
    findInventoryRecipes(targetDay) {
      sectionRef.current?.scrollIntoView({ block: "start" });
      if (busyRef.current) return;
      setDayIndex(targetDay);
      setPhoto(null);
      if (photoInput.current) photoInput.current.value = "";
      setUsingInventory(true);
      setFocusItemId(null);
      setIdeaSets([]);
      setSetIndex(0);
      scanFridge({ itemId: null, inventory: true });
    },
  }));

  function setIngredientOnHand(recipeIndex, ingredientIndex, onHand) {
    setIdeaSets((current) => current.map((set, index) => index !== setIndex ? set : {
      ...set,
      recipes: set.recipes.map((recipe, i) => i !== recipeIndex ? recipe : {
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient, j) =>
          j === ingredientIndex ? { ...ingredient, onHand } : ingredient
        ),
      }),
    }));
  }

  function chooseRecipeType(event) {
    if (busyRef.current) return;
    setRecipeType(event.target.value);
    setIdeaSets([]);
    setSetIndex(0);
    setError("");
    setMessage("");
  }

  function choosePhoto(event) {
    setPhoto(event.target.files?.[0] || null);
    setFocusItemId(null);
    setUsingInventory(false);
    setIdeaSets([]);
    setSetIndex(0);
    setError("");
    setMessage("");
  }

  function addRecipe(recipe) {
    onAddRecipe(recipe, dayIndex);
    setMessage(`${recipe.title} added to your plan.`);
  }

  return (
    <section ref={sectionRef} className="fridge-assistant" aria-labelledby="fridge-title">
      <div className="fridge-heading">
        <div><p className="planner-eyebrow">Make something from what you have</p><h2 id="fridge-title">What’s in your fridge?</h2><p>Upload a photo and AI will spot ingredients and suggest three recipes.</p></div>
      </div>

      {!premium ? (
        <p className="fridge-unlock" role="status">Fridge scans are included in your Meal Prep Assistant subscription. We couldn’t confirm access for this account.</p>
      ) : (
        <>
          <form className="fridge-upload-form" onSubmit={(event) => { event.preventDefault(); if (!ideaSets.length) scanFridge(); }}>
            <label className="fridge-file-label">Recipe type
              <select className="fridge-type-select" value={recipeType} disabled={pending} onChange={chooseRecipeType}>
                {RECIPE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="fridge-file-label">Choose a fridge photo<input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={choosePhoto} /></label>
            {preview && <img className="fridge-photo-preview" src={preview} alt="Selected fridge contents" />}
            {(ideaSets.length === 0) && <button className="planner-primary" type="submit" disabled={(!photo && !focusItemId && !usingInventory) || pending || remainingScans === 0}>{pending ? "Finding ideas…" : `Find ${recipeType} ideas${usingInventory ? " from my fridge" : ""}`}</button>}
            {FRIDGE_DAILY_LIMIT !== null && <span className="fridge-usage">{remainingScans === null ? `Up to ${FRIDGE_DAILY_LIMIT} recipe requests per day` : `${remainingScans} recipe requests left today`}</span>}
          </form>
          <p className="fridge-privacy-note">The photo is sent securely for analysis and isn’t saved in your plan. AI can misread ingredients; check labels and food freshness yourself.</p>
        </>
      )}

      {pending && <p role="status">Finding recipe ideas…</p>}
      {error && <p className="fridge-error" role="alert">{error}</p>}
      {message && <p className="fridge-success" role="status">{message}</p>}
      {recipes.length > 0 && <div className="fridge-results">
        <div className="fridge-result-heading">
          <h3>{selectedIngredient ? "Recipes with " + selectedIngredient : usingInventory ? "Ideas from your fridge" : "Here’s what I spotted"}</h3>
          {!usingInventory && <p>{ingredients.join(" · ")}</p>}
          {hasAllergyPreferences && <p>Check ingredient labels and possible cross-contact before cooking.</p>}
          <p>Before adding a recipe, check the ingredients you have enough of. The shopping list only adds what you still need.</p>
        </div>
        <div className="cooking-nav" aria-label="Recipe idea sets">
          <button type="button" className="cooking-secondary" disabled={pending || setIndex === 0} onClick={() => setSetIndex((index) => index - 1)}>Previous set</button>
          <span className="fridge-usage" role="status">Set {setIndex + 1} of {ideaSets.length}</span>
          {setIndex < ideaSets.length - 1 ? (
            <button type="button" className="cooking-secondary" disabled={pending} onClick={() => setSetIndex((index) => index + 1)}>Next set</button>
          ) : (
            <button type="button" className="cooking-secondary" disabled={pending || remainingScans === 0} onClick={() => scanFridge({ regenerate: true })}>
              {pending ? "Finding more ideas…" : "More recipe ideas"}
            </button>
          )}
        </div>
        {FRIDGE_DAILY_LIMIT !== null && <p className="fridge-privacy-note">Each new set uses one of your daily recipe requests. Revisiting earlier sets doesn’t use a scan.</p>}
        <label className="fridge-day-select">Add recipes to <select value={dayIndex} onChange={(event) => setDayIndex(Number(event.target.value))}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <div className="fridge-recipe-grid">{recipes.map((recipe, index) => <article className="fridge-recipe-card" key={`${recipe.title}-${index}`}>
          <p className="fridge-recipe-meta"><span>{recipe.emoji}</span> {recipe.time} min · serves {recipe.servings}</p>
          <h3>{recipe.title}</h3>
          <ul aria-label="Ingredients you have enough of">
            {recipe.ingredients.map((ingredient, i) => (
              <li key={`${ingredient.name}-${i}`}>
                <label>
                  <input type="checkbox" checked={ingredient.onHand} onChange={(event) => setIngredientOnHand(index, i, event.target.checked)} />
                  {" "}{ingredient.amount} {ingredient.unit} {ingredient.name}
                </label>
              </li>
            ))}
          </ul>
          <ol>{recipe.steps.map((step, i) => <li key={`${i}-${step}`}>{step}</li>)}</ol>
          <button type="button" className="planner-primary" onClick={() => addRecipe(recipe)}>Add to { ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dayIndex] }</button>
        </article>)}</div>
      </div>}
    </section>
  );
});

export default FridgeAssistant;
