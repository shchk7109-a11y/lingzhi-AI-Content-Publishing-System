import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'test-write.txt');
    fs.writeFileSync(filePath, `Test write at ${new Date().toISOString()}`);
    return NextResponse.json({ status: "ok", path: filePath });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
