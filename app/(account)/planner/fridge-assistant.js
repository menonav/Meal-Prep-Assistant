"use client";

import { useEffect, useState } from "react";
import { FRIDGE_DAILY_LIMIT } from "../../../lib/fridge-limits";

function ingredientMatchKey(name) {
  return name.trim().toLowerCase().replace(/^(carton|block|bag|bunch|head) of\s+/, "");
}

export default function FridgeAssistant({ premium, onAddRecipe, onInventorySaved }) {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [ideaSets, setIdeaSets] = useState([]);
  const [setIndex, setSetIndex] = useState(0);
  const [remainingScans, setRemainingScans] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [message, setMessage] = useState("");

  const { recipes = [], ingredients = [] } = ideaSets[setIndex] ?? {};

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function scanFridge(isRegeneration = false) {
    if (!photo || pending || remainingScans === 0) return;
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("photo", photo);
    if (isRegeneration) {
      form.set("previousTitles", JSON.stringify(ideaSets.flatMap((set) => set.recipes.map((recipe) => recipe.title))));
    }
    try {
      const response = await fetch("/api/ai/fridge", { method: "POST", body: form });
      const payload = await response.json();
      if (Number.isInteger(payload.remainingScans)) setRemainingScans(payload.remainingScans);
      if (!response.ok) throw new Error(payload.error || "Could not scan this photo.");
      const spotted = payload.ingredients || [];
      const spottedNames = new Set(spotted.map(ingredientMatchKey));
      const nextRecipes = payload.recipes.map((recipe) => ({
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) => ({
          ...ingredient,
          onHand: spottedNames.has(ingredientMatchKey(ingredient.name)),
        })),
      }));
      const nextSet = { recipes: nextRecipes, ingredients: spotted };
      setIdeaSets((current) => isRegeneration ? [...current, nextSet] : [nextSet]);
      setSetIndex(isRegeneration ? ideaSets.length : 0);
      if (payload.inventorySaved === true) {
        onInventorySaved();
        if (spotted.length > 0) setMessage("Ingredients saved to In fridge.");
      } else if (payload.inventorySaved === false) {
        setError("Recipe ideas are ready, but your fridge list couldn’t be updated.");
      }
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setPending(false);
    }
  }

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

  function choosePhoto(event) {
    setPhoto(event.target.files?.[0] || null);
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
    <section className="fridge-assistant" aria-labelledby="fridge-title">
      <div className="fridge-heading">
        <div><p className="planner-eyebrow">Make something from what you have</p><h2 id="fridge-title">What’s in your fridge?</h2><p>Upload a photo and AI will spot ingredients and suggest three recipes.</p></div>
      </div>

      {!premium ? (
        <p className="fridge-unlock" role="status">Fridge scans are included in your Meal Prep Assistant subscription. We couldn’t confirm access for this account.</p>
      ) : (
        <>
          <form className="fridge-upload-form" onSubmit={(event) => { event.preventDefault(); if (!ideaSets.length) scanFridge(); }}>
            <label className="fridge-file-label">Choose a fridge photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={choosePhoto} /></label>
            {preview && <img className="fridge-photo-preview" src={preview} alt="Selected fridge contents" />}
            {ideaSets.length === 0 && <button className="planner-primary" type="submit" disabled={!photo || pending || remainingScans === 0}>{pending ? "Finding ingredients…" : "Find recipe ideas"}</button>}
            <span className="fridge-usage">{remainingScans === null ? `Up to ${FRIDGE_DAILY_LIMIT} scans per day` : `${remainingScans} scans left today`}</span>
          </form>
          <p className="fridge-privacy-note">The photo is sent securely for analysis and isn’t saved in your plan. AI can misread ingredients; check labels and food freshness yourself.</p>
        </>
      )}

      {error && <p className="fridge-error" role="alert">{error}</p>}
      {message && <p className="fridge-success" role="status">{message}</p>}
      {recipes.length > 0 && <div className="fridge-results">
        <div className="fridge-result-heading">
          <h3>Here’s what I spotted</h3>
          <p>{ingredients.join(" · ")}</p>
          <p>Before adding a recipe, check the ingredients you have enough of. The shopping list only adds what you still need.</p>
        </div>
        <div className="cooking-nav" aria-label="Recipe idea sets">
          <button type="button" className="cooking-secondary" disabled={pending || setIndex === 0} onClick={() => setSetIndex((index) => index - 1)}>Previous set</button>
          <span className="fridge-usage" role="status">Set {setIndex + 1} of {ideaSets.length}</span>
          {setIndex < ideaSets.length - 1 ? (
            <button type="button" className="cooking-secondary" disabled={pending} onClick={() => setSetIndex((index) => index + 1)}>Next set</button>
          ) : (
            <button type="button" className="cooking-secondary" disabled={pending || remainingScans === 0} onClick={() => scanFridge(true)}>
              {pending ? "Finding more ideas…" : "More recipe ideas"}
            </button>
          )}
        </div>
        <p className="fridge-privacy-note">Generating a new set uses one daily scan. Revisiting earlier sets doesn’t use a scan.</p>
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
}
