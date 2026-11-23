# The ClusterFox: notes for Claude sessions

## Developer notes and feedback (check these first)

The site has a developer area at `/dev`. The developer leaves notes there for
Claude to pick up, and visitors send feedback. Both live in the Neon database
(project `theclusterfox`), so read them with the Neon tools before starting
work on an app:

```sql
-- Open notes: page notes (with the page address) and new-app ideas
select id, kind, app, page, title, body, status, created_at
from public.dev_notes where status in ('open', 'picked_up') order by created_at;

-- Feedback from visitors that hasn't been dealt with
select id, kind, app, page, message, status, created_at
from public.site_feedback where status in ('new', 'seen', 'planned') order by created_at;
```

When you take a note on, mark it so the developer can see it in `/dev`:

```sql
update public.dev_notes set status = 'picked_up', reply = '<what you are doing, in a sentence>', updated_at = now() where id = <id>;
-- and when the change has merged:
update public.dev_notes set status = 'done', reply = '<what changed>', updated_at = now() where id = <id>;
```

Feedback statuses are `new`, `seen`, `planned`, `fixed` and `closed`; set
`fixed` with a short `dev_note` once a fix merges. Only change status and
reply/dev_note columns; never delete rows.

## Adding an app

Add it to `src/app/apps.js` with a `category` from `categories` there, so it
shows in the right home-screen section. To give it a "see everything" view
in `/dev/catalog`, add a loader in `src/features/dev/catalog/loaders.js` and
list it in `src/features/dev/catalog/registry.js`.
