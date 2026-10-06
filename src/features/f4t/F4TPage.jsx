import { useMemo, useState } from "react";
import { ArrowLeft, Flame } from "lucide-react";
import { Link } from "react-router-dom";

import FoodSearch from "./components/FoodSearch";
import MealItem from "./components/MealItem";
import ExerciseResults from "./components/ExerciseResults";

export default function F4TPage() {
  const [meal, setMeal] = useState([]);
  const [weightLbs, setWeightLbs] = useState("");
  const [showResults, setShowResults] =
    useState(false);

  const totalCalories = useMemo(() => {
    return meal.reduce((total, item) => {
      return (
        total +
        item.caloriesPerServing * item.servings
      );
    }, 0);
  }, [meal]);

  function addFood(food) {
    const item = {
      id: crypto.randomUUID(),
      fdcId: food.fdcId,
      name: food.description,
      brand:
        food.brandName ||
        food.brandOwner ||
        food.dataType ||
        "USDA",
      caloriesPerServing: Number(food.calories),
      servingDescription:
        food.householdServingFullText ||
        (food.servingSize
          ? `${food.servingSize} ${
              food.servingSizeUnit || ""
            }`
          : "1 serving"),
      servings: 1,
    };

    setMeal((current) => [...current, item]);
    setShowResults(false);
  }

  function changeServings(id, servings) {
    setMeal((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, servings }
          : item
      )
    );

    setShowResults(false);
  }

  function removeFood(id) {
    setMeal((current) =>
      current.filter((item) => item.id !== id)
    );

    setShowResults(false);
  }

  function calculate() {
    if (!meal.length || Number(weightLbs) <= 0) {
      return;
    }

    setShowResults(true);
  }

  return (
    <main className="f4t-page">
      <nav className="f4t-nav">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} />
          Cluster Fox
        </Link>
      </nav>

      <section className="f4t-app">
        <header className="f4t-header">
          <div className="f4t-logo">
            <Flame size={31} />
          </div>

          <div>
            <p className="f4t-eyebrow">
              FUEL 4 THOUGHT
            </p>

            <h1>Is It Worth It?</h1>

            <p>
              Turn what you eat into something you
              can see, compare, and understand.
            </p>
          </div>
        </header>

        <section className="meal-builder">
          <div className="meal-builder-heading">
            <p className="f4t-section-label">
              FOOD
            </p>

            <h2>Add a snack or meal</h2>

            <p>
              Search USDA FoodData Central and add
              everything you ate.
            </p>
          </div>

          <FoodSearch onAddFood={addFood} />

          {meal.length > 0 && (
            <div className="meal">
              <div className="meal-heading">
                <h2>Your snack or meal</h2>

                <span>
                  {meal.length}{" "}
                  {meal.length === 1
                    ? "item"
                    : "items"}
                </span>
              </div>

              <div className="meal-items">
                {meal.map((item) => (
                  <MealItem
                    key={item.id}
                    item={item}
                    onChangeServings={
                      changeServings
                    }
                    onRemove={removeFood}
                  />
                ))}
              </div>

              <div className="meal-total">
                <span>Total</span>

                <strong>
                  {Math.round(
                    totalCalories
                  ).toLocaleString()}{" "}
                  <small>cal</small>
                </strong>
              </div>

              <div className="weight-section">
                <label htmlFor="weight">
                  Your weight
                </label>

                <div className="weight-input">
                  <input
                    id="weight"
                    type="number"
                    min="1"
                    value={weightLbs}
                    onChange={(event) => {
                      setWeightLbs(
                        event.target.value
                      );
                      setShowResults(false);
                    }}
                    placeholder="175"
                  />

                  <span>lbs</span>
                </div>
              </div>

              <button
                type="button"
                className="calculate-button"
                onClick={calculate}
                disabled={
                  !meal.length ||
                  Number(weightLbs) <= 0
                }
              >
                Is It Worth It?
              </button>
            </div>
          )}
        </section>

        {showResults && (
          <ExerciseResults
            calories={totalCalories}
            weightLbs={Number(weightLbs)}
          />
        )}
      </section>
    </main>
  );
}