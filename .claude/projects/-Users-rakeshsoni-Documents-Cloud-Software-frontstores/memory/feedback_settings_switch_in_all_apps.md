---
name: feedback_settings_switch_in_all_apps
description: Every app must always show Settings (with update button) and Switch App — pinned at sidebar bottom
metadata:
  type: feedback
---

Every app — existing and future — must always have these two things accessible:

1. **Settings & Updates** link → `/settings` (which contains the app update button)
2. **Switch App** button → opens SwitchAppModal

**How it works:** Both are pinned in the sidebar bottom section in `AppLayout.tsx`, OUTSIDE the scrollable nav. This means they're always visible regardless of how many nav items the app has or how far the user has scrolled.

**Why:** User reported that in StudyMate (35+ nav items), Settings was buried and invisible. Fixed in v1.0.77 by pinning these at the bottom.

**How to apply:** When building new apps, do NOT rely on the nav array's Settings entry for discoverability. The pinned bottom section handles it automatically for all shop types. Still include Settings in the nav array for mobile nav compatibility, but the pinned section is the primary access point on desktop.

**The pinned section is in AppLayout.tsx** in the sidebar bottom `<div>` and renders for ALL shop types — no conditionals needed.
