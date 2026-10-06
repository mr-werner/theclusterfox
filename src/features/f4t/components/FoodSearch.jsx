import { useState } from "react";
import { Search, Plus, LoaderCircle } from "lucide-react";
import { searchFoods } from "../../../services/food/usda";

export default function FoodSearch({ onAddFood }) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event) {
    event.preventDefault();

    if (!query.trim()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const results = await searchFoods(query);
      setFoods(results);
    } catch (err) {
      setError(err.message);
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(food) {
    onAddFood(food);
  }

  return (
    <section className="food-search">
      <form
        className="food-search-form"
        onSubmit={handleSearch}
      >
        <div className="food-search-input">
          <Search size={20} />

          <input
            type="text"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search for a food..."
          />

          <button type="submit" disabled={loading}>
            {loading ? (
              <LoaderCircle
                className="spin"
                size={20}
              />
            ) : (
              "Search"
            )}
          </button>
        </div>
      </form>

      {error && (
        <p className="food-search-error">{error}</p>
      )}

      {foods.length > 0 && (
        <div className="food-results">
          {foods.map((food) => (
            <div
              className="food-result"
              key={food.fdcId}
            >
              <div className="food-result-info">
                <strong>{food.description}</strong>

                <span>
                  {food.brandName ||
                    food.brandOwner ||
                    food.dataType ||
                    "USDA"}
                </span>

                <small>
                  {food.calories != null
                    ? `${Math.round(
                        food.calories
                      )} calories`
                    : "Calories unavailable"}

                  {food.householdServingFullText &&
                    ` • ${food.householdServingFullText}`}
                </small>
              </div>

              <button
                type="button"
                className="add-food-button"
                disabled={food.calories == null}
                onClick={() => handleAdd(food)}
              >
                <Plus size={17} />
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}