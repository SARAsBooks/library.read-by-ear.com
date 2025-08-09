import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      studentId: string;
      sessionId?: string;
      userId?: string;
    };
    const { studentId, sessionId } = body;

    // TODO: Replace with actual auth.sara.ai API call
    // For now, generate a simple development token
    const token = generateDevelopmentToken(studentId, sessionId);

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 },
    );
  }
}

function generateDevelopmentToken(
  studentId: string,
  sessionId?: string,
): string {
  // Simple development token - replace with proper JWT from auth.sara.ai
  const payload = {
    sub: studentId,
    sessionId: sessionId,
    iss: "read-by-ear-dev",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  return btoa(JSON.stringify(payload));
}
