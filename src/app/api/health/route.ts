import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export function GET() {
  return NextResponse.json(
    { ok: true, service: "marisqueria-os", version: 1 },
    { headers: corsHeaders },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
