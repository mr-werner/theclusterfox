import { useState } from "react";
import { Check, LoaderCircle, Plus, Search, X } from "lucide-react";

import { searchFoods } from "../../../services/food/usda";

function foodToItem(food) {
  return {
    fdcId: food.fdcId,
    name: food.description,
    brand: food.brandName || food.brandOwner || food.dataType || "USDA",
    caloriesPerServing: Number(food.calories) || 0,
    servingDescription:
      food.householdServingFullText ||
      (food.servingSize ? `${food.servingSize} ${food.servingSizeUnit || ""}`.trim() : "1 serving"),
    servings: 1,
  };
}

export default function FoodSearch({ onAdd, addedKeys }) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [searched, setSearched] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");

  async function handleSearch(event) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;

    setLoading(true);
    setError("");
    try {
      setFoods(await searchFoods(text));
      setSearched(text);
    } catch (err) {
      setError(err.message);
      setFoods([]);
    } finally {
      setLoading(false);
    }
  }

  function clearResults() {
    setFoods([]);
    setSearched("");
    setQuery("");
  }

  function handleManual(event) {
    event.preventDefault();
    const calories = Number(manualCalories);
    if (!manualName.trim() || !(calories > 0)) return;
    onAdd({
      fdcId: null,
      name: manualName.trim(),
      brand: "Your entry",
      caloriesPerServing: calories,
      servingDescription: "1 serving",
      servings: 1,
    });
    setManualName("");
    setManualCalories("");
  }

  return (
    <div className="ff-search">
      <form className="ff-search-bar" onSubmit={handleSearch} role="search">
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search foods, like “banana” or “Big Mac”"
          aria-label="Search foods"
        />
        <button type="submit" className="ff-btn ff-btn-primary" disabled={loading || !query.trim()}>
          {loading ? <LoaderCircle className="spin" size={18} aria-label="Searching" /> : "Search"}
        </button>
      </form>

      <div className="ff-search-meta">
        <span>Nutrition data from USDA FoodData Central.</span>
        <button type="button" className="ff-link" onClick={() => setManualOpen(open => !open)} aria-expanded={manualOpen}>
          {manualOpen ? "Hide manual entry" : "Know the calories? Add it yourself"}
        </button>
      </div>

      {manualOpen && (
        <form className="ff-manual" onSubmit={handleManual}>
          <input
            type="text"
            value={manualName}
            onChange={event => setManualName(event.target.value)}
            placeholder="Food name"
            aria-label="Food name"
            maxLength={80}
          />
          <div className="ff-manual-cal">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={manualCalories}
              onChange={event => setManualCalories(event.target.value)}
              placeholder="Calories"
              aria-label="Calories per serving"
            />
            <span>cal</span>
          </div>
          <button type="submit" className="ff-btn" disabled={!manualName.trim() || !(Number(manualCalories) > 0)}>
            <Plus size={16} /> Add
          </button>
        </form>
      )}

      {error && <p className="ff-error" role="alert">{error}</p>}

      {searched && (
        <div className="ff-results">
          <div className="ff-results-head">
            <span>
              {foods.length ? `${foods.length} results for “${searched}”` : `No foods found for “${searched}”`}
            </span>
            <button type="button" className="ff-icon-btn" onClick={clearResults} aria-label="Close search results">
              <X size={17} />
            </button>
          </div>
          <ul>
            {foods.map(food => {
              const item = foodToItem(food);
              const added = addedKeys.has(food.fdcId);
              const unavailable = food.calories == null;
              return (
                <li key={food.fdcId} className="ff-result">
                  <div className="ff-result-info">
                    <strong>{food.description}</strong>
                    <span>
                      {item.brand}
                      {food.householdServingFullText && ` · ${food.householdServingFullText}`}
                    </span>
                  </div>
                  <span className="ff-result-cal">
                    {unavailable ? "—" : `${Math.round(food.calories)} cal`}
                  </span>
                  <button
                    type="button"
                    className={`ff-btn ff-btn-small ${added ? "is-done" : ""}`}
                    disabled={unavailable}
                    onClick={() => onAdd(item)}
                    aria-label={added ? `Add another ${food.description}` : `Add ${food.description}`}
                  >
                    {added ? <Check size={15} /> : <Plus size={15} />}
                    {added ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
