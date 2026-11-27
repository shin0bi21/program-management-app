# Backend API Overview

## Find an API Owner

1. Find the router mount in [backend/src/index.ts](../../backend/src/index.ts).
2. Open the router in [backend/src/routes/](../../backend/src/routes/) to find
   the HTTP method, relative path, and middleware. Combine the mount and relative
   path to get the endpoint URL.
3. Read the route's validation schema for accepted input and its controller for
   the response. Follow the controller to the service for business rules.

For frontend callers, see [API Adapters](../frontend/02-state-and-data.md#api-adapters)
and [Preferences](../frontend/03-preferences.md).
