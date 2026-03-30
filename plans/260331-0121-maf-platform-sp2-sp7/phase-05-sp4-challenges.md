# Phase 5: SP4 — Community Challenges & Leaderboards

## Overview
- **Priority:** P2
- **Owner:** Both (Dev A: backend, Dev B: frontend)
- **Status:** Pending
- **Effort:** 4-6 weeks
- **Blocked by:** Phase 3 (SP2 complete)
- **Can overlap with:** Phase 4 (SP3) — different modules, no file conflicts

## Parallel Split

### Dev A (Backend)
**File ownership:** `api/src/challenge/`, `api/src/group/`

- **ChallengeModule:**
  - Challenge CRUD (admin creates, users join)
  - Challenge types: distance, time-streak, MAF-improvement
  - Auto-progress tracking from Strava activities
  - Validation: only count activities in MAF HR zone
  - Leaderboard computation (Redis sorted sets for real-time)
- **GroupModule:**
  - Province-based groups (auto-created for 63 Vietnam provinces)
  - Group membership, group stats
  - Group activity feed (recent member activities)
- **DB tables:** `challenges`, `challenge_participants`, `groups`, `group_members`
- **APIs:**
  - `GET /challenges` — list active/upcoming/past
  - `POST /challenges/:id/join` — join challenge
  - `GET /challenges/:id/leaderboard` — ranked participants
  - `GET /groups` — list province groups
  - `GET /groups/:id` — group detail + members + stats
  - `GET /groups/:id/feed` — recent activities from group members
- **Background jobs:** Recalculate leaderboards on new activity sync

### Dev B (Frontend)
**File ownership:** `src/pages/challenge-*`, `src/pages/group-*`, `src/components/challenge/`, `src/components/group/`

- **Pages:**
  - `challenges-page.tsx` — browse active/upcoming/past challenges
  - `challenge-detail-page.tsx` — progress bar, leaderboard, your stats
  - `groups-page.tsx` — province group browser
  - `group-detail-page.tsx` — members, group leaderboard, feed
- **Components:**
  - `challenge/challenge-card.tsx` — challenge preview card
  - `challenge/leaderboard-table.tsx` — ranked list with user highlight
  - `challenge/progress-bar.tsx` — user's challenge progress
  - `challenge/join-button.tsx` — join/leave challenge
  - `group/group-card.tsx` — province group preview
  - `group/member-list.tsx` — group member avatars
  - `group/activity-feed.tsx` — recent group activities
- **Profile:** Add badges/achievements from completed challenges
- **Navigation:** Add "Challenges" + "Community" tabs

## Key Features
1. **Distance challenges:** "Run 100km this month at MAF HR" — auto-tracked via Strava
2. **MAF improvement:** "Improve MAF pace by 10s/km in 8 weeks" — trend-based
3. **Province groups:** 63 auto-created groups, local leaderboards
4. **Real-time leaderboards:** Redis sorted sets, update on activity sync
5. **Achievement badges:** Earned on challenge completion

## Success Criteria
- Users can browse and join challenges
- Progress auto-tracked from Strava activities (only MAF-zone runs count)
- Leaderboard updates within minutes of new activity sync
- Province groups show local rankings
- Completed challenges award badges visible on profile
