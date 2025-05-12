import { after } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { geolocation, ipAddress } from "@vercel/functions";
import { v4 as uuid } from "uuid";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const studentId = uuid();
  const sessionId = uuid();
  cookieStore.set({
    name: "studentId",
    value: studentId,
    httpOnly: true,
    secure: true,
    maxAge: 5 * 60,
  });
  cookieStore.set({
    name: "sessionId",
    value: sessionId,
    httpOnly: true,
    secure: true,
    maxAge: 5 * 60,
  });
  const res = NextResponse.json({
    studentId,
    sessionId,
    message: "Student created successfully",
  });

  const details = geolocation(request);
  const ip = ipAddress(request);
  after(async () => {
    console.log(details);
    console.log(ip);
  });
  return res;
}
