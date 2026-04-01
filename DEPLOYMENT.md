# Deploying Apparitions to Google Cloud

The project is fully configured for Google Cloud Run CI/CD. This means every time you run `git push origin main`, Google Cloud will automatically pull your code, build it, and deploy it to a live website.

Follow these 4 steps in your terminal to set it up for the very first time.

### Prerequisites
Make sure you have the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed, or run these commands directly inside the **Google Cloud Shell** in your web browser.

---

### Step 1: Login and Set Project

Authenticate with your Google account and tell `gcloud` which project you are using.

```bash
# Log in to Google Cloud
gcloud auth login

# Set your current project (Replace with your actual project ID!)
gcloud config set project YOUR_GOOGLE_CLOUD_PROJECT_ID
```

---

### Step 2: Enable Required Services

Your project needs permission to securely store, build, and run Docker containers.

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

---

### Step 3: Link GitHub

This command tells Google Cloud Build to watch your `main` branch. Whenever it sees a new push from GitHub, it will read the `cloudbuild.yaml` file (which we just created) and automatically start a deployment.

```bash
gcloud builds triggers create github \
  --repo-owner=json-darby \
  --repo-name=apparitions \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --name=deploy-apparitions \
  --region=europe-west2
```
*(Note: If it asks you to authorize GitHub in your browser, follow the prompts).*

---

### Step 4: First Manual Deploy (To Inject Secrets)

Because your API keys are highly sensitive, they shouldn't be inside your code on GitHub. We need to physically hand them to Cloud Run just once during the very first deployment so they are securely locked away in the environment variables.

Run this command, replacing `your_api_key_here` with your actual Gemini API keys.

```bash
gcloud run deploy apparitions-service \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_api_key_here,WHISPER_SYSTEM_GEMINI=your_api_key_here,WHISPER_SYSTEM_MISTRAL=your_api_key_here,APPARITIONS_LESSON_KEY=your_api_key_here,APPARITIONS_LESSON_KEY_MISTRAL=your_api_key_here"
```

**(When it finishes, it will print out the live `https://...` URL for your app!)**

---

### 🚀 Zero-Touch Deployments from now on

You never have to run those commands again.

Whenever you want to update the live website, simply:
1. `git add .`
2. `git commit -m "My update"`
3. `git push origin main`

Google Cloud will see the push, build the Docker container in the background, and seamlessly hot-swap the live server to the new version without any downtime.
