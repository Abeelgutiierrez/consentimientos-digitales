"use server";
import { redirect } from "next/navigation";
import { login, setSessionCookie } from "@/server/auth";
import { requestMeta } from "@/server/request";

export async function loginAction(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "").slice(0, 200);
  const result = await login(email, password, await requestMeta());
  if (!result.ok) return { error: result.reason };
  await setSessionCookie(result.token);
  redirect("/panel");
}
