import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) throw new Error('Usage: node audit_existing_sheet.mjs input.xlsx output.json');

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheets = [];
for (let index = 0; index < 100; index += 1) {
  let sheet;
  try {
    sheet = workbook.worksheets.getItemAt(index);
  } catch (error) {
    break;
  }
  if (!sheet) break;
  const used = sheet.getUsedRange(true);
  const values = used ? used.values : [];
  sheets.push({ name: sheet.name, rows: values });
}
const overview = await workbook.inspect({ kind: 'sheet', include: 'id,name', maxChars: 8000 });
await fs.writeFile(outputPath, JSON.stringify({ sheets }, null, 2), 'utf8');
console.log(overview.ndjson);
console.log(JSON.stringify(sheets.map(sheet => ({ name: sheet.name, rows: sheet.rows.length, columns: Math.max(0, ...sheet.rows.map(row => row.length)) }))));
