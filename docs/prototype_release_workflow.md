# Prototype Release Workflow

## Purpose

This document defines the next development path for turning the Permaculture Design Generator from a working local/VPS app into a controlled early-access prototype that can support feedback, audience building, and future “plank owner” access.

The goal is not to add many new features yet. The goal is to make the prototype trustworthy, understandable, testable, and ready for a small invited group.

---

## Current Product Promise

The prototype should make one clear promise:

> Generate a site-aware edible guild and 3-year permaculture starter plan from a user's location, desired canopy plants, climate zone, and household/site context.

Do not overpromise unfinished areas.

The app should clearly communicate that these features are still in progress:

- Native PDF export
- Soil-test upload and interpretation
- Cultivar/variety-specific recommendations
- Pollination-partner logic
- Perfect plant suitability for every microclimate
- Invasiveness/local regulation warnings

---

## Immediate Priority

The next development pass should focus on prototype readiness:

1. Add a prototype notice.
2. Add a feedback link or feedback form.
3. Add visible app versioning.
4. Store app version in generated/saved plans.
5. Improve first-page helper text.
6. Make saved-site state trustworthy and obvious.
7. Prepare the app for invited early testers.

---

## Task 1: Add Prototype Notice

### Goal

Add a clear but non-alarming prototype notice to the generated results page.

### Suggested Text

**Prototype Notice**

This is an early-access planning tool. Plant suggestions are generated from the current registry and should be reviewed against local conditions, nursery availability, invasiveness concerns, and personal site constraints.

We’re actively improving plant coverage, soil-test integration, variety selection, and native PDF export.

### Requirements

- Show the notice somewhere visible but not intrusive.
- Best location: near the top of generated results, below the plan title or save-state indicator.
- Style it with existing theme variables.
- It must work in light mode, dark mode, and print view.
- Do not block plan generation.
- Do not change generation logic.

---

## Task 2: Add Feedback Link

### Goal

Give early users a direct way to report weird output or request features.

### Suggested Label

Found something off? Send feedback.

### Implementation Options

Use one of these:

- `mailto:` link
- Google Form
- Tally form
- Airtable form
- simple placeholder link if the final feedback form is not ready yet

### Requirements

- Put the link near the prototype notice.
- Make it clear this is for early-access feedback.
- Do not require login.
- Do not interrupt the app flow.

### Suggested Feedback Questions

Keep the form short:

1. Did the plan feel useful?
2. Which plants looked wrong or out of place?
3. What location/zone were you testing?
4. What feature do you want next?
5. Would you pay for this if it improved?
6. Optional email for follow-up.

---

## Task 3: Add Versioning

### Goal

Every tester should be tied to a known app/registry version so feedback can be traced.

### Suggested Visible Label

Prototype v0.1.0

### Requirements

- Add a small visible version label in the app footer or results area.
- Add a central frontend constant if appropriate, for example:

```js
const APP_VERSION = '0.1.0';
```

- Include the version in generated plans:

```json
{
  "appVersion": "0.1.0"
}
```

- Include the version in saved site data if possible.
- Do not break existing saved-site loading if older saves do not have an appVersion.

### Display Behavior

If a saved plan has a version:

```text
Loaded saved site: Test Save 1 · Prototype v0.1.0
```

If it does not:

```text
Loaded saved site: Test Save 1 · Version unknown
```

---

## Task 4: Improve First-Page Helper Text

### Goal

Make onboarding clearer for early testers.

### Focus Areas

Add helper text for:

- Property address
- Desired canopy plants
- Saved sites
- Coming-soon soil test area

### Suggested Desired Canopy Helper Text

Enter one or more desired canopy plants, separated by commas.

Example:

```text
apple, peach, pear
```

### Requirements

- Do not add new logic.
- Keep helper text short.
- Make sure it works in dark mode.
- Avoid overwhelming the first page.

---

## Task 5: Make Saved Sites Feel Trustworthy

### Goal

Saved-site behavior should feel like a real workspace.

### Current Desired Behavior

- Saved sites sort newest first.
- Loaded saved site is clearly indicated.
- Unsaved changes are clearly indicated.
- Save Changes overwrites the currently loaded saved site.
- Save As New creates a separate saved site.
- Guild edits are staged visually before page-level saving.

### Next Polish Items

Add or confirm:

- Loaded saved site name
- Unsaved changes indicator
- Saved state after successful save
- Last saved timestamp if available
- Save Changes button visibility when dirty
- Save As New always available when a plan exists

### Important Rule

Do not auto-save guild edits. Guild edits should remain reviewable until the user chooses to save.

