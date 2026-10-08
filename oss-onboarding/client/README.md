# client (React + Vite)

Owners: 25071A0545 (auth, discovery) and 25071A0553 (issues, docs reader).

Scaffold with:

    npm create vite@latest . -- --template react
    npm install react-router-dom

The API runs on http://localhost:5000. Call it with `credentials: 'include'` and send the CSRF token header on writes.
