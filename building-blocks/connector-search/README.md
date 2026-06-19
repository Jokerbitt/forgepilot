# Search Connector

Provider-agnostic full-text search. Call `search()`; swap backend via
`SEARCH_PROVIDER`.

| Provider | Env | Notes |
|----------|-----|-------|
| `memory` (default, dev) | — | zero-dep TF-IDF, fine for a few thousand docs |
| `meilisearch` | `MEILI_HOST`, `MEILI_KEY?` | typo-tolerant, fast, for production/large data |

```ts
import { search } from '@/lib/search'
await search().index('tasks', tasks.map(t => ({ id: t.id, text: `${t.title} ${t.description ?? ''}`, meta: { projectId: t.projectId } })))
const hits = await search().search('tasks', 'overdue billing')
```

Re-index after writes (or incrementally). For SQLite/Postgres-native search,
use FTS5 / `tsvector` directly instead of this connector.
