"use client";

import { useEffect, useRef, useState } from "react";

const formatQuantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export default function CookingMode({ recipe, servings, premium, onClose }) {
  const dialog = useRef(null);
  const request = useRef(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");

  const steps = (recipe.steps ?? []).filter((step) => typeof step === "string" && step.trim());
  const step = steps[stepIndex];
  const finished = steps.length > 0 && stepIndex === steps.length;
  const ingredients = recipe.ingredients.map(({ name, amount, unit }) =>
    [formatQuantity.format(amount * servings / recipe.servings), unit === "each" ? "" : unit, name].filter(Boolean).join(" ")
  );

  useEffect(() => {
    const modal = dialog.current;
    modal.showModal();
    return () => {
      request.current?.abort();
      modal.close();
    };
  }, []);

  async function askCoach(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || request.current) return;

    const controller = new AbortController();
    request.current = controller;
    setWaiting(true);
    setError("");
    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          recipe: { title: recipe.title, servings, ingredients, step: step ?? "" },
          history: history.slice(-3),
          question: text,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.answer) throw new Error(data?.error || "The coach couldn’t answer. Try again.");
      setHistory((previous) => [...previous, { question: text, answer: data.answer }]);
      setQuestion("");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setWaiting(false);
    }
  }

  return (
    <dialog ref={dialog} className="cooking-dialog" aria-labelledby="cooking-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="cooking-header">
        <div>
          <p className="planner-eyebrow">Cooking mode</p>
          <h2 id="cooking-title">{recipe.title}</h2>
          <p>{servings} {servings === 1 ? "serving" : "servings"} · {recipe.time} min</p>
        </div>
        <button type="button" className="cooking-secondary" onClick={onClose} autoFocus>Close</button>
      </header>

      <details className="cooking-ingredients">
        <summary>Ingredients</summary>
        <ul>{ingredients.map((ingredient, i) => <li key={i}>{ingredient}</li>)}</ul>
      </details>

      <section className="cooking-step" aria-live="polite">
        {finished ? <><h3>Recipe complete</h3><p>You’ve reached the end of the recipe.</p></>
          : step ? <><h3>Step {stepIndex + 1} of {steps.length}</h3><p>{step}</p></>
            : <p>This saved meal has ingredients but no cooking steps.</p>}
      </section>
      {steps.length > 0 && <div className="cooking-nav">
        <button type="button" className="cooking-secondary" disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => i - 1)}>Previous</button>
        {finished ? <button type="button" className="planner-primary" onClick={onClose}>Back to planner</button>
          : <button type="button" className="planner-primary" onClick={() => setStepIndex((i) => i + 1)}>
            {stepIndex + 1 === steps.length ? "Finish cooking" : "Next step"}
          </button>}
      </div>}

      <section className="cooking-coach" aria-labelledby="cooking-coach-title">
        <h3 id="cooking-coach-title">Ask the coach</h3>
        {premium ? <>
          <div className="cooking-history" aria-live="polite">
            {history.map((turn, i) => <div className="cooking-answer" key={i}>
              <strong>{turn.question}</strong><p>{turn.answer}</p>
            </div>)}
          </div>
          <form onSubmit={askCoach}>
            <label htmlFor="cooking-question">Your question</label>
            <textarea id="cooking-question" rows={2} maxLength={500} value={question} disabled={waiting}
              onChange={(event) => setQuestion(event.target.value)} placeholder="Can I make this without an oven?" />
            <button type="submit" className="planner-primary" disabled={!question.trim() || waiting}>
              {waiting ? "Getting an answer…" : "Ask coach"}
            </button>
          </form>
          {waiting && <p role="status" className="sr-only">Getting an answer</p>}
          {error && <p role="alert" className="fridge-error">{error}</p>}
        </> : <p>The AI coach is included with Meal Prep Assistant Plus.</p>}
      </section>
    </dialog>
  );
}
