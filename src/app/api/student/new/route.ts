import { after } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { v4 as uuid } from "uuid";
import { getSession, updateSession } from "@/backend/actions/session";

export async function GET(request: NextRequest) {
  const session = await getSession();
  session.studentId = uuid();
  await updateSession(session);
  const response = NextResponse.json(session);
  const details = geolocation(request);
  const ip = ipAddress(request);
  after(async () => {
    console.log("New studentId:", session.studentId);
    console.log(details);
    console.log(ip);
  });
  return response;
}
