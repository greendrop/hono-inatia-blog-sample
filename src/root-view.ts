import { serializePage, type RootView } from "@hono/inertia";

export const rootView: RootView = (page) => `<!DOCTYPE html>
<html>
  <head>
    <title>Blog</title>
    <script type="module" src="/src/client.tsx"></script>
  </head>
  <body>
    <script data-page="app" type="application/json">${serializePage(page)}</script>
    <div id="app"></div>
  </body>
</html>`;
