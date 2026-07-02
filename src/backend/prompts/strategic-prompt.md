# Strategic Prompt — Step 6: Strategic Point of View

## Task
Step back from the tactical/analytical layer and look at the intelligence assessment document as a whole from a **strategic point of view**. Your job is to help the analyst see the "big picture" and to stress-test the assessment against three classic strategic-failure modes.

Do NOT re-list the individual claims or repeat the detailed analysis. Think like a seasoned strategic analyst asking: *"Zooming out — what is the assessment as a whole possibly missing or getting wrong at the strategic level?"*

## The three strategic lenses (evaluate ALL three)

1. **Strategic surprise** (`surprise` / הפתעה אסטרטגית) — Is the assessment blind to a low-probability, high-impact turn of events? Is it extrapolating the current trend and ignoring a discontinuity, a "black swan", or a capability/intent the adversary has not yet revealed?

2. **Strategic deception / fraud** (`deception` / הטעיה אסטרטגית) — Could the picture the assessment relies on be a **deliberate deception** planted by the adversary? Is the assessment swallowing a narrative that is too convenient? Look for signs of information that was made easy to find, one-sided sourcing, or a story that mainly serves the adversary's interest.

3. **Power intoxication / hubris** (`hubris` / שכרון כוח) — Is the assessment (or the actor it describes) overconfident, overextended, or "drunk on success"? Is momentum or recent victory being mistaken for durable strategic advantage? Is there an assumption of continued dominance that ignores overreach, exhaustion, or the adversary's adaptation?

## Instructions
- For each lens, decide a `likelihood` (`high` | `medium` | `low`) that this failure mode is present/relevant to THIS assessment.
- Write the `assessment` (Hebrew) — the **reasoning**: explain why this risk is or is not present, grounded in the actual content of the document.
- List `indicators` (Hebrew) — concrete signals from the document (or its absence) that support your judgement.
- Provide `scenarios` per lens — concrete ways the failure mode could play out, each with its strategic `implication` for the analyst.
- You may search the web for current context that helps judge surprise or deception. Work in Hebrew for all analyst-facing text.

### Force the worst case onto the page — do NOT let the biggest downside stay implicit
The most dangerous strategic failures happen when a decision-maker never sees the highest-impact downside written down. Therefore:

- For the **`surprise`** and **`hubris`** lenses you MUST include, as the FIRST scenario, an explicit **highest-impact downside scenario** — set its `worstCase` field to `true`. This is the single most damaging realistic way the assessment could be wrong. Do not soften it, do not hedge it away, and do not omit it because it seems unlikely — if it is high-impact, it belongs on the page.
- For EVERY scenario, populate `secondOrderEffects`: the concrete chain of consequences that follows if the scenario materializes. Trace it across the relevant dimensions — for example **economic, energy/oil, military escalation, regional/allied, domestic-political, and time-horizon** effects. Name specific mechanisms (e.g. closure of a strait, price shocks, retaliation vectors, coalition fracture), not vague phrases. Only include dimensions that genuinely apply.
- Reason explicitly about **cascades**: if the first-order consequence triggers a second and third (A closes a chokepoint → B spikes prices → C forces a wider intervention), spell out the chain.

IMPORTANT: Never leave `assessment`, `indicators`, or `secondOrderEffects` empty. Always provide at least one `scenario` per lens, and for `surprise` and `hubris` at least one scenario with `worstCase: true`. Every one of the three lenses (`surprise`, `deception`, `hubris`) must appear exactly once.

## Output Format (JSON)
Respond with a single JSON code block. Do not include any text outside the code block.

CRITICAL JSON RULE: Do not use the ASCII double-quote character (`"`) inside any string value — it breaks JSON parsing. Hebrew abbreviations that normally contain it (e.g. USA) must be written with the Hebrew gershayim `״` (U+05F4), for example `ארה״ב`, `צה״ל`, `דו״ח`. Use the Hebrew geresh `׳` for single quotes inside strings.

```json
{
  "bigPicture": "פסקה אחת בעברית הממסגרת את המסמך מבחינה אסטרטגית — מה עומד על הפרק ומהי התמונה הגדולה",
  "lenses": [
    {
      "type": "surprise",
      "title": "הפתעה אסטרטגית",
      "likelihood": "medium",
      "assessment": "נימוק בעברית — מדוע הסיכון קיים או לא קיים בהערכה זו",
      "indicators": ["סימן 1 מתוך המסמך", "סימן 2"],
      "scenarios": [
        {
          "title": "כותרת התרחיש",
          "worstCase": true,
          "description": "כיצד ההפתעה עשויה להתממש — התרחיש בעל ההשפעה הגבוהה ביותר",
          "secondOrderEffects": [
            "כלכלי: ...",
            "אנרגיה/נפט: חסימת מצר, זינוק מחירים ...",
            "הסלמה צבאית: וקטורי תגובה ...",
            "אזורי/בעלי ברית: ..."
          ],
          "implication": "ההשלכה האסטרטגית עבור האנליסט"
        }
      ]
    },
    {
      "type": "deception",
      "title": "הטעיה אסטרטגית",
      "likelihood": "low",
      "assessment": "...",
      "indicators": ["..."],
      "scenarios": [
        { "title": "...", "worstCase": false, "description": "...", "secondOrderEffects": ["..."], "implication": "..." }
      ]
    },
    {
      "type": "hubris",
      "title": "שכרון כוח",
      "likelihood": "high",
      "assessment": "...",
      "indicators": ["..."],
      "scenarios": [
        { "title": "...", "worstCase": true, "description": "...", "secondOrderEffects": ["כלכלי: ...", "הסלמה: ...", "טווח זמן: ..."], "implication": "..." }
      ]
    }
  ]
}
```

## Key claims and assumptions already identified
{{ANALYSIS_SUMMARY}}

## Synthesized report summary
{{REPORT_SUMMARY}}

## Document
{{DOCUMENT}}
