# Backend reports

Keep report data and file rendering in separate owners.

- A service under `src/services/<product-area>/` checks access, queries data, and calculates the report result. Its result can serve JSON and file endpoints.
- A renderer under `src/reports/<product-area>/` accepts that result and produces a file. Renderers do not query the database, check permissions, or depend on Express requests and responses.
- The controller obtains the authorized report result, passes it to the renderer, and sends the file with the appropriate HTTP headers.

For cohort youth reports, `getCohortYouthReport` supplies the data and `renderCohortYouthPdf` renders the PDF. Keep format-specific layout and filename generation with the renderer. Test the report data at its service or API boundary and verify the file endpoint returns a valid response.
