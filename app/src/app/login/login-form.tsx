"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState(loginAction, { error: null });
  return (
    <form className="card" action={action}>
      <h1>{t("title")}</h1>
      <p className="muted">{t("lead")}</p>
      {state.error && <div className="notice bad" role="alert">{t(state.error === "locked" ? "locked" : "invalid")}</div>}
      <label className="field">
        <span>{t("email")}</span>
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span>{t("password")}</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <button className="btn block lg" disabled={pending}>{pending ? t("submitting") : t("submit")}</button>
    </form>
  );
}
