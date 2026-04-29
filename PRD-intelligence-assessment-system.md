# PRD: מערכת הערכה ואימות מודיעינית (Intelligence Assessment Validation System)
**Version:** 1.0  
**Date:** 2026-04-21  
**Status:** Draft  
**Primary Language:** Hebrew (עברית)  
**Document Type:** Claude Code Project Requirements Document

---

## הנחות בסיס (Baseline Assumptions)

> הנחות אלו התקבלו בהיעדר מפרט מפורש. יש לאשר או לתקן לפני פיתוח.

| נושא | הנחה |
|---|---|
| Deployment | Web-based interface built on Claude Code philosophy |
| Search Tools | Open web search + extensible OSINT hooks (pluggable) |
| Output Format | Structured Markdown reports + Interactive UI |
| Skill/Agent Storage | `.md` files in local directory, mirroring Claude Code's SKILLS pattern |
| Language | Hebrew primary, English secondary (UI, prompts, outputs) |
| Classification | System is designed for unclassified / open-source intelligence workflows by default; classified deployment is a future consideration |

---

## 1. סקירה כללית (Executive Overview)

### 1.1 שם המוצר
**AVAR** — *Agentic Validation and Assessment Review*  
(מערכת סקירה ואימות הערכות מודיעיניות)

### 1.2 חזון המוצר
AVAR מביאה את הפילוסופיה של Claude Code — עבודה עם סוכנים, מיומנויות מוגדרות, ולולאת משוב רציפה — אל עולם המחקר המודיעיני.

כשם שמפתח תוכנה עובד עם Claude Code כדי לאמת, לבחון ולשפר קוד, האנליסט המודיעיני יעבוד עם AVAR כדי לאמת, לבחון ולחדד הערכות מודיעיניות — לזהות עדויות סותרות, חלופות שלא נלקחו בחשבון, וחורים בהיגיון האנליטי.

### 1.3 הצהרת הבעיה
אנליסטים מודיעיניים כותבים הערכות בתנאי לחץ, עם מידע חלקי ונטיות קוגניטיביות טבעיות. אין להם כלי אוטומטי שיאתגר את ההנחות שלהם, יחפש עדויות סותרות, ויציג חלופות מדורגות בצורה שיטתית — כפי שמנהל בכיר או "devil's advocate" מוסדי היה עושה.

### 1.4 המשתמשים היעד
- **אנליסט מודיעיני** (משתמש ראשי) — כותב הערכות ועובד עם המערכת
- **מנהל צוות אנליטי** — מגדיר ומנהל את מאגר המיומנויות והסוכנים
- **קורא/מאמת הערכה** — צורך את תוצרי המערכת

---

## 2. מטרות ומדדי הצלחה (Goals & Success Metrics)

### 2.1 מטרות עסקיות
1. צמצום נקודות עיוורון אנליטיות בהערכות מודיעיניות
2. הגברת האמינות האפיסטמית של ההערכות
3. קיצור זמן סקירת עמיתים (peer review)
4. יצירת תרבות של "red teaming" שיטתי בצוותים אנליטיים

### 2.2 מטרות מוצר
1. מערכת תפעל בעברית כשפה ראשית
2. זמן עיבוד ראשוני של מסמך הערכה < 2 דקות
3. כל ממצא יגיע עם עדויות מקושרות ומדורגות
4. האנליסט יוכל להגדיר מיומנות חדשה תוך פחות מ-5 דקות

### 2.3 מדדי הצלחה (KPIs)
| מדד | יעד |
|---|---|
| אימוץ שבועי על ידי אנליסטים | ≥ 80% מהצוות |
| דירוג שביעות רצון (1-5) | ≥ 4.0 |
| אחוז חלופות שנמצאו רלוונטיות | ≥ 60% |
| זמן תגובה לשאילתת אנליסט | < 30 שניות |

---

## 3. User Stories

### 3.1 זרימת עבודה ראשית
```
AS אנליסט מודיעיני
I WANT להעלות את מסמך ההערכה שלי למערכת
SO THAT המערכת תזהה חורים אנליטיים, עדויות סותרות וחלופות שלא שקלתי
```

### 3.2 ניהול מיומנויות וסוכנים
```
AS מנהל צוות אנליטי
I WANT להגדיר סוכנים עם תחומי מומחיות ספציפיים (כגון: מומחה לבנון, מומחה שיעה)
SO THAT כל הערכה תיבחן על ידי הסוכן הרלוונטי לתחומה
```

