import { NextResponse } from 'next/server';
import { getPrompts, savePrompts } from '@/lib/prompts';

export async function GET() {
  const data = getPrompts();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const success = savePrompts(body);
    if (success) {
      return NextResponse.json({ message: "Prompts saved successfully" });
    } else {
      return NextResponse.json({ error: "Failed to save prompts" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
