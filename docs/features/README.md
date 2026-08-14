# Product features

Feature documents describe how business capabilities behave today across persistence, backend APIs, authorization, and frontend consumers. They are the canonical home for product rules that cross implementation layers.

Use this layer with, not instead of, the other documentation:

- `docs/architecture/` defines system-wide boundaries and invariants.
- `docs/development/` defines the ordered procedure for adding or updating code.
- `docs/features/` defines the current behavior of a business capability.
- component and feature READMEs define the local contract of the code beside them.

## Features

| Group | Capabilities |
|---|---|
| Programming | [Sessions and attendance](programming/sessions.md) |
| Staff | [Assigned tasks](staff/tasks.md), [time entries](staff/timesheets.md), and [staff-resource access](staff/staff-resource-access.md) |
| Youth | [Youth profiles and attendance](youth/profiles.md) |

Add a capability document when behavior crosses layers or has meaningful lifecycle, authorization, persistence, destructive, date, concurrency, or multi-consumer rules. Keep a small page-local workflow in its owning code README until it reaches that threshold.

Organize documents by stable business capability, not by whether the current implementation is page-local or cross-page. Record implementation scope inside the document because that scope may change without changing the feature contract.

Every feature document should identify its backend policy/service/API tests, frontend API and route owners, shared consumers, and the development guides used to change it. A reader should be able to move from product behavior to the owning code without searching the entire repository.