### 3.3 יצירת מיומנות
```
AS אנליסט
I WANT ליצור מיומנות חדשה מהממשק ולערוך את קובץ ה-md שלה
SO THAT אוכל לכוון את מיקוד הניתוח לתחום שאני מתמחה בו
```

### 3.4 שקיפות תהליך
```
AS אנליסט
I WANT לדעת אילו סוכנים ומיומנויות הופעלו על ההערכה שלי
SO THAT אבין את הלוגיקה מאחורי הממצאים
```

### 3.5 תוצר מדורג
```
AS אנליסט
I WANT לקבל חלופות מדורגות לפי חומרה והסתברות
SO THAT אוכל להחליט אילו חלופות לשלב בהערכה המעודכנת
```

---

## 4. דרישות פונקציונליות (Functional Requirements)

### 4.1 קליטת מסמך הערכה (FR-01)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-01.1 | המערכת תאפשר העלאת מסמך הערכה בפורמטים: `.md`, `.txt`, `.docx`, `.pdf` | חובה |
| FR-01.2 | המערכת תאפשר הזנת טקסט ישיר בממשק (paste) | חובה |
| FR-01.3 | המערכת תציג אישור קליטה ותפרוס תמצית אוטומטית של המסמך | חובה |
| FR-01.4 | המערכת תזהה את שפת המסמך (עברית/אנגלית/ערבית) ותפעל בהתאם | חובה |

### 4.2 ניתוח מסמך (FR-02)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-02.1 | המערכת תזהה את הטענות המרכזיות (key claims) בהערכה | חובה |
| FR-02.2 | המערכת תזהה הנחות בסיס (assumptions) — מפורשות וסמויות | חובה |
| FR-02.3 | המערכת תזהה פערי מידע (information gaps) | חובה |
| FR-02.4 | המערכת תזהה נקודות הסתמכות על מקורות יחידים (single-source dependencies) | גבוהה |
| FR-02.5 | המערכת תזהה הטיות קוגניטיביות אפשריות (anchoring, confirmation bias) | בינונית |

### 4.3 מחקר ואיסוף עדויות (FR-03)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-03.1 | המערכת תפעיל כלי חיפוש (search tool) לאיתור מידע גלוי (OSINT) הרלוונטי לטענות ההערכה | חובה |
| FR-03.2 | המערכת תחפש במקורות עדויות סותרות לכל טענה מרכזית | חובה |
| FR-03.3 | המערכת תשייך כל עדות למקור ותציין תאריך פרסום | חובה |
| FR-03.4 | המערכת תדרג אמינות מקורות (tier 1-3) לפי קריטריונים מוגדרים | גבוהה |
| FR-03.5 | המערכת תתמוך בכלי חיפוש מרובים (pluggable search backends) | גבוהה |
| FR-03.6 | חיפוש בשפות: עברית, אנגלית, ערבית | גבוהה |

### 4.4 הפקת חלופות (FR-04)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-04.1 | המערכת תציע חלופות פרשנות לכל טענה מרכזית שנמצאה בעייתית | חובה |
| FR-04.2 | כל חלופה תכלול: תיאור, עדויות תומכות, עדויות נגד, דירוג | חובה |
| FR-04.3 | דירוג חלופות יכלול שני ממדים: **חומרה** (severity) ו-**הסתברות** (likelihood) | חובה |
| FR-04.4 | דירוג יוצג בטבלה ובמטריצת סיכון ויזואלית | גבוהה |
| FR-04.5 | האנליסט יוכל לסמן חלופה כ"נדחתה עם נימוק" ולשמור | גבוהה |

### 4.5 מערכת מיומנויות (Skills) (FR-05)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-05.1 | מיומנות מוגדרת בקובץ `.md` עם סכמה מוגדרת (ראה סעיף 6) | חובה |
| FR-05.2 | המערכת תכלול מאגר מיומנויות ברירת מחדל (ראה סעיף 6.2) | חובה |
| FR-05.3 | האנליסט יוכל לערוך קובץ מיומנות קיים מהממשק | חובה |
| FR-05.4 | האנליסט יוכל ליצור מיומנות חדשה — ה-skill creator יסייע בכתיבת הקובץ | חובה |
| FR-05.5 | מיומנויות ניתנות להפעלה ידנית ולהפעלה אוטומטית לפי זיהוי תחום | חובה |

