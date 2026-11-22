# Career Tracker

Career Tracker is a private job-application dashboard. Create an account to track opportunities, deadlines, notes, and progress through a customizable application pipeline.

## Features

- Create an account and sign in with a username or email address.
- Add, edit, move, and delete job applications.
- Save job links, deadlines, and notes for each application.
- View application counts by stage and deadlines due in the next seven days.
- Add, rename, and delete personal pipeline stages.
- Keep account and application data in a persistent MySQL database.

## Run the app locally with Docker

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine with the Compose plugin) running.

1. From the repository root, start the complete app:

   ```bash
   docker compose up --build
   ```

2. Open **http://localhost:5173** in your browser. Create an account on the sign-up page, then start tracking applications.

The first start builds the frontend and backend images and may take a few minutes. The API is also available at **http://localhost:3001**. MySQL data is kept in a Docker volume when the containers stop.

To stop the app, press `Ctrl+C`, then run:

```bash
docker compose down
```

Run `docker compose up` to reopen it later. Your account and applications remain saved.

The Compose defaults are for local development only. Set a private `JWT_SECRET` in a root `.env` file before using this setup anywhere accessible to other people.

## Run the backend tests

```bash
npm --prefix backend test
```

## Technology

- React and Vite frontend
- Node.js and Express API
- MySQL database
- Docker Compose local development environment
