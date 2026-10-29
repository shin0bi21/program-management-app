# Install the Tools

This section covers the programs required for local application development.
Please review and download each one before moving on to the next step.

## Docker Desktop

Your local development environment will run in Docker. Docker keeps the
application and its database in containers, which provide the software they
need to run. This means you can start the project without installing and
configuring each part separately on your computer.

[Download Docker Desktop](https://www.docker.com/products/docker-desktop/).
Open it after installation and complete its first-time setup. Leave it running
while you work on the project. On Windows, follow the installer's instructions
for its Linux-container environment, including WSL 2 when requested.

## DBeaver Community

This application uses a PostgreSQL database to store application data. You will
use DBeaver to view and manage that data in your local environment. It provides
a graphical user interface, or GUI, so you can browse tables and run queries
from an application window.

Use **DBeaver Community**, the free, open-source edition with PostgreSQL support.
[Download DBeaver Community](https://dbeaver.io/download/). You will connect it
to the local database after starting the application in Docker. DBeaver is useful
for inspecting data; the application can also run without the GUI open.

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