### 4.6 מערכת סוכנים (Agents) (FR-06)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-06.1 | סוכן מוגדר בקובץ `.md` — כולל: שם, תפקיד, מיומנויות משויכות, הנחיות פרומפט | חובה |
| FR-06.2 | הפעלת סוכן יוצרת הקשר פרומפט ייעודי עבור Claude API | חובה |
| FR-06.3 | סוכנים מרובים יכולים לפעול במקביל על אותה הערכה | גבוהה |
| FR-06.4 | פלט כל סוכן מסומן בבירור בדו"ח הסופי | חובה |
| FR-06.5 | האנליסט יראה בזמן אמת אילו סוכנים פעילים ("Agent Activity Panel") | חובה |

### 4.7 Skill Creator (FR-07)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-07.1 | ממשק guided לאנליסט: שם מיומנות → תיאור → הנחיות → דוגמאות | חובה |
| FR-07.2 | המערכת תציע טמפלייט `.md` ותמלא אותו לפי קלט האנליסט | חובה |
| FR-07.3 | תצוגה מקדימה של המיומנות לפני שמירה | גבוהה |
| FR-07.4 | המערכת תציע מיומנויות דומות קיימות כדי למנוע כפילויות | בינונית |

### 4.8 תוצרים ודיווח (FR-08)

| מזהה | דרישה | עדיפות |
|---|---|---|
| FR-08.1 | דו"ח סופי בעברית בפורמט Markdown | חובה |
| FR-08.2 | דו"ח כולל: תמצית → טענות מרכזיות → עדויות סותרות → חלופות מדורגות → המלצות | חובה |
| FR-08.3 | ייצוא לפורמטים: `.md`, `.pdf`, `.docx` | גבוהה |
| FR-08.4 | כל ממצא כולל "כרטיס עדות" עם: מקור, תאריך, רמת אמינות, ציטוט | חובה |
| FR-08.5 | לוג שקיפות: "מסמך ניתוח על ידי סוכנים: X, Y, Z; מיומנויות שהופעלו: A, B" | חובה |

---

## 5. דרישות לא-פונקציונליות (Non-Functional Requirements)

### 5.1 ביצועים
- זמן ניתוח ראשוני: < 2 דקות למסמך עד 5,000 מילים
- זמן תגובה לשאלות המשך: < 30 שניות
- תמיכה בפעולה מקבילה של עד 5 סוכנים בו-זמנית

### 5.2 אבטחה ⚠️
- **לא** לאחסן מסמכי הערכה בענן ללא הצפנה מפורשת
- **לא** לשלוח תוכן מסמך גולמי לצד שלישי ללא הסכמה מפורשת
- כל קריאת API תעבור דרך backend מאובטח — מפתחות API לעולם לא בצד לקוח
- לוגים של פעולות משתמש ישמרו locally בלבד
- גישה למערכת תדרוש אימות (authentication) — OAuth2 / SSO
- הגדרת הרשאות לעריכת מיומנויות וסוכנים לפי תפקיד (RBAC)

### 5.3 שימושיות
- ממשק בעברית (RTL מלא)
- נגישה ל-WCAG 2.1 AA
- תמיכה בדפדפנים: Chrome, Firefox, Edge (גרסאות עדכניות)
- תמיכה בצפייה במובייל (responsive) — קריאה בלבד

### 5.4 אמינות
- זמינות מערכת: 99.5% בשעות עבודה
- שמירה אוטומטית של עבודה כל 60 שניות
- גיבוי ממצאים לפני כל עדכון מיומנות

---

## 6. ארכיטקטורת מיומנויות וסוכנים (Skills & Agents Architecture)

### 6.1 סכמת קובץ מיומנות (Skill Schema)

```markdown
---
name: [שם המיומנות בעברית]
name_en: [שם באנגלית — לשימוש פנימי]
version: 1.0
author: [שם האנליסט]
created: YYYY-MM-DD
last_modified: YYYY-MM-DD
tags: [רשימת תגיות לזיהוי אוטומטי]
auto_trigger_keywords: [מילות מפתח שמפעילות מיומנות זו אוטומטית]
---

## תיאור המיומנות
[תיאור קצר של תחום המומחיות]

## שאלות ליבה (Core Questions)
[רשימת שאלות שהמיומנות שואלת בבואה לנתח הערכה]

## הנחיות ניתוח (Analysis Instructions)
[הוראות ספציפיות לניתוח בתחום זה]

## מקורות מועדפים (Preferred Sources)
[רשימת מקורות אמינים לתחום זה]

## דוגמאות (Examples)
[דוגמאות לניתוח טוב בתחום]

## אזהרות והטיות ידועות (Known Biases & Warnings)
[הטיות אנליטיות נפוצות בתחום]
```

