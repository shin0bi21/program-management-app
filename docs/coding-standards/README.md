# Coding Standards

Use these guides during implementation and review. Each owns a different part
of the code; frontend and backend guides own architecture and feature behavior.

| Concern | Guide |
|---|---|
| Names, expressions, control flow, spacing, and abstractions | [Code Readability](readability.md) |
| Function inputs and returns, object contracts, inference, generics, and data shapes | [TypeScript Contracts](typescript-contracts.md) |
| Function purpose, semantic constraints, examples, and inline comments | [Code Documentation](documentation.md) |
| CLI boundaries, execution flow, and resource cleanup | [Script Structure](scripts.md) |

A TypeScript contract defines the accepted and returned types. Source comments
explain additional requirements such as valid values, units, preconditions,
side effects, errors, and lifecycle obligations.

Use [Frontend](../frontend/README.md) or [Backend](../backend/README.md) for
ownership and architecture, [Dates and Times](../workflows/date-and-time.md) for
date/time representations, and [Documentation Maintenance](../README.md) for
writing handbook guides.
