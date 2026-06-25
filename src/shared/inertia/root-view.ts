import type { RootView } from "@hono/inertia";
import { render } from "./ssr";

export const rootView: RootView = async (page) => {
  const { head, body } = await render(page);
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${head.join("\n")}
    <script type="module" src="/src/client.tsx"></script>
  </head>
  <body>
    ${body}
  </body>
</html>`;
};