### 6.2 מיומנויות ברירת מחדל (Default Skills)

| שם | תיאור | מזהה |
|---|---|---|
| כלכלה מאקרו | ניתוח גורמים כלכליים ומאקרו-כלכליים | `skill-macroeconomics` |
| הערכת נזקי קרב (BDA) | Bomb/Battle Damage Assessment | `skill-bda` |
| מומחיות לבנון | אספקטים פוליטיים, חברתיים, ביטחוניים לבנוניים | `skill-lebanon` |
| מומחיות סוריה | אספקטים פוליטיים, חברתיים, ביטחוניים סוריים | `skill-syria` |
| מומחיות איסלאם | ניתוח דתי-תרבותי איסלאמי כללי | `skill-islam` |
| מומחיות שיעה | ניתוח תרבות, תיאולוגיה ופוליטיקה שיעית | `skill-shia` |
| יחסים בינלאומיים | ניתוח דינמיקות בינלאומיות, גיאופוליטיקה | `skill-intl-relations` |
| ניתוח נרטיבים | זיהוי נרטיבים ופרופגנדה | `skill-narrative-analysis` |
| הטיות קוגניטיביות | זיהוי הטיות אנליטיות בטקסט | `skill-cognitive-bias` |

### 6.3 סכמת קובץ סוכן (Agent Schema)

```markdown
---
name: [שם הסוכן]
role: [תפקיד — לדוגמה: "מומחה אזור לבנוני"]
version: 1.0
author: [שם מגדיר הסוכן]
created: YYYY-MM-DD
skills:
  - skill-lebanon
  - skill-shia
  - skill-intl-relations
auto_activate_on: [מילות מפתח שמפעילות את הסוכן אוטומטית]
priority: [1-5, כאשר 1 = גבוה ביותר]
---

## תיאור הסוכן
[מה הסוכן עושה ומה תפקידו בניתוח]

## הנחיות פרומפט (Prompt Instructions)
[הנחיות ספציפיות לסוכן — כיצד לגשת לניתוח]

## שאלות ייחודיות לסוכן
[שאלות שרק סוכן זה שואל]

## פורמט תוצר (Output Format)
[כיצד הסוכן מציג את ממצאיו]
```

### 6.4 סוכני ברירת מחדל (Default Agents)

| שם | מיומנויות משויכות | תפקיד |
|---|---|---|
| מנתח לבנון | `skill-lebanon`, `skill-shia`, `skill-intl-relations` | ניתוח ממד לבנוני |
| מנתח סוריה | `skill-syria`, `skill-intl-relations` | ניתוח ממד סורי |
| מומחה איסלאם שיעי | `skill-shia`, `skill-islam` | ניתוח ממד דתי שיעי |
| מנתח כלכלי | `skill-macroeconomics` | ניתוח ממד כלכלי |
| מנתח BDA | `skill-bda` | ניתוח נזקים ויכולות |
| Devil's Advocate | `skill-cognitive-bias`, `skill-narrative-analysis` | אתגור ההנחות הכלליות |

---

## 7. זרימת עבודה מפורטת (Detailed Workflow)

