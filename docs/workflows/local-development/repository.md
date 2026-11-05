# Open the Project in VS Code

Now that you have installed the required programs, the next step is to download
the project from GitHub and open it in VS Code. This gives you a local copy of
the code to work with.

Git calls this download **cloning** a repository. A repository contains the
project's files and their change history. We will use VS Code to clone it below.

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

VS Code documents this process in
[Cloning Repositories](https://code.visualstudio.com/docs/sourcecontrol/repos-remotes#clone-repositories).
Cloning also configures the connection to GitHub, called `origin`; you do not
need to initialize another Git repository or publish a new one.

## Open the Project Terminal

The Explorer panel should show `frontend`, `backend`, and `docker-compose.yml`
at the top level. The folder containing these is the **project root**. Open the
whole project folder, rather than just `frontend` or `backend`.

Choose **Terminal → New Terminal** in VS Code. On Windows, use the Command Palette's
**Terminal: Select Default Profile** command to select **Git Bash**, then open a
new terminal. On macOS or Linux, use the default terminal.

Before we use the terminal to set up the application, run these commands to
check that Git is installed and that you are in the right folder:

```bash
git --version
pwd
ls
```

`pwd` prints the current folder. `ls` should include `frontend`, `backend`, and
`docker-compose.yml`. If it does not, reopen the correct folder in VS Code and
create a new terminal. Run the commands on the following setup pages from this
terminal.

## Switch to the Development Branch

A branch is a version of the project. Use `develop` for local setup; `main`
tracks production releases. In the project you just downloaded, run:

```bash
git switch develop
git pull --ff-only
git status --short --branch
```

The final command should show `develop...origin/develop` with no changed files.
If you are reusing an existing clone with changes, preserve that work before
switching branches. See [Shipping](../../../.agents/skills/03-update-repo/SKILL.md)
when you are ready to create a branch for a code change.

## Continue to Docker Setup

Once the project is open on `develop`, move on to
[Run the Application in Docker](setup.md). On the next page, we will configure
your local settings and start the application.

Previous: [Install the Required Tools](tools.md).
