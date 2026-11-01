# Experiment portal metadata

The portal automatically discovers `src/experiments/*.ts`. There is no portal
registry to edit. Add one metadata module when creating an experiment room:

```ts
import type { ExperimentMetadata } from '../experimentMetadata';

export default {
  id: 'example-v1',
  title: 'A concrete design question',
  description: 'What the alternatives explore.',
  status: 'Proposed',
  group: { title: 'Example topic', description: 'What this topic explores.', order: 4 },
  round: 1,
  href: './compare.html?experiment=example-v1',
} satisfies ExperimentMetadata;
```

Use the experiment ID as the filename. Existing topics must reuse identical
group metadata. Topics sort by ascending order; rounds sort newest first.
The viewer link may target a dedicated page; discovery does not implement that
viewer. Add metadata only when its viewer is ready. Metadata can be listed
before a report/media packet is published.

TypeScript checks required fields during `npm run build`. Vite refuses to start
or build when a published `public/experiments/<id>/` folder lacks a matching
metadata module. Runtime validation rejects duplicate IDs, inconsistent topics,
invalid ordering and empty required fields. Text is escaped by the portal.

`npx tsx --test tests/experimentMetadata.test.ts` checks metadata and coverage.
After building, `npx tsx scripts/check-portal.ts` exercises the actual portal and
all published room links. New modules appear automatically in development and
in the next production build; a deployed static build needs rebuilding.
Outcome/status text still needs updating when a decision changes.