```
┌─────────────────────────────────────────────────────────────┐
│                    AVAR WORKFLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. INGEST                                                  │
│     └── אנליסט מעלה מסמך הערכה                             │
│         └── OCR/parsing → normalized text                   │
│                                                             │
│  2. ANALYZE                                                 │
│     └── זיהוי: טענות מרכזיות, הנחות, פערי מידע             │
│         └── מיפוי לסוכנים ומיומנויות רלוונטיים             │
│                                                             │
│  3. DISPATCH                                                │
│     └── הפעלת סוכנים רלוונטיים (אוטומטית + ידנית)          │
│         └── כל סוכן מקבל: מסמך + הקשר מיומנות             │
│                                                             │
│  4. RESEARCH                                                │
│     └── כל סוכן מפעיל search tool                          │
│         └── איסוף עדויות תומכות + סותרות                   │
│                                                             │
│  5. SYNTHESIZE                                              │
│     └── מיזוג תוצאות כל הסוכנים                            │
│         └── הפקת חלופות + דירוג                             │
│                                                             │
│  6. REPORT                                                  │
│     └── דו"ח סופי בעברית + לוג שקיפות                      │
│         └── ייצוא ל-MD / PDF / DOCX                         │
│                                                             │
│  7. ITERATE                                                 │
│     └── אנליסט מגיב לממצאים                                │
│         └── שאלות המשך → חזרה לשלב 4                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. מבנה קבצי הפרויקט (Project File Structure)

```
avar/
├── CLAUDE.md                          # הוראות ראשיות ל-Claude Code
├── README.md                          # תיעוד הפרויקט
├── PRD.md                             # מסמך זה
│
├── skills/                            # מאגר מיומנויות
│   ├── default/                       # מיומנויות ברירת מחדל
│   │   ├── skill-macroeconomics.md
│   │   ├── skill-bda.md
│   │   ├── skill-lebanon.md
│   │   ├── skill-syria.md
│   │   ├── skill-islam.md
│   │   ├── skill-shia.md
│   │   ├── skill-intl-relations.md
│   │   ├── skill-narrative-analysis.md
│   │   └── skill-cognitive-bias.md
│   └── custom/                        # מיומנויות שנוצרו על ידי אנליסטים
│
├── agents/                            # מאגר סוכנים
│   ├── default/                       # סוכני ברירת מחדל
│   │   ├── agent-lebanon.md
│   │   ├── agent-syria.md
│   │   ├── agent-shia.md
│   │   ├── agent-economics.md
│   │   ├── agent-bda.md
│   │   └── agent-devils-advocate.md
│   └── custom/                        # סוכנים שנוצרו על ידי אנליסטים
│
├── src/
│   ├── frontend/                      # React web application
│   │   ├── components/
│   │   │   ├── DocumentUpload/
│   │   │   ├── AnalysisReport/
│   │   │   ├── AgentActivityPanel/
│   │   │   ├── AlternativesMatrix/
│   │   │   ├── SkillCreator/
│   │   │   ├── AgentEditor/
│   │   │   └── EvidenceCard/
│   │   ├── pages/
│   │   │   ├── Dashboard/
│   │   │   ├── NewAssessment/
│   │   │   ├── Report/
│   │   │   ├── SkillsManager/
│   │   │   └── AgentsManager/
│   │   └── i18n/
│   │       ├── he.json               # Hebrew translations
│   │       └── en.json               # English translations
│   │
│   ├── backend/                       # Node.js / Python API
│   │   ├── api/
│   │   │   ├── ingest.js              # Document ingestion
│   │   │   ├── analyze.js             # Analysis orchestration
│   │   │   ├── agents.js              # Agent dispatch
│   │   │   ├── search.js              # Search tool abstraction
│   │   │   ├── skills.js              # Skills management
│   │   │   └── report.js              # Report generation
│   │   ├── prompts/
│   │   │   ├── system-prompt.md       # Master system prompt
│   │   │   ├── analysis-prompt.md
│   │   │   └── synthesis-prompt.md
│   │   └── search-backends/
│   │       ├── web-search.js          # Generic web search
│   │       └── README.md              # Guide for adding backends
│   │
│   └── shared/
│       ├── types.ts                   # Shared TypeScript types
│       └── constants.ts
│
├── reports/                           # Generated reports (local)
│   └── .gitkeep
│
├── .env.example                       # Environment variables template
├── .gitignore
└── package.json
```

---

## 9. CLAUDE.md — הוראות ל-Claude Code

> קובץ זה ישב בשורש הפרויקט ויכוון את Claude Code בכל עבודה על הפרויקט.

```markdown
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
```

---

## 10. מסך ממשק משתמש — תיאור מסכים (UI Screens Description)

### 10.1 מסך ראשי — Dashboard
- רשימת הערכות אחרונות
- כפתור "הערכה חדשה"
- סטטוס מיומנויות וסוכנים פעילים
- RTL מלא

### 10.2 מסך הכנסת הערכה — New Assessment
- אזור Drag & Drop להעלאת קובץ
- תיבת טקסט להדבקה ישירה
- בחירת סוכנים ידנית (override לאוטומטי)
- כפתור "נתח הערכה"

### 10.3 מסך עיבוד — Processing (Live)
- **Agent Activity Panel**: רשימת סוכנים עם סטטוס (ממתין / פעיל / הושלם)
- **Skills Panel**: מיומנויות שהופעלו
- פס התקדמות עם שלב נוכחי

### 10.4 מסך דו"ח — Report
- תמצית מנהלים
- לשוניות: טענות מרכזיות | עדויות סותרות | חלופות | המלצות
- **מטריצת סיכון ויזואלית** (חומרה × הסתברות)
- כרטיסי עדות (Evidence Cards) עם מקור + אמינות
- לוג שקיפות (אילו סוכנים/מיומנויות פעלו)
- כפתורי ייצוא

### 10.5 מסך ניהול מיומנויות — Skills Manager
- רשימת מיומנויות קיימות
- עריכת md בעורך מובנה
- כפתור "צור מיומנות חדשה" → Skill Creator

### 10.6 Skill Creator (5 שלבים)
1. שם ותיאור המיומנות
2. שאלות ליבה (מה המיומנות שואלת)
3. הנחיות ניתוח
4. מקורות מועדפים
5. תצוגה מקדימה + שמירה

### 10.7 מסך ניהול סוכנים — Agents Manager
- כרטיסי סוכנים עם מיומנויות משויכות
- הפעלה/השבתה
- עריכת קובץ md

---

## 11. מה מחוץ לסקופ (Out of Scope — v1.0)

| תכונה | סיבה |
|---|---|
| עיבוד מסמכים מסווגים (Classified) | דורש ארכיטקטורת אבטחה נפרדת |
| ממשק ניידים (Native Mobile App) | web responsive מספיק בשלב זה |
| שיתוף פעולה multi-user בזמן אמת | מורכבות גבוהה — v2 |
| fine-tuning מודל ייעודי | משאבים ועלות — v3 |
| אינטגרציה עם מאגרי מודיעין פנימיים | תלוי בסביבת הפריסה |
| ניתוח וידאו/אודיו | מחוץ לסקופ |

---

## 12. שאלות פתוחות (Open Questions)

| # | שאלה | בעלים | דדליין |
|---|---|---|---|
| Q1 | האם יש צורך ב-SSO ספציפי לארגון? | Product Owner | לפני Design Review |
| Q2 | מהם מקורות OSINT המאושרים לשימוש? | Legal/Security | לפני Sprint 1 |
| Q3 | האם לשמור היסטוריית הערכות? לכמה זמן? | Product Owner | Sprint 1 |
| Q4 | האם נדרשת תמיכה בערבית בממשק (RTL ערבי)? | Product Owner | Design Review |
| Q5 | Deployment: Cloud (AWS/Azure) או On-Premise? | DevOps | לפני Sprint 2 |

---

## 13. לוח זמנים (Suggested Timeline)

| שלב | תוכן | משך |
|---|---|---|
| Sprint 0 | Setup, CLAUDE.md, Project structure, Auth skeleton | 1 שבוע |
| Sprint 1 | Document ingest, Basic analysis, Search integration | 2 שבועות |
| Sprint 2 | Skills & Agents engine, Skill Creator | 2 שבועות |
| Sprint 3 | Report generation, Alternatives matrix, Evidence cards | 2 שבועות |
| Sprint 4 | UI polish (Hebrew RTL), Agent Activity Panel, Export | 1 שבוע |
| Sprint 5 | Testing, Security review, UAT with analysts | 2 שבועות |

---

## 14. מילון מונחים (Glossary)

| מונח עברי | מונח אנגלי | הגדרה |
|---|---|---|
| הערכה | Assessment | מסמך מודיעיני המציג עמדה אנליטית |
| מיומנות | Skill | מודול ידע ייעודי המוגדר ב-md |
| סוכן | Agent | ישות המורכבת ממיומנויות ופועלת בתפקיד מוגדר |
| עדות סותרת | Conflicting Evidence | מידע המאתגר את טענות ההערכה |
| חלופה | Alternative | פרשנות שונה לאותם נתונים |
| דירוג חומרה | Severity Rating | עד כמה החלופה מסכנת את ההנחות המרכזיות |
| דירוג הסתברות | Likelihood Rating | עד כמה סביר שהחלופה נכונה |
| BDA | BDA (Bomb/Battle Damage Assessment) | הערכת נזקי קרב |
| OSINT | OSINT | מודיעין ממקורות גלויים |

---

*PRD Version 1.0 — AVAR Intelligence Assessment Validation System*  
*Created: 2026-04-21 | Status: Awaiting Review*
