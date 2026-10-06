export function poundsToKg(pounds) {
  return pounds * 0.45359237;
}

export function caloriesPerMinute(met, weightLbs) {
  const weightKg = poundsToKg(weightLbs);

  return (met * 3.5 * weightKg) / 200;
}

export function minutesToBurnCalories(
  calories,
  met,
  weightLbs
) {
  const rate = caloriesPerMinute(met, weightLbs);

  if (!rate || rate <= 0) {
    return 0;
  }

  return calories / rate;
}

export function calculateDistance(minutes, speedMph) {
  if (!speedMph) {
    return null;
  }

  return speedMph * (minutes / 60);
}

export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}