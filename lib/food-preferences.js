export const EMPTY_FOOD_PREFERENCES = {
  diet: [],
  allergies: [],
  avoid: [],
  maxMinutes: null,
};

export function normalizeFoodPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  function normalizeList(list) {
    if (!Array.isArray(list) || list.length > 12
      || list.some((item) => typeof item !== "string" || !item.trim() || item.length > 80)) return null;
    return [...new Map(list.map((item) => [item.trim().toLowerCase(), item.trim()])).values()];
  }

  const diet = normalizeList(value.diet);
  const allergies = normalizeList(value.allergies);
  const avoid = normalizeList(value.avoid);
  const { maxMinutes } = value;
  if (!diet || !allergies || !avoid
    || (maxMinutes !== null && (!Number.isInteger(maxMinutes) || maxMinutes < 5 || maxMinutes > 240))) return null;
  return { diet, allergies, avoid, maxMinutes };
}

// A literal check catches obvious matches. Other names and derivatives still
// require label review.
export function matchesListedFood(name, foods) {
  function key(text) {
    return " " + text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
      .replace(/\b([a-z]{3,})s\b/g, "$1") + " ";
  }

  const ingredient = key(name);
  return foods.some((food) => {
    const candidate = key(food);
    return candidate.trim() !== "" && ingredient.includes(candidate);
  });
}
