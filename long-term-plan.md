# Overseer: Long-Term Plan

This file lists the larger pieces of work that come after the campaign feature. Each item explains **what** it is and **why** it comes at this point.

Repository root: `/Users/georgeslevaillant/Projects/overseer`

---

## Next Step: User Profiles and Accounts

### Current state

Campaign players are just names typed in when a campaign is created. Nothing ties a player to a real person. That means:

- Anyone who can open a campaign URL can change its board.
- The sidebar cannot show "campaigns you are part of", because the app doesn't know who you are.
- The rule "only the campaign creator can set up the board" cannot be enforced by the server, only followed by convention.

### What we want

1. **User profiles.** Each person has an account with a display name and a profile page.
2. **Sign-in** with Google, using NextAuth, as AGENTS.md section 6 names it.
3. **Players linked to users.** When a campaign is created, each player slot is either a named invitee or a specific user.
4. **Sidebar filtered by membership.** The sidebar shows only campaigns where the logged-in user is a player or creator.
5. **Creator-only setup enforced on the server.** Only the user who created a campaign can assign hexes.
6. **Invites.** The creator invites the other player by email or a link, and the invitee accepts.

### Why it comes next

- Everything in the campaign feature works without it, so we can ship that first.
- Auth touches sessions and security, so it needs its own plan and your explicit approval (AGENTS.md sections 6 and 8).
- Profiles change the `Player` model (a `userId` link), so they should come after the campaign schema is stable.

### Questions to answer when we start

- Sign-in with Google only, or also email and password?
- Should a campaign be private (only invited players see it), or visible to everyone?
- Is a player allowed to leave a campaign, and what happens to their hexes if they do?

---

## Later Ideas

### Battle history

The sidebar already has a "Battle History" section with placeholder items. Each time a hex changes hands, we could record a battle: attacker, defender, hex, and date. This would give the sidebar real content.

Why it's later: it needs a new table and a decision on what counts as a battle. It is most useful once profiles and campaigns are both real.

### Army lists

The sidebar also has an "Army List" placeholder. Players could save their army per campaign. This depends on profiles, because army lists belong to a user.

### Settings

The sidebar has a "Settings" placeholder. It would hold profile details and notification preferences once accounts exist.
