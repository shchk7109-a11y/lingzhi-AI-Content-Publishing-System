import { NextResponse } from 'next/server';
import { countUsers } from '@/lib/users-db';

export async function GET() {
  try {
    const userCount = countUsers();
    return NextResponse.json({ status: "ok", count: userCount });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
