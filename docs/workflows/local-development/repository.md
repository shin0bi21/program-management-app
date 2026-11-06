# Open the Project in VS Code

## Check Your GitHub Access

Sign in to GitHub and open the
[Be Original repository](https://github.com/shin0bi21/be-original).
This is a private repository, so your account must already have access. If you
cannot see it, ask a repository administrator for access before continuing.

## Clone the Repository

1. Open VS Code.
2. Open the Command Palette with **Cmd+Shift+P** on macOS or **Ctrl+Shift+P** on
   Windows/Linux.
3. Search for **Git: Clone** and select it.
4. Select **Clone from GitHub**, sign in with the account that has repository
   access when prompted, and choose **shin0bi21/be-original**.
5. Choose a folder on your computer where you keep projects, such as `Projects`.
   VS Code will create a `be-original` folder inside it.
6. When cloning finishes, select **Open** to open the downloaded project.

If you already cloned the project, use **File → Open Folder** and select that
existing project folder instead. Its name may be `my-webapp` if you used an older
guide. The contents are what matter.

## Check the Project Folder

The Explorer panel should show `frontend`, `backend`, and `docker-compose.yml`
at the top level. The folder containing these is the **project root**. Open the
whole project folder, rather than just `frontend` or `backend`.

## Switch to the Development Branch

Choose **Terminal → New Terminal** in VS Code. Run the commands on the following
setup pages from this terminal.

A branch is a version of the project. Use `develop` for local setup; `main`
tracks production releases. In the project you just downloaded, run:

```bash
git switch develop
git pull --ff-only
git status --short --branch
```

The final command should show `develop...origin/develop` with no changed files.
If you are reusing an existing clone with changes, preserve that work before
switching branches.
