import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const FLASH = "flash";

// 成功メッセージをセット（リダイレクト前に呼ぶ）
export const setFlash = (c: Context, message: string) => {
  setCookie(c, FLASH, encodeURIComponent(message), {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 60,
  });
};

// Cookie を読んで c.render に flash を注入し、Cookie を消す
export const flash = (): MiddlewareHandler => async (c, next) => {
  const raw = getCookie(c, FLASH);
  const message = raw ? decodeURIComponent(raw) : null;
  if (raw) deleteCookie(c, FLASH, { path: "/" });

  const render = c.render;
  // c.render をラップして全ページの props に flash を足す
  (c as any).render = (component: any, props?: any) =>
    render(component, { ...(props ?? {}), flash: message });

  await next();
};
