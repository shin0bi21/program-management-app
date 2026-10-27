# Repository workflows

Workflow guides own the executable steps for setting up, testing, reviewing, shipping, and operating the repository. Application architecture and component patterns remain in the [frontend](../frontend/README.md) and [backend](../backend/README.md) guides.

Use focused local checks while implementing, required GitHub checks as the merge gate into `develop`, and production deployment only after separate explicit authorization.

## Guides

| Workflow | Guide |
|---|---|
| Local setup | [Setup](setup.md) |
| Local Docker, migrations, and dependencies | [Local development](local-development.md) |
| Test ownership and commands | [Testing](testing.md) |
| Continuous integration | [CI](ci.md) |
| Debugging | [Debugging](debugging.md) |
| Review | [Review](review.md) |
| Shipping to `develop` | [Shipping](shipping.md) |
| Reports | [Reports](reports.md) |
| Production deployment | [Deployment](deployment.md) |
| Documentation website | [Starlight site](../README.md) |
