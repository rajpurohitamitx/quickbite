# QuickBite — Vercel-ready project

This package is prepared for Vercel. It does **not** require Java or Maven on your PC. Vercel serves the existing QuickBite website and runs small Node.js serverless API functions.

## Deploy the website

1. Extract this ZIP.
2. Upload the contents of the `quickbite-vercel` folder to a new GitHub repository (the files `index.html`, `package.json`, `vercel.json`, `api/`, and `lib/` must be at the repository root).
3. In Vercel, choose **Add New → Project**, import that GitHub repository, and deploy with the default settings.
4. The website should open using sample data and browser local storage without database credentials.

## Optional persistent cloud database (Neo4j Aura)

Without database credentials, the site runs in **demo/local mode**: changes are kept in that visitor's browser and are not shared across devices. To enable cloud persistence:

1. Create a Neo4j Aura database and copy its Bolt URI, username, and password.
2. In Vercel → Project → Settings → Environment Variables, add:
   - `NEO4J_URI` = Aura Bolt URI, usually `neo4j+s://<your-instance>.databases.neo4j.io`
   - `NEO4J_USER` = database username, usually `neo4j`
   - `NEO4J_PASSWORD` = database password
   - `NEO4J_DATABASE` = `neo4j` (optional)
3. Redeploy the project.
4. Visit `/api/health`; it should return `{"ok":true,"database":"Neo4j"}`.

Keep database credentials private. The website currently persists its full application state as one JSON snapshot in Neo4j; this is suitable for a coursework demo, not production use. Admin pages are not protected by authentication, and payment choices are demonstration flows only.

## Important technical note

Vercel does not run the existing long-running Java HTTP server as a normal Vercel function. This Vercel package therefore uses Node.js serverless functions and the Neo4j JavaScript driver, rather than JDBC. If a course specifically requires Java JDBC, run the Java backend on a Java-capable host separately and deploy only the frontend to Vercel.
