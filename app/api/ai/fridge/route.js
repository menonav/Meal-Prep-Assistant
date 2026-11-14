import { NextResponse } from "next/server";
import { getAuth } from "../../../../lib/auth/server";
import { consumeAiQuota, hasPremiumAccess } from "../../../../lib/app-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ingredients", "recipes"],
  properties: {
    ingredients: { type: "array", items: { type: "string" } },
    recipes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "emoji", "time", "servings", "ingredients", "steps"],
        properties: {
          title: { type: "string" },
          emoji: { type: "string" },
          time: { type: "integer" },
          servings: { type: "integer" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "amount", "unit", "category"],
              properties: {
                name: { type: "string" },
                amount: { type: "number" },
                unit: { type: "string" },
                category: { type: "string" },
              },
            },
          },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

async function getUser() {
  try {
    const { data, error } = await getAuth().getSession({ query: { disableCookieCache: "true" } });
    if (error) return { response: NextResponse.json({ error: "Could not verify your session." }, { status: 503 }) };
    if (!data?.user?.id) return { response: NextResponse.json({ error: "Please log in again." }, { status: 401 }) };
    return { user: data.user };
  } catch {
    return { response: NextResponse.json({ error: "Account access is temporarily unavailable." }, { status: 503 }) };
  }
}

export async function POST(request) {
  const { user, response: authError } = await getUser();
  if (authError) return authError;
  try {
    if (!(await hasPremiumAccess(user))) {
      return NextResponse.json({ error: "Subscribe to Meal Prep Assistant Plus to use AI recipes from your fridge photo." }, { status: 402 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI recipes are not configured yet." }, { status: 503 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES + 64_000) {
      return NextResponse.json({ error: "Choose a photo smaller than 4 MB." }, { status: 413 });
    }
    const form = await request.formData();
    const image = form.get("photo");
    if (!image || typeof image.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Choose a fridge photo first." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type) || image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo smaller than 4 MB." }, { status: 400 });
    }
    const calls = await consumeAiQuota(user.id);
    if (calls === null) {
      return NextResponse.json({ error: "You’ve used today’s five AI recipe scans. Try again tomorrow." }, { status: 429 });
    }
    const bytes = Buffer.from(await image.arrayBuffer());
    const imageUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        store: false,
        max_output_tokens: 1800,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "You are Meal Prep Assistant. Inspect the fridge photo and identify only ingredients you can reasonably see; mark uncertain guesses in their wording. Suggest exactly three practical, tasty recipes that primarily use those visible ingredients. Return complete recipes with realistic preparation time, servings, measured ingredients, sensible shopping categories (Produce & pantry, Dairy, Meat & seafood, Frozen, or Spices), and numbered clear cooking steps. Use additional common pantry items sparingly. Never claim food is safe based on an image. Output only the requested structured data." },
            { type: "input_image", image_url: imageUrl, detail: "low" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "fridge_recipe_suggestions",
            strict: true,
            schema: recipeSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!upstream.ok) {
      const result = await upstream.json().catch(() => null);
      const code = result?.error?.code;
      const requestId = upstream.headers.get("x-request-id");
      const safeCode = typeof code === "string" && /^[a-z0-9_]{1,64}$/.test(code) ? code : "unknown";
      console.warn("[fridge-ai] API request failed", { status: upstream.status, code: safeCode, requestId });

      if (["invalid_image", "invalid_image_format", "invalid_base64_image", "image_parse_error", "unsupported_image_media_type"].includes(code)) {
        return NextResponse.json({ error: "The photo file couldn’t be read. Export it as a JPEG or PNG and try again." }, { status: 422 });
      }
      if (code === "insufficient_quota" || result?.error?.type === "insufficient_quota") {
        return NextResponse.json({ error: "Recipe scans are unavailable because the AI service has reached its API quota." }, { status: 503 });
      }
      if (upstream.status === 429) {
        return NextResponse.json({ error: "The AI service is busy. Try again in a minute." }, { status: 503 });
      }
      return NextResponse.json({ error: "The AI service couldn’t complete the scan." }, { status: 502 });
    }
    const payload = await upstream.json();
    const outputText = payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!outputText) return NextResponse.json({ error: "The AI didn’t return recipe ideas. Please try again." }, { status: 502 });
    const suggestions = JSON.parse(outputText);
    return NextResponse.json({ ...suggestions, remainingScans: Math.max(0, 5 - calls) });
  } catch {
    return NextResponse.json({ error: "AI recipe service is temporarily unavailable." }, { status: 503 });
  }
}
