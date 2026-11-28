import { NextResponse, type NextRequest } from "next/server";
import { login, setSessionCookie } from "@/server/auth";
import { DEMO_OWNERS, DEMO_PASSWORD, isDemoStudio } from "@/server/demo";
import { requestMeta } from "@/server/request";

// Entrar al panel de un estudio de demo con un clic (solo en modo demo).
// Hace el mismo acceso que el formulario de login con las credenciales públicas de demo;
// si alguien cambió esa contraseña, se cae al login normal.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("estudio") ?? "";
  const ir = req.nextUrl.searchParams.get("ir") ?? "/panel";
  const target = /^\/panel(\/[\w\-/]*)?$/.test(ir) ? ir : "/panel";
  if (!isDemoStudio(slug)) return NextResponse.redirect(new URL("/login", req.url));
  const result = await login(DEMO_OWNERS[slug]!, DEMO_PASSWORD, await requestMeta());
  if (!result.ok) return NextResponse.redirect(new URL("/login", req.url));
  await setSessionCookie(result.token);
  return NextResponse.redirect(new URL(target, req.url));
}
