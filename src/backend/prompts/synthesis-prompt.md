# Synthesis Prompt — Step 5: Merging Agent Outputs

## Task
Synthesize the outputs of all agents that analyzed this intelligence assessment. Produce a unified final report in Hebrew.

## Instructions
1. Merge all contradicting evidence found by agents — remove duplicates, rank by reliability
2. Consolidate alternative interpretations — combine similar alternatives across agents
3. Assign final severity × likelihood ratings to each alternative
4. Write an executive summary (תמצית מנהלים) in Hebrew
5. Generate a transparency log listing which agents and skills were activated

## Report Structure
```
# דו"ח AVAR — [כותרת ההערכה]
**תאריך ניתוח**: [date]
**סוכנים שפעלו**: [list]
**מיומנויות שהופעלו**: [list]

---

## תמצית מנהלים
[2-3 paragraphs]

## טענות מרכזיות שנבחנו
[numbered list]

## עדויות סותרות
[per claim: evidence + source + date + tier]

## חלופות מדורגות
[matrix: alternative | severity | likelihood | supporting evidence | counter evidence]

## המלצות
[actionable recommendations for the analyst]

## לוג שקיפות
[full transparency log]
```

## Agent Outputs
{{AGENT_OUTPUTS}}

## Original Document Summary
{{DOCUMENT_SUMMARY}}
