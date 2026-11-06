# 1. Install the Tools

Install these tools in order.

## Docker Desktop

The application runs with Docker, which starts the app and its database together
so you don't have to set them up separately.

[Download Docker Desktop](https://www.docker.com/products/docker-desktop/),
install it, and open it. Complete the setup instructions, then leave Docker
Desktop running while you work on the project. On Windows, install any
additional components the installer requests, including WSL 2.

## DBeaver Community

The application stores its data in a PostgreSQL database. You can use DBeaver
to view this data in tables and make changes through an application window.

[Download DBeaver Community](https://dbeaver.io/download/), the free edition,
and install it. You'll connect it to the database in a later step, after
starting the application with Docker. You only need to open DBeaver when you
want to view or manage the data.

## Visual Studio Code

Visual Studio Code, or VS Code, is the editor you will use to open the project,
change code, and run commands in its built-in terminal.

[Download Visual Studio Code](https://code.visualstudio.com/download).
Install the desktop application and open it before continuing.

## Git

Git downloads the project from GitHub and tracks changes to its files. VS Code
has Git controls, but it still needs Git installed on your computer.

[Install Git](https://git-scm.com/install/) using the instructions for your
operating system. Git for Windows also includes Git Bash, the terminal used by
this guide on Windows. Restart VS Code after installing Git so it can find it.

Docker provides Node.js and PostgreSQL for this project. You do not need to
install them separately on your computer.

## Check Your Installations

You can check your installations using the following commands in a terminal:

```bash
git --version
docker --version
```

Both commands should show a version number.
