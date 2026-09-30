declare const require: any;
import { base64ToBytes, bytesToBase64, splitDataUri, extForMime } from '../src/utils/b64';

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  actual=${JSON.stringify(actual)}`);
}

const fs = require('fs');
const png = fs.readFileSync('assets/images/icon.png');
const b64 = png.toString('base64');
const round = bytesToBase64(base64ToBytes(b64));
check('base64 round-trips a real PNG byte-for-byte', round === b64, true);
check('decoded length matches file size', base64ToBytes(b64).length, png.length);
check('first 4 bytes are the PNG signature', Array.from(base64ToBytes(b64).slice(0, 4)), [137, 80, 78, 71]);
const split = splitDataUri(`data:image/png;base64,${b64}`);
check('data URI split mime', split?.mime, 'image/png');
check('ext for png', extForMime('image/png'), 'png');
check('ext for jpeg', extForMime('image/jpeg'), 'jpeg');
check('non-data-uri rejected', splitDataUri('file:///tmp/x.png'), null);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
