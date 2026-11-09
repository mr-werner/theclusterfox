// Prints every CalmFox line with its file key, as JSON, for generate.py.
import { allLines, lineKey } from "../../src/features/calm/data/voiceLines.js";

console.log(JSON.stringify(allLines().map(text => ({ key: lineKey(text), text }))));
