# AVAR — Claude Code Instructions

## פרויקט
מערכת אימות הערכות מודיעיניות. שפת משתמש ראשית: עברית (RTL).

## כללי עבודה
- כל פלט מול משתמש — בעברית
- כל קוד — באנגלית (משתנים, פונקציות, הערות קוד)
- כל הערת קוד — בעברית ובאנגלית לפי ההקשר
- אין לשמור מסמכי הערכה בענן ללא הצפנה
- אין מפתחות API בצד לקוח

## ארכיטקטורה
- Frontend: React + RTL (Arabic/Hebrew support)
- Backend: Node.js API
- LLM: Claude API (claude-sonnet-4-20250514)
- Search: Pluggable — ראה /src/backend/search-backends/

## Skills & Agents
- מיומנויות: `/skills/` — md files, ראה סכמה ב-PRD
- סוכנים: `/agents/` — md files, ראה סכמה ב-PRD
- לפני הפעלת סוכן — קרא את קובץ ה-md שלו

## Security Rules
- Validate all user inputs
- No raw document content in logs
- Use parameterized queries only
- Auth required for all API endpoints

## Skill Creator Feature
- מיקום: `/src/frontend/components/SkillCreator/`
- הממשק יוביל אנליסט ב-5 צעדים ליצירת skill md חדש
