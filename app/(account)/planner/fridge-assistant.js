"use client";

import { useEffect, useState } from "react";

export default function FridgeAssistant({ premium, onAddRecipe, priceCents }) {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [remainingScans, setRemainingScans] = useState(null);
  const [pending, setPending] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [error, setError] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function scanFridge(event) {
    event.preventDefault();
    if (!photo || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    setRecipes([]);
    const form = new FormData();
    form.set("photo", photo);
    try {
      const response = await fetch("/api/ai/fridge", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not scan this photo.");
      setIngredients(payload.ingredients || []);
      setRecipes(payload.recipes || []);
      setRemainingScans(payload.remainingScans);
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setPending(false);
    }
  }

  async function startCheckout() {
    if (checkoutPending) return;
    setCheckoutPending(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Checkout is not available yet.");
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError.message);
      setCheckoutPending(false);
    }
  }

  function addRecipe(recipe) {
    onAddRecipe(recipe, dayIndex);
    setMessage(`${recipe.title} added to your plan.`);
  }

  return (
    <section className="fridge-assistant" aria-labelledby="fridge-title">
      <div className="fridge-heading">
        <div><p className="planner-eyebrow">Make something from what you have</p><h2 id="fridge-title">What’s in your fridge?</h2><p>Upload a photo and AI will spot ingredients and suggest three recipes.</p></div>
        {premium ? <span className="premium-badge">Premium access</span> : <span className="premium-price">${(priceCents / 100).toFixed(2)} one-time</span>}
      </div>

      {!premium ? (
        <div className="fridge-unlock"><p>Unlock photo-based recipe ideas and add them straight to your weekly plan.</p><button className="planner-primary" type="button" onClick={startCheckout} disabled={checkoutPending}>{checkoutPending ? "Opening checkout…" : `Unlock premium · $${(priceCents / 100).toFixed(2)}`}</button></div>
      ) : (
        <>
          <form className="fridge-upload-form" onSubmit={scanFridge}>
            <label className="fridge-file-label">Choose a fridge photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPhoto(event.target.files?.[0] || null); setError(""); }} /></label>
            {preview && <img className="fridge-photo-preview" src={preview} alt="Selected fridge contents" />}
            <button className="planner-primary" type="submit" disabled={!photo || pending}>{pending ? "Finding ingredients…" : "Find recipe ideas"}</button>
            <span className="fridge-usage">{remainingScans === null ? "Up to 5 scans per day" : `${remainingScans} scans left today`}</span>
          </form>
          <p className="fridge-privacy-note">The photo is sent securely for analysis and isn’t saved in your plan. AI can misread ingredients; check labels and food freshness yourself.</p>
        </>
      )}

      {error && <p className="fridge-error" role="alert">{error}</p>}
      {message && <p className="fridge-success" role="status">{message}</p>}
      {recipes.length > 0 && <div className="fridge-results">
        <div className="fridge-result-heading"><h3>Here’s what I spotted</h3><p>{ingredients.join(" · ")}</p></div>
        <label className="fridge-day-select">Add recipes to <select value={dayIndex} onChange={(event) => setDayIndex(Number(event.target.value))}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <div className="fridge-recipe-grid">{recipes.map((recipe, index) => <article className="fridge-recipe-card" key={`${recipe.title}-${index}`}>
          <p className="fridge-recipe-meta"><span>{recipe.emoji}</span> {recipe.time} min · serves {recipe.servings}</p>
          <h3>{recipe.title}</h3>
          <ul>{recipe.ingredients.map((ingredient, i) => <li key={`${ingredient.name}-${i}`}>{ingredient.amount} {ingredient.unit} {ingredient.name}</li>)}</ul>
          <ol>{recipe.steps.map((step, i) => <li key={`${i}-${step}`}>{step}</li>)}</ol>
          <button type="button" className="planner-primary" onClick={() => addRecipe(recipe)}>Add to { ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dayIndex] }</button>
        </article>)}</div>
      </div>}
    </section>
  );
}
