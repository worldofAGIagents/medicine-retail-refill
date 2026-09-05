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

      const fileName = file.name.toLowerCase();
      let records: any[] = [];
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheet = workbook.SheetNames[0];
        records = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
      } else {
        const text = await file.text();
        const Papa = (await import('papaparse')).default;
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        records = result.data as any[];
      }

      const results = await parseMargCSV(records, type);
      return NextResponse.json({ success: true, results });
    } else {
      // JSON body
      const body = await request.json();
      const { type = 'medicines', data, csvText } = body;
      
      let input: any = data;
      if (!input && csvText) {
        input = csvText;
      }

      if (!input) {
        return NextResponse.json({ error: 'No data or CSV/Excel provided' }, { status: 400 });
      }

      const results = await parseMargCSV(input, type);
      return NextResponse.json({ success: true, results });
    }
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message || 'Error parsing CSV' }, { status: 500 });
  }
}
