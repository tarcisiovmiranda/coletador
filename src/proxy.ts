import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Checagem OTIMISTA (só o JWT). A autorização real — incluindo colaborador
// ativo e tenant — é refeita no servidor em toda página/ação via requireUser/requireAdmin.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("coletador_session")?.value;

  let perfil: string | null = null;
  const secret = process.env.AUTH_SECRET;
  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      perfil = typeof payload.perfil === "string" ? payload.perfil : null;
    } catch {
      perfil = null;
    }
  }

  const home = perfil === "ADMIN" ? "/admin/equipe" : "/coletor";

  if (pathname === "/login") {
    return perfil ? NextResponse.redirect(new URL(home, req.url)) : NextResponse.next();
  }
  if (!perfil) return NextResponse.redirect(new URL("/login", req.url));
  if (pathname.startsWith("/admin") && perfil !== "ADMIN") {
    return NextResponse.redirect(new URL(home, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/coletor/:path*"],
};
