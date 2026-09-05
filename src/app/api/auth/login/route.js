import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { verifyPassword, signAccessToken, signRefreshToken, setAccessTokenCookie, setRefreshTokenCookie } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email (email is unique within org, but we search globally for login)
    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        passwordHash: true,
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
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Account is not active. Please contact your administrator." },
        { status: 403 }
      );
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);

    const { passwordHash: _, ...userWithoutPassword } = user;

    const response = NextResponse.json({
      user: userWithoutPassword,
    });

    setAccessTokenCookie(response, accessToken);
    setRefreshTokenCookie(response, refreshToken);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
