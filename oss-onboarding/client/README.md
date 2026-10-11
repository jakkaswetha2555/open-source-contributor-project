# client (React + Vite)

    npm install
    npm run dev      # http://localhost:5173, proxies /api to http://localhost:5000
    npm run build

Screens: project discovery, issue browser, documentation Q&A (cited answers), starter plan (issue matching,
onboarding agent, plan submission), maintainer review inbox, plus signup, login, email verification and password reset.
All requests go through `src/api.js`, which sends the session cookie and the CSRF header.
