import { useNavigate } from "react-router-dom";
import { BookmarkCheck, BookmarkPlus, GraduationCap } from "lucide-react";

import { useShelf } from "../app/studyShelf";
import { studyDeckHref } from "../app/studyLinks";
import { openInApp } from "../lib/launchApp";
import "../styles/addToStudy.css";

// "Add to Study": puts this material on your StudyFox shelf as a link, so
// StudyFox can turn it into flashcards, quizzes and reviews. It takes the
// app's own text color, so it fits every app's look.
export default function AddToStudy({ app, deck, title, className = "", compact = false }) {
  const [on, toggle] = useShelf(app, deck, title);
  const navigate = useNavigate();
  const label = on ? "In Study" : "Add to Study";
  return (
    <span className={`add-study${on ? " is-on" : ""}${compact ? " is-compact" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="add-study-btn"
        onClick={e => {
          e.stopPropagation();
          toggle();
        }}
        aria-pressed={on}
        title={on ? `Remove "${title}" from StudyFox` : `Study "${title}" in StudyFox: flashcards, quizzes and spaced review`}
      >
        {on ? <BookmarkCheck size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}
        <span>{label}</span>
      </button>
      {on && (
        <button
          type="button"
          className="add-study-open"
          onClick={e => {
            e.stopPropagation();
            openInApp("studyfox", studyDeckHref(app, deck), navigate);
          }}
          title="Open it in StudyFox"
          aria-label="Open it in StudyFox"
        >
          <GraduationCap size={15} aria-hidden="true" />
          {!compact && <span>Study now</span>}
        </button>
      )}
    </span>
  );
}
