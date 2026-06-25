import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const FLASH = "flash";
const ERRORS = "errors";
const OLD = "old";

const COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
  maxAge: 60,
};

// 成功メッセージをセット（リダイレクト前に呼ぶ）
export const setFlash = (c: Context, message: string) => {
  setCookie(c, FLASH, encodeURIComponent(message), COOKIE_OPTIONS);
};

// バリデーションエラーと入力値をセット（リダイレクト前に呼ぶ）
export const setErrors = (
  c: Context,
  errors: Record<string, string>,
  old: Record<string, unknown>,
) => {
  setCookie(c, ERRORS, encodeURIComponent(JSON.stringify(errors)), COOKIE_OPTIONS);
  setCookie(c, OLD, encodeURIComponent(JSON.stringify(old)), COOKIE_OPTIONS);
};

// Cookie を読んで c.render に flash / errors / old を注入し、Cookie を消す
export const flash = (): MiddlewareHandler => async (c, next) => {
  const rawFlash = getCookie(c, FLASH);
  const message = rawFlash ? decodeURIComponent(rawFlash) : null;
  if (rawFlash) deleteCookie(c, FLASH, { path: "/" });

  const rawErrors = getCookie(c, ERRORS);
  const rawOld = getCookie(c, OLD);

  let errors: Record<string, string> | null = null;
  let old: Record<string, unknown> | null = null;

  if (rawErrors) {
    try {
      errors = JSON.parse(decodeURIComponent(rawErrors));
    } catch {
      errors = null;
    }
    deleteCookie(c, ERRORS, { path: "/" });
  }
  if (rawOld) {
    try {
      old = JSON.parse(decodeURIComponent(rawOld));
    } catch {
      old = null;
    }
    deleteCookie(c, OLD, { path: "/" });
  }

  const render = c.render;
  // c.render をラップして全ページの props に flash / errors / old を足す
  (c as any).render = (component: any, props?: any) =>
    render(component, {
      ...(props ?? {}),
      flash: message,
      ...(errors ? { errors } : {}),
      ...(old ? { old } : {}),
    });

  await next();
};
