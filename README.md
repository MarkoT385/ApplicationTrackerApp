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

## First Google Cloud deployment

The starter production image builds the React app and serves it, together with the API, from one Cloud Run service. This keeps browser requests and the authentication cookie on the same origin. Use Cloud SQL for the MySQL database; the local Compose services are not deployed to Cloud Run.

1. Select a Google Cloud project and region, enable billing, and install/authenticate the `gcloud` CLI. Enable the required APIs and create an Artifact Registry repository:

   ```bash
   gcloud config set project PROJECT_ID
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
   gcloud artifacts repositories create career-tracker --repository-format=docker --location=REGION
   ```

2. Create a Cloud SQL MySQL instance, an `application_tracker` database, and a dedicated `tracker` database user. Create Secret Manager secrets named `db-password` and `jwt-secret` and add their values through Google Cloud Console. Use a unique random JWT secret of at least 32 characters; do not put production secrets in this repository or in image build arguments.

3. Give the Cloud Run runtime service account the **Cloud SQL Client** role and access to those two secrets. Build and push the production image from the repository root:

   ```bash
   gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/career-tracker/career-tracker:v1 .
   ```

4. Deploy the image, replacing the project, region, and instance placeholders:

   ```bash
   gcloud run deploy career-tracker \
     --image REGION-docker.pkg.dev/PROJECT_ID/career-tracker/career-tracker:v1 \
     --region REGION \
     --port 8080 \
     --add-cloudsql-instances PROJECT_ID:REGION:INSTANCE_NAME \
     --set-env-vars DB_NAME=application_tracker,DB_USER=tracker,DB_SOCKET_PATH=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME,COOKIE_SECURE=true \
     --set-secrets DB_PASSWORD=db-password:latest,JWT_SECRET=jwt-secret:latest \
     --allow-unauthenticated
   ```

   Public access is needed to load the app; account creation and the application APIs still require app authentication. Cloud Run's service account must have the roles described above. The app creates its tables on startup, so the database user needs schema/table creation permissions and normal read/write access to `application_tracker`.

5. Open the Cloud Run service URL, create an account, add an application, then sign out and back in. Check `https://SERVICE_URL/api/health` for the API health response. If deployment fails, record the command, error, and fix/remaining blocker for the course.

This is an initial deployment path, not a claim of production hardening. Review access controls, backups, monitoring, and abuse protection before using it with real users.

## Run the backend tests

```bash
npm --prefix backend test
```

## Technology

- React and Vite frontend
- Node.js and Express API
- MySQL database
- Docker Compose local development environment
