# AWS Object detection

## Link to the web app

View this app in your browser: https://aws-object-detection.ai.studio

## Run Locally

Follow these steps to run the application locally on your machine.

### 1. Prerequisites

- **Node.js**: Version 18.x or higher (v20+ recommended). Check with `node -v`.
- **npm**: Version 9+ (comes bundled with Node.js). Check with `npm -v`.
- **API Credentials**:
  - **Google Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).
  - **AWS Bedrock Credentials**: If you want to use Amazon Bedrock models (such as Amazon Nova 2 Lite, Nova Pro, Nova Lite), ensure your AWS account has model access enabled in the Amazon Bedrock console.

---

### 2. Installation

1. Clone or download the repository, then navigate to the project directory:
   ```bash
   cd aws-object-detection-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

### 3. Environment Variables Configuration

Create a `.env` file in the root directory by copying from `.env.example`:

```bash
cp .env.example .env
```

Open `.env` and set your credentials:

```env
# Required for Google Gemini vision models (Gemini 3.5 Flash, 3.8 Flash, etc.)
GEMINI_API_KEY="your-gemini-api-key-here"

# Application URL (optional for local development, defaults to localhost:3000)
APP_URL="http://localhost:3000"

# Optional: Amazon Bedrock credentials (for Amazon Nova models)
AWS_ACCESS_KEY_ID="your-aws-access-key-id"
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
AWS_REGION="us-east-1"
# Required ONLY if using temporary STS / AWS SSO credentials (keys starting with ASIA):
AWS_SESSION_TOKEN=""
```

> **Tip for AWS Credentials:**
> - If your `AWS_ACCESS_KEY_ID` starts with `AKIA` (permanent IAM user), leave `AWS_SESSION_TOKEN` empty.
> - If your `AWS_ACCESS_KEY_ID` starts with `ASIA` (temporary AWS SSO/STS session), paste your active session token into `AWS_SESSION_TOKEN`.

---

### 4. Running the Development Server

Start the full-stack development server:

```bash
npm run dev
```

Once started, open your browser and navigate to:

```
http://localhost:3000
```

The dev server uses `tsx` to run the Express backend with integrated Vite middleware, providing rapid feedback and reload.

---

### 5. Building and Running for Production

To test the optimized production build locally:

1. Build both the Vite frontend bundle and the self-contained backend server:
   ```bash
   npm run build
   ```

2. Start the compiled production server:
   ```bash
   npm run start
   ```

3. Visit `http://localhost:3000`.

---

### 6. Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Runs the full-stack Express + Vite application in development mode (`tsx server.ts`) on port 3000. |
| `npm run build` | Builds the client static bundle (`vite build`) and packages the server into `dist/server.cjs` using `esbuild`. |
| `npm run start` | Runs the compiled CommonJS server in production mode (`node dist/server.cjs`). |
| `npm run lint` | Performs TypeScript type checks across the codebase (`tsc --noEmit`). |
| `npm run clean` | Removes build outputs (`dist/` directory). |

---

### 7. Common Troubleshooting

- **Gemini API Error ("GEMINI_API_KEY is not configured")**:
  Make sure your `.env` file exists in the project root and contains a valid `GEMINI_API_KEY`. Restart the dev server after editing `.env`.
- **Bedrock Model Access Denied (`AccessDeniedException`)**:
  In the AWS Management Console, open **Amazon Bedrock** > **Model access** and ensure access is requested and granted for the models you are targeting (e.g. Amazon Nova Pro / Nova Lite).
- **Port 3000 in use**:
  If port 3000 is already in use by another application, terminate the occupying process or specify another port when running.
