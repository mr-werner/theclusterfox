export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const query = req.query.q?.trim();

  if (!query) {
    return res.status(400).json({
      error: "A food search query is required.",
    });
  }

  const apiKey = process.env.USDA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "USDA API key is not configured.",
    });
  }

  try {
    const url = new URL(
      "https://api.nal.usda.gov/fdc/v1/foods/search"
    );

    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", "12");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `USDA request failed with status ${response.status}`
      );
    }

    const data = await response.json();

    const foods = (data.foods ?? []).map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      brandName: food.brandName ?? null,
      brandOwner: food.brandOwner ?? null,
      dataType: food.dataType,
      servingSize: food.servingSize ?? null,
      servingSizeUnit: food.servingSizeUnit ?? null,
      householdServingFullText:
        food.householdServingFullText ?? null,
      calories: findCalories(food.foodNutrients),
    }));

    return res.status(200).json({
      query,
      totalHits: data.totalHits ?? foods.length,
      foods,
    });
  } catch (error) {
    console.error("USDA FoodData Central error:", error);

    return res.status(500).json({
      error: "Unable to search USDA FoodData Central.",
    });
  }
}

function findCalories(nutrients = []) {
  const energy = nutrients.find(
    (item) =>
      item.nutrientId === 1008 ||
      item.nutrientName === "Energy"
  );

  return energy?.value ?? null;
}