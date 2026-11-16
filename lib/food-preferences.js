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
    if (candidate === " milk " && /\b(?:soy|oat|almond|coconut|rice|hemp|pea|cashew) milk\b/.test(ingredient)) return false;
    if (candidate === " butter " && /\b(?:nut|peanut|almond|cashew|sunflower seed|apple) butter\b/.test(ingredient)) return false;
    return candidate.trim() !== "" && ingredient.includes(candidate);
  });
}

const MEAT_AND_SEAFOOD = [
  "ham", "bacon", "pancetta", "prosciutto", "pork", "beef", "veal", "lamb", "mutton",
  "chicken", "turkey", "duck", "goose", "venison", "sausage", "salami", "pepperoni",
  "chorizo", "hamburger", "ground meat", "meatball", "fish", "anchovy", "anchovies", "tuna", "salmon",
  "cod", "tilapia", "trout", "sardine", "mackerel", "shrimp", "prawn", "crab", "lobster",
  "clam", "oyster", "mussel", "scallop", "octopus", "squid", "calamari", "shellfish",
  "gelatin", "gelatine", "lard", "tallow", "bone broth",
];
const ANIMAL_PRODUCTS = [
  "milk", "butter", "ghee", "cheese", "yogurt", "yoghurt", "whey", "casein", "cream",
  "egg", "mayonnaise", "mayo", "honey",
];

export function excludedRecipeFoods({ diet, allergies, avoid }) {
  const excluded = new Set([...allergies, ...avoid]);
  const diets = diet.map((entry) => entry.trim().toLowerCase());
  const vegan = diets.some((entry) => /^(vegan|strict vegan)$/.test(entry));
  const vegetarian = diets.some((entry) => /^(veg|vegetarian|lacto[- ]vegetarian|ovo[- ]vegetarian|lacto[- ]ovo[- ]vegetarian)$/.test(entry));
  if (vegan || vegetarian) MEAT_AND_SEAFOOD.forEach((food) => excluded.add(food));
  if (vegan) ANIMAL_PRODUCTS.forEach((food) => excluded.add(food));
  if (matchesListedFood("mayonnaise mayo", [...excluded]) || matchesListedFood("egg", [...excluded])) {
    excluded.add("mayo");
    excluded.add("mayonnaise");
  }
  return [...excluded];
}
