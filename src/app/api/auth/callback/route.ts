// import { createClient } from "@/lib/supabase/server";
// import { NextResponse } from "next/server";

// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const code = searchParams.get("code");
//   const next = searchParams.get("next") ?? "/dashboard";

//   if (code) {
//     const supabase = await createClient();
//     const { error } = await supabase.auth.exchangeCodeForSession(code);
//     if (!error) {
//       const url = request.headers.get("origin") + next;
//       return NextResponse.redirect(url);
//     }
//   }

//   // return the user to login with error
//   return NextResponse.redirect(
//     request.headers.get("origin") + "/login?error=invalid_code",
//   );
// }


import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const origin = request.headers.get("origin") || "";

  // fallback safety (important for production)
  const baseUrl =
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const url = new URL(next, baseUrl);
      return NextResponse.redirect(url);
    }
  }

  // error fallback redirect
  return NextResponse.redirect(
    new URL("/login?error=invalid_code", baseUrl)
  );
}