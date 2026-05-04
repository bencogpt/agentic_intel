# Analysis Prompt — Step 2: Document Analysis

## Task
Analyze the intelligence assessment document provided below. Extract structured analytical components.

## Instructions
1. **Identify key claims** — list each major factual or analytical claim made in the document
2. **Identify assumptions** — both explicit ("we assume X") and implicit (unstated premises the argument depends on)
3. **Identify information gaps** — what does the assessment NOT address that would be critical to its validity?
4. **Flag single-source dependencies** — claims supported by only one source or one type of evidence
5. **Flag possible cognitive biases** — look for anchoring, confirmation bias, mirror imaging, groupthink

## Field Descriptions (read carefully before generating JSON)

**keyClaims fields:**
- `text` — the claim as stated or implied in the document (Hebrew)
- `confidence` — high | medium | low
- `confidenceReasoning` — explain in Hebrew WHY this confidence level: what evidence supports the claim, what undermines it, is it direct or indirect evidence, single-source or corroborated
- `riskIfWrong` — high | medium | low
- `riskReasoning` — explain in Hebrew what happens if this claim is incorrect: operational, strategic, or policy consequences
- `sourceCount` — number of distinct sources cited for this claim (0 if none)
- `sourceRefs` — array of strings: each string describes one source or piece of evidence from the document text. If no sources are cited, use ["No sources cited in the document for this claim"]

**assumptions fields:**
- `text` — the assumption (Hebrew)
- `type` — explicit | implicit
- `riskIfWrong` — high | medium | low
- `riskReasoning` — explain in Hebrew which conclusions break if this assumption is wrong and how badly

IMPORTANT: Never leave `confidenceReasoning`, `riskReasoning`, or `sourceRefs` empty. Every field must be populated.

## Output Format (JSON)

Respond with a single JSON code block. Do not include any text outside the code block.

```json
{
  "keyClaims": [
    {
      "id": "claim-1",
      "text": "...",
      "confidence": "high",
      "confidenceReasoning": "...",
      "riskIfWrong": "high",
      "riskReasoning": "...",
      "sourceCount": 0,
      "sourceRefs": ["..."]
    }
  ],
  "assumptions": [
    {
      "id": "assumption-1",
      "text": "...",
      "type": "implicit",
      "riskIfWrong": "medium",
      "riskReasoning": "..."
    }
  ],
  "informationGaps": ["..."],
  "singleSourceDependencies": ["claim-id-1"],
  "possibleBiases": [
    {
      "type": "confirmation_bias|anchoring|mirror_imaging|groupthink|other",
      "evidence": "..."
    }
  ],
  "suggestedAgents": ["agent-id-1", "agent-id-2", "agent-new-capability"],
  "entities": {
    "persons": [
      { "name": "...", "role": "...", "relevance": "high|medium|low" }
    ],
    "organizations": [
      { "name": "...", "type": "military|political|economic|ngo|other", "relevance": "high|medium|low" }
    ],
    "locations": [
      { "name": "...", "type": "country|city|region|site", "relevance": "high|medium|low" }
    ],
    "events": [
      { "description": "...", "date": "...", "relevance": "high|medium|low" }
    ]
  }
}
```

Also extract named entities from the document into the `entities` field. Only include entities that are directly relevant to the assessment's subject matter. Use Hebrew names where the document uses Hebrew.

## Available Agents
The following specialist agents are currently configured in the system:
{{AVAILABLE_AGENTS}}

For `suggestedAgents`: include agents from the list above that are relevant to this document's topic, AND include 2–3 additional agent types that would add analytical value but are **not** in the list above. Use lowercase hyphenated IDs for new agents (e.g. `agent-nuclear-expert`, `agent-cyber-analyst`). New agent suggestions tell the analyst which capabilities are missing from the system.

## Document
{{DOCUMENT}}
