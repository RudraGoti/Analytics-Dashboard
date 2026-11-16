# Small Business Analytics Dashboard

An Angular standalone dashboard for daily revenue and expenses, backed by an Express 5 API and MongoDB/Mongoose.

## Requirements

- Node.js 20.19+ (or a version supported by Angular 21)
- npm
- MongoDB connection string (local MongoDB or a hosted MongoDB deployment)

## Run locally

1. Start the backend:

   ```bash
   cd mean-project/backend && npm install && cp .env.example .env && npm start
   ```

2. Set `MONGO_URL` in `mean-project/backend/.env` to your MongoDB connection string. The backend listens on port 3000 by default.
3. In a second terminal, start the frontend:

   ```bash
   cd mean-project && npm install && npm start
   ```

4. Open `http://localhost:4200`.

The development Angular configuration calls `http://localhost:3000/api`. For a production deployment, set `apiUrl` in `src/environments/environment.ts` to the deployed API base URL ending in `/api`.

## Configuration

| Setting | Location | Default | Description |
| --- | --- | --- | --- |
| `PORT` | `backend/.env` | `3000` | Express listening port |
| `MONGO_URL` | `backend/.env` | None | MongoDB connection URI; required for persisted data |
| `CORS_ORIGIN` | `backend/.env` | All origins | Optional comma-separated list of allowed browser origins |
| `apiUrl` (development) | `src/environments/environment.development.ts` | `http://localhost:3000/api` | API base URL used by `ng serve` |
| `apiUrl` (production) | `src/environments/environment.ts` | `https://your-api-host.example/api` | Replace with the deployed API base URL |

Never commit `.env` files or MongoDB credentials.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Reports API/database availability as `{ ok, database }` |
| `GET` | `/api/expenses` | Lists records, or filters with `date=YYYY-MM-DD` or `dateFrom` and `dateTo` |
| `GET` | `/api/expenses/balance?before=YYYY-MM-DD` | Aggregates counter, expenses, and balance strictly before the date |
| `POST` | `/api/expenses` | Creates a daily record; `action: "replace"` replaces an existing record and `"append"` appends expense rows |
| `DELETE` | `/api/expenses/:date` | Deletes the daily record for a date |

Daily records use one document per `YYYY-MM-DD` date and contain a counter and expense rows. Invalid dates and Mongoose validation errors return HTTP 400. A create collision returns HTTP 409.

## Tests and build

```bash
cd mean-project
npm run build
npm test -- --watch=false
```

## Deployment

- **Frontend (Netlify):** Build the Angular app with `npm run build`; publish the generated browser output under `dist/mean-project/browser`. Set the production `apiUrl` to the public API URL and configure an SPA fallback to `index.html`.
- **Backend (Node host):** Deploy `mean-project/backend` to a Node-capable host, install its dependencies, and run `npm start`. Configure `PORT`, `MONGO_URL`, and `CORS_ORIGIN` as host environment variables. Allow the Netlify site origin in `CORS_ORIGIN`.
- Do not put database credentials in frontend environment files; the frontend URL is public configuration.

## Known limitations

- Bill upload controls are for UI only; files are not uploaded or persisted.
- The app has no authentication or per-user data separation. Do not expose it publicly with sensitive business data until access control is added.
- Settings are stored per browser in local storage and do not synchronize across devices.
- Offline changes are not queued or synchronized automatically.
- Profile and Logout links and the header account icon are placeholders.
