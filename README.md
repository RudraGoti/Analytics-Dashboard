# Analytics-Dashboard

## Run locally

Requirements: Node.js and npm, plus a MongoDB connection string.

Start the backend in one terminal:

```bash
cd mean-project/backend
npm install
# Copy .env.example to .env if needed, then set MONGO_URL in .env.
npm start
```

Start the frontend in a second terminal:

```bash
cd mean-project
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200). The backend listens on
port 3000 by default. See [mean-project/README.md](mean-project/README.md) for
configuration, API, testing, and deployment details.
