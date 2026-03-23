import { NextResponse } from 'next/server';
import { getKnowledgeBase, saveKnowledgeBase } from '@/lib/knowledge-server';

export async function GET() {
  const data = getKnowledgeBase();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const success = saveKnowledgeBase(body);
    if (success) {
      return NextResponse.json({ message: "Saved successfully" });
    } else {
      return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
