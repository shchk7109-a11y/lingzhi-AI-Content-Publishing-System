import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getAllUsers } from '@/lib/users-db';

const JWT_SECRET = process.env.JWT_SECRET || 'lingzhi-dev-secret-change-in-production';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string };

    // Verify user still exists and is active
    const users = getAllUsers();
    const user = users.find(u => u.id === decoded.id);

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ error: "账号已失效，请重新登录" }, { status: 403 });
    }

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (error) {
    return NextResponse.json({ error: "登录已过期，请重新登录" }, { status: 401 });
  }
}
