import { NextResponse } from 'next/server';
import { getAllUsers, updateUser, saveAllUsers } from '@/lib/users-db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'lingzhi-dev-secret-change-in-production';

async function isAdmin(): Promise<{ ok: boolean; adminId?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return { ok: false };
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    return { ok: decoded.role === 'ADMIN', adminId: decoded.id };
  } catch {
    return { ok: false };
  }
}

export async function GET() {
  const auth = await isAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const users = getAllUsers().map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  }));
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const auth = await isAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const { id, status, role } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
  }
  if (id === auth.adminId && (role === 'USER' || status === 'PENDING' || status === 'REJECTED')) {
    return NextResponse.json({ error: "不能修改自己的权限" }, { status: 400 });
  }
  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (role) updates.role = role;
  const updatedUser = updateUser(id, updates);
  if (!updatedUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  return NextResponse.json({ user: { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, createdAt: updatedUser.createdAt } });
}

export async function DELETE(request: Request) {
  const auth = await isAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
  }
  if (id === auth.adminId) {
    return NextResponse.json({ error: "不能删除自己的账号" }, { status: 400 });
  }
  const users = getAllUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  saveAllUsers(filtered);
  return NextResponse.json({ message: "用户已删除" });
}
