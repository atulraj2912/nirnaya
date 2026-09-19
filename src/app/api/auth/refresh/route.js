import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
  getRefreshTokenFromRequest,
  setAccessTokenCookie,
} from "@/lib/auth";

export async function POST(request) {
  try {
    const refreshToken = getRefreshTokenFromRequest(request);

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token not found" },
        { status: 401 }
      );
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        designation: true,
        organizationId: true,
        departmentId: true,
        employeeId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is not active" },
        { status: 403 }
      );
    }

    const newAccessToken = await signAccessToken({
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
    });

    const response = NextResponse.json({ user });
    setAccessTokenCookie(response, newAccessToken);

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
