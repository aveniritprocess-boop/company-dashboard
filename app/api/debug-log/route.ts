import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const logPath = path.join(process.cwd(), 'scratch', 'error.log');
        
        // Ensure scratch directory exists
        const scratchDir = path.dirname(logPath);
        if (!fs.existsSync(scratchDir)) {
            fs.mkdirSync(scratchDir, { recursive: true });
        }

        const logEntry = `\n--- NEW ERROR AT ${new Date().toISOString()} ---\n` +
                         `Message: ${body.message}\n` +
                         `Stack:\n${body.stack}\n` +
                         `Component Stack:\n${body.componentStack}\n`;

        fs.appendFileSync(logPath, logEntry);
        
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Failed to log debug info:', err);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
