/**
 * Stamps the company logo onto the demo workbooks in /home/user/.tmp-excel,
 * exactly the way the in-app export does (logo floating over cell A1).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stampImagesIntoXlsx } from '../src/services/excelChart';

const dir = '/home/user/.tmp-excel';
const logoDataUri = 'data:image/png;base64,' + fs.readFileSync('assets/images/logo.png').toString('base64');

for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.xlsx'))) {
  const file = path.join(dir, name);
  const stamped = stampImagesIntoXlsx(fs.readFileSync(file).toString('base64'), [
    { dataUri: logoDataUri, from: { col: 0, row: 0 }, width: 116, height: 116 },
  ]);
  fs.writeFileSync(file, Buffer.from(stamped, 'base64'));
  console.log(`stamped ${name}`);
}
