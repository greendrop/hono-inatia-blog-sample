/**
 * GET リクエストで Inertia JSON レスポンスを得るためのヘッダ。
 * POST/PUT の JSON body を伴うリクエストにも Content-Type を加えて使用する。
 */
export const inertiaHeaders = {
  "Content-Type": "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
};

/** Inertia JSON レスポンスの型 */
export type InertiaPage<P = Record<string, unknown>> = {
  component: string;
  props: P & { flash?: string | null };
  url: string;
  version: string;
};
