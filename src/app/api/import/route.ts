import { NextResponse } from 'next/server';
import { parseMargCSV } from '@/lib/marg-importer';
import Papa from 'papaparse';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const type = (formData.get('type') as string) || 'medicines';
      
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const text = await file.text();
      const results = await parseMargCSV(text, type);
      return NextResponse.json({ success: true, results });
    } else {
      // JSON body
      const body = await request.json();
      const { type = 'medicines', data, csvText } = body;
      
      let text = csvText;
      if (!text && data && Array.isArray(data)) {
        text = Papa.unparse(data);
      }

      if (!text) {
        return NextResponse.json({ error: 'No data or CSV text provided' }, { status: 400 });
      }

      const results = await parseMargCSV(text, type);
      return NextResponse.json({ success: true, results });
    }
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message || 'Error parsing CSV' }, { status: 500 });
  }
}
