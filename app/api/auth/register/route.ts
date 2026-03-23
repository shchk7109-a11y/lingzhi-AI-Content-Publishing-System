import { NextResponse } from 'next/server';
import { getAllUsers, createUser, countUsers } from '@/lib/users-db';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "密码长度至少为6位" }, { status: 400 });
    }

    const users = getAllUsers();
    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return NextResponse.json({ error: "该用户名已被注册" }, { status: 400 });
    }

    const isFirstUser = countUsers() === 0;

    const newUser = {
      id: Date.now().toString(),
      username,
      passwordHash: password, // 明文存储（与现有数据兼容）
      role: isFirstUser ? 'ADMIN' as const : 'USER' as const,
      status: isFirstUser ? 'ACTIVE' as const : 'PENDING' as const,
      createdAt: new Date().toISOString(),
    };

    createUser(newUser);

    return NextResponse.json({
      message: isFirstUser
        ? "管理员账号创建成功，请登录"
        : "注册成功，请等待管理员审核",
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: error.message || "注册失败，请稍后重试" }, { status: 500 });
  }
}
