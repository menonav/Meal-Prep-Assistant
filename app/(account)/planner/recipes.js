import "server-only";

export const RECIPES = [
  {
    id: "chickpea-bowl", title: "Crispy chickpea bowls", emoji: "🥙", time: 25, servings: 2,
    steps: [
      "Cook the rice according to the package directions.",
      "Drain, rinse, and pat dry the chickpeas. Sauté with a little oil over medium-high heat until golden, stirring occasionally.",
      "Dice the cucumber. Divide the rice into bowls, then top with the chickpeas, cucumber, and yogurt. Season to taste.",
    ],
    ingredients: [
      { name: "chickpeas", amount: 1, unit: "can", category: "Produce & pantry" },
      { name: "rice", amount: 1, unit: "cup", category: "Produce & pantry" },
      { name: "cucumber", amount: 1, unit: "each", category: "Produce & pantry" },
      { name: "plain yogurt", amount: 0.5, unit: "cup", category: "Dairy" },
    ],
  },
  {
    id: "tomato-pasta", title: "Creamy tomato pasta", emoji: "🍝", time: 20, servings: 2,
    steps: [
      "Cook the pasta according to the package directions. Reserve a little pasta water before draining.",
      "Halve the cherry tomatoes. Cook them in a skillet over medium heat until they soften, then stir in the spinach until it wilts.",
      "Add the cream and simmer gently for a few minutes. Toss with the pasta and loosen with a splash of pasta water if needed.",
    ],
    ingredients: [
      { name: "pasta", amount: 8, unit: "oz", category: "Produce & pantry" },
      { name: "cherry tomatoes", amount: 2, unit: "cups", category: "Produce & pantry" },
      { name: "spinach", amount: 2, unit: "cups", category: "Produce & pantry" },
      { name: "heavy cream", amount: 0.5, unit: "cup", category: "Dairy" },
    ],
  },
  {
    id: "veggie-fried-rice", title: "Easy veggie fried rice", emoji: "🍚", time: 18, servings: 2,
    steps: [
      "Cook the rice if needed, or use rice that was promptly refrigerated after cooking. Beat the eggs in a bowl.",
      "Heat a little oil in a large skillet. Scramble the eggs until set, transfer them to a plate, then cook the frozen vegetables according to the package directions.",
      "Add the rice and soy sauce. Stir-fry until the rice is steaming hot throughout, then fold in the eggs and serve.",
    ],
    ingredients: [
      { name: "rice", amount: 1.5, unit: "cup", category: "Produce & pantry" },
      { name: "frozen mixed vegetables", amount: 1, unit: "cup", category: "Frozen" },
      { name: "eggs", amount: 2, unit: "each", category: "Dairy" },
      { name: "soy sauce", amount: 2, unit: "tbsp", category: "Produce & pantry" },
    ],
  },
  {
    id: "chicken-wraps", title: "Chicken crunch wraps", emoji: "🌯", time: 22, servings: 2,
    steps: [
      "Slice the chicken into strips. Wash and shred the lettuce on a clean board separate from the raw chicken.",
      "Heat a little oil in a skillet over medium-high heat. Cook the chicken until the thickest piece reaches 165°F (74°C) on a food thermometer.",
      "Warm the tortillas. Add the chicken, lettuce, and cheese, then fold the wraps and serve.",
    ],
    ingredients: [
      { name: "chicken breast", amount: 10, unit: "oz", category: "Meat & seafood" },
      { name: "tortillas", amount: 2, unit: "each", category: "Produce & pantry" },
      { name: "lettuce", amount: 2, unit: "cups", category: "Produce & pantry" },
      { name: "shredded cheese", amount: 0.5, unit: "cup", category: "Dairy" },
    ],
  },
];
