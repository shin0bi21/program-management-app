# 3. Set Up Your Environment File

In the VS Code terminal, create `.env` in the project root by copying the example:

```bash
cp .env.example .env
```

Open the new `.env` file in VS Code. Only change the sign-in secrets and
administrator details below. Leave all other settings as provided.

## Generate Your Sign-In Secrets

Generate the values for `JWT_SECRET` and `REFRESH_SECRET` with:

```bash
docker run --rm node:24-alpine node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run the command twice. Each run prints a new random value in the terminal.
Copy each result into `.env`, replacing the text after `=`:

1. First result → `JWT_SECRET`.
2. Second result → `REFRESH_SECRET`.

Keep each value on one line. Use a different result for each setting.
The first run may download the Node image; the command does not require Node.js
installed on your computer.

## Set Your Administrator Details

Replace these values with the details for your local account:

| Setting | What to Enter |
|---|---|
| `ADMIN_EMAIL` | The email address you will use to sign in locally |
| `ADMIN_PASSWORD` | A password for your local administrator account |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | Your first and last name |

Save `.env`. The application will use these details to create your account in
the Docker setup step.
