# Connect to the Local Database

Now that the application is running locally, we will connect DBeaver to its
database. This will let you see the tables and records the application uses,
including the administrator account you created on the previous page.

Before we start, make sure Docker Desktop is open and the application is still
running. DBeaver needs the database container to be running so it can connect.

## Create a DBeaver Connection

1. Open **DBeaver Community**.
2. Open the **New Connection** wizard from the toolbar.
3. Search for **PostgreSQL**, select it, and choose **Next**.
4. Enter the values below. Your database name and credentials are in the root
   `.env` file you created on the previous page.

| Connection Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | Your `DB_NAME` value |
| Username | Your `DB_USER` value |
| Password | Your `DB_PASSWORD` value |

Use `localhost` here because DBeaver runs on your computer. The `db` hostname
in `.env` is for communication between Docker containers. Use the database
password, not the administrator password you use to sign in to the application.

5. Select **Test Connection**. If prompted to download the PostgreSQL driver,
   allow DBeaver to download it.
6. Once the connection succeeds, select **Finish**. Give the connection a clear
   name such as **Be Original — Local**.

DBeaver's [connection guide](https://dbeaver.com/docs/dbeaver/Create-Connection/)
explains the wizard and its fields.

## Find the Application Tables

Expand your connection, then find your database's **Schemas → public → Tables**.
Open a table such as `users` and select its **Data** tab. After the administrator
seed has completed, the local administrator should appear in `users`.

This connection is to your development database. The test database uses port
`5433`; leave it separate from the database you use to run the application.
To change the database structure, add a project migration rather than editing
tables manually in DBeaver. See [Create a Migration](../../backend/database.md#create-a-migration).

## If the Connection Fails

In the VS Code terminal, from the project root, check:

```bash
docker compose ps db
docker compose logs --tail=50 db
```

If the connection is refused, check that `db` is running and that you entered
port `5432`. If authentication fails, check the database credentials. Changing
`.env` after the database was first created does not change credentials stored
in its existing volume. Do not delete the volume just to clear an error if it
contains local work.

## Setup Is Complete

Your local environment is now set up. You can open the code in VS Code, run the
application on your computer, and use DBeaver to view its data.

When you return to the project, [Daily Development](README.md) explains how
to start and restart the application. When you make a code change,
[Testing](../delivery/testing.md#choose-a-runner) explains which checks to run.

To run the full application test suite from the project root:

```bash
bash scripts/tests/test-app.sh
```

That suite does not require a separate browser installation. If you need existing
business records for development, follow [Refresh Local Data](../delivery/refresh-data.md);
a fresh local database contains only the initial seeded data.

Previous: [Run the Application in Docker](setup.md).
