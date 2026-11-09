// Example problems, grouped the way people look for them.

export const topics = [
  {
    id: "arithmetic",
    name: "Arithmetic",
    examples: ["3 + 4 × (2 + 6)^2 ÷ 8", "2/3 + 1/4", "(3/4) ÷ (5/8)", "sqrt(144) - 2^5", "15% of 80", "what percent of 80 is 20", "increase 45 by 12%"],
  },
  {
    id: "algebra",
    name: "Equations",
    examples: ["3(x - 2) = 2x + 5", "x/2 + 1/3 = 5/6", "|2x - 1| = 7", "sqrt(x + 3) = x - 3", "1/x + 1/2 = 3/4", "2^x = 32", "solve A = P(1 + rt) for t"],
  },
  {
    id: "quadratics",
    name: "Quadratics",
    examples: ["x^2 - 5x + 6 = 0", "2x^2 + 7x + 3 = 0", "x^2 + 2x - 4 = 0", "x^2 + x + 1 = 0", "x^3 - 6x^2 + 11x - 6 = 0", "factor 2x^2 + 7x + 3"],
  },
  {
    id: "inequalities",
    name: "Inequalities",
    examples: ["2x - 3 ≤ 7", "-3x + 1 > 7", "1 < 2x + 3 ≤ 9", "x^2 - 5x + 6 > 0", "(x - 1)/(x + 2) ≥ 0"],
  },
  {
    id: "systems",
    name: "Systems",
    examples: ["x + y = 5, x - y = 1", "2x + 3y = 12, 4x - y = 10", "x + y + z = 6, 2x - y + z = 3, x + 2y - z = 2", "y = x^2, y = x + 2", "x^2 + y^2 = 25, x + y = 7"],
  },
  {
    id: "simplify",
    name: "Simplify",
    examples: ["expand (2x - 1)(x + 4)", "expand (x + 3)^2", "factor x^3 - 6x^2 + 11x - 6", "simplify (x^2 - 1)/(x - 1)", "factor 6x^2y + 9xy^2"],
  },
  {
    id: "calculus",
    name: "Calculus",
    examples: [
      "derivative of x^2 sin(x)",
      "d/dx (x + 1)/(x - 1)",
      "derivative of sin(3x^2) at x = 0",
      "integral of x e^x",
      "integral of 2x/(x^2 + 1)",
      "integral from 0 to pi of sin(x)",
      "limit of sin(x)/x as x -> 0",
      "limit of (3x^2 + 1)/(2x^2 - x) as x -> infinity",
    ],
  },
  {
    id: "stats",
    name: "Statistics",
    examples: ["4, 8, 15, 16, 23, 42", "mean 72, 85, 90, 66, 85", "median 3, 9, 4, 7, 1, 8", "standard deviation 2, 4, 4, 4, 5, 5, 7, 9"],
  },
  {
    id: "graph",
    name: "Graphing",
    examples: ["y = x^2 - 4x + 3", "f(x) = x^3 - 3x", "graph sin(x) + cos(2x)", "y = 2x + 1", "x^2 + y^2 = 16", "graph 1/(x - 2)"],
  },
];

// The cheat sheet for typing math.
export const syntax = [
  ["Powers", "x^2", "x²"],
  ["Square root", "sqrt(x)", "√x"],
  ["Fractions", "(x + 1)/(x - 2)", "\\frac{x+1}{x-2}"],
  ["Multiply", "3x or 3*x", "3x"],
  ["Absolute value", "|x - 2|", "|x-2|"],
  ["Pi and e", "pi, e^x", "\\pi,\\ e^x"],
  ["Trig (radians)", "sin(x), cos 2x", "\\sin x"],
  ["Logs", "ln(x), log(x), log_2(x)", "\\ln x"],
  ["Inequalities", "<=, >=", "\\le,\\ \\ge"],
  ["Systems", "separate with commas", "x+y=5,\\ x-y=1"],
];
