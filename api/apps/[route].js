// One function for the apps whose server side is small, so the site stays
// within the Vercel plan's function limit (12 on Hobby). Each app's
// endpoints live in its own folder as _files (Vercel skips those).
//
//   /api/apps/books?q=&page=      BookFox: search all of Project Gutenberg
//   /api/apps/book?id=            BookFox: one book, with its summary
//   /api/apps/standard            BookFox: newest from Standard Ebooks
//   /api/apps/book-text?id=&part= BookFox: a book's text, ready to read
//   /api/apps/food-search?q=      F4T (also answers at /api/f4t/food-search)
//   /api/apps/overpass  (POST)    OpenStreetMap data for every app, when the
//                                 browser can't reach Overpass itself

import { book, bookText, books, standard } from "../book/_books.js";
import foodSearch from "../f4t/_food-search.js";
import overpass from "./_overpass.js";

const ROUTES = { books, book, standard, "book-text": bookText, "food-search": foodSearch, overpass };

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  try {
    return await route(req, res);
  } catch (error) {
    console.error(`/api/apps/${req.query.route}:`, error);
    return res.status(502).json({ error: "The book source didn't answer. Try again in a moment." });
  }
}