---

## Task 6: Landing Page Preparation

### Goal

Prepare for a simple public-facing landing page or early-access invite page.

This does not need to be built inside the app immediately, but the product language should be ready.

### Landing Page Sections

1. Headline
2. Demo/prototype link
3. What the tool does
4. What is coming soon
5. Early-access / plank owner invite
6. Email signup or feedback form

### Suggested Headline

Site-aware edible guild planning for homesteads and food forests.

### Suggested Subheadline

Generate climate-aware plant guilds, starter implementation plans, and editable food-forest designs from your location and goals.

### Suggested Coming Soon List

- Soil-test upload and interpretation
- Native PDF export
- Variety and pollination planning
- Nursery and sourcing lists
- Local invasiveness and caution flags
- Expanded plant registry by USDA zone and climate type

---

## Plank Owner / Early Access Strategy

### Recommendation

Start with free private early access before paid founding access.

Reason:

The prototype is useful, but the core value, ideal user, and pricing are still being discovered. High-quality feedback is more valuable than early payment right now.

### Possible Future Offers

- Founding member discount
- Lifetime early supporter access
- Design partner access
- Early supporter badge
- Discounted annual plan
- Priority feature voting

### Do Not Promise Yet

Avoid promising lifetime access, commercial rights, or permanent pricing until the product scope is clearer.

---

## Development Priority Order

Recommended order:

1. Prototype notice and feedback link
2. App version label and saved-plan appVersion
3. First-page helper text
4. Saved-site polish and timestamps
5. Plant registry audit by target zones
6. Variety and pollination model
7. Soil-test upload and interpretation
8. Native PDF export
9. Landing page and early-access signup

---

## Codex Implementation Prompt

Use this prompt for the next coding pass:

```text
Inspect first, then implement the smallest safe prototype-readiness pass.

Goal:
Prepare the app for controlled early-access testing.

Files likely involved:
- public/app.js
- public/index.html
- public/style.css
- server.js only if needed for saved appVersion metadata

Do not change:
- plant registry data
- guild generation logic
- replacement ranking logic
- saved-site file format unless adding backward-compatible appVersion metadata
- PM2/VPS config

Tasks:

1. Add a prototype notice to the generated results page.
Text:
"Prototype Notice"
"This is an early-access planning tool. Plant suggestions are generated from the current registry and should be reviewed against local conditions, nursery availability, invasiveness concerns, and personal site constraints."
"We’re actively improving plant coverage, soil-test integration, variety selection, and native PDF export."

2. Add a feedback link near the prototype notice.
Use placeholder href if needed:
mailto:YOUR_EMAIL_HERE?subject=Permaculture%20Prototype%20Feedback
Label:
"Found something off? Send feedback."

3. Add visible app versioning.
Use:
Prototype v0.1.0
Add a central APP_VERSION constant if appropriate.
Show the version in the footer or results header.

4. Add appVersion to generatedPlan when a plan is generated.
Also preserve/display appVersion when loading saved sites.
Do not break old saved sites that have no appVersion.

5. Improve first-page helper text for desired canopy plants.
Text:
"Enter one or more desired canopy plants, separated by commas. Example: apple, peach, pear."

6. Confirm saved-site state still works:
- Loaded saved site indicator
- Unsaved changes indicator
- Save Changes
- Save As New
- Guild dirty state

7. Styling:
Use existing theme variables.
The prototype notice and feedback block must be readable in light mode, dark mode, and print view.

8. Validation:
Run:
node --check public/app.js
node --check server.js

Report:
- files changed
- exact visible text added
- whether appVersion is added to generated/saved plans
- validation result
- anything not manually tested
```

---

## Manual Test Plan

After implementation, test:

1. Generate a new plan.
2. Confirm prototype notice appears.
3. Confirm feedback link appears.
4. Confirm Prototype v0.1.0 appears.
5. Save as a new site.
6. Reopen saved site.
7. Confirm saved-site indicator still works.
8. Edit a guild layer.
9. Confirm dirty/unsaved state still works.
10. Save Changes.
11. Reopen and confirm the edit persisted.
12. Print/Save PDF and confirm print output remains readable.
13. Toggle dark/light mode and confirm notice is readable.

---

## Release Checkpoint

Before inviting early users:

- App runs locally.
- App runs on VPS.
- PM2 status shows permaculture online.
- Public URL returns HTTP 200.
- Save/load works.
- Guild editing works.
- Dark mode works.
- Print/Save PDF fallback is honest.
- Soil test is clearly marked coming soon.
- Prototype notice exists.
- Feedback link exists.
- Version label exists.
