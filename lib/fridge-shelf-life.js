// Planning estimates for foods bought fresh and kept in the refrigerator.
// https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts
// https://extension.illinois.edu/sites/default/files/pennsylvania-produce-a-guide-to-quality-produce.pdf
// Conservative onion reminders, not a statement about how long an onion is safe.
// https://extension.colostate.edu/resource/colorado-onions-3/
// https://reallifegoodfood.umn.edu/vegetables/green-onions
const SHELF_LIFE = [
  [/^(?:(?:chopped|diced|sliced|peeled) )?(?:(?:green|spring|salad) onions?|scallions?)(?:,? (?:chopped|diced|sliced))?$/i, 4],
  [/^(?:(?:chopped|diced|sliced|peeled) (?:(?:red|yellow|white|sweet) )?onions?|(?:(?:red|yellow|white|sweet) )?onions?,? (?:chopped|diced|sliced|peeled))$/i, 5],
  [/^(?:(?:whole|fresh) )?(?:(?:red|yellow|white|sweet|brown|vidalia) )?onions?(?: \((?:red|yellow|white|sweet|brown)\))?$/i, 7],
  [/^(?:large |fresh |raw |whole )?(?:shell )?eggs?$/i, 21],
  [/^(?:hard[- ](?:boiled|cooked) )eggs?$/i, 7],
  [/^(?:raw |fresh )?chicken(?: (?:breasts?|thighs?|wings?|drumsticks?|tenders?|tenderloins?))?$/i, 1],
  [/^(?:raw |fresh )?ground (?:beef|chicken|turkey|pork)$/i, 1],
  [/^(?:raw |fresh )?(?:salmon|tuna|trout|cod)(?: fillets?)?$/i, 1],
  [/^(?:fresh |small |english )?cucumbers?$/i, 3],
  [/^(?:cooked )?(?:leftovers|chicken leftovers|turkey leftovers)$/i, 3],
  [/^(?:fresh )?shrimp$/i, 3],
  [/^(?:plain |greek |plain greek )?yogurt$/i, 7],
  [/^(?:whole |skim |low-fat |2% )?milk$/i, 7],
  [/^(?:fresh |baby )?spinach$/i, 3],
  [/^(?:(?:green|red|orange|yellow) )?bell peppers?$/i, 5],
  [/^(?:romaine |iceberg |leaf |head of )?lettuce$/i, 3],
  [/^(?:fresh )?cauliflower$/i, 3],
];

export function estimateShelfLife(name) {
  const key = name.trim().replace(/\s+/g, " ").replace(/^carton of /i, "");
  return SHELF_LIFE.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}
