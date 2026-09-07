# Event Function Checklist

Use before creating or updating a CloudBase Event Function in this project.

1. Use `exports.main(event, context)` and route requests through `{ action, payload }`.
2. Read OPENID from `cloud.getWXContext().OPENID`; never accept it from `payload`.
3. Keep responses in the shared `{ code, message, data }` format.
4. Use the existing shared modules for auth, validation, errors, logging, and database access.
5. Deploy from the repository root with `npm run deploy` or `npm run deploy:<name>`.
6. Run a narrow syntax or test check before deployment.
