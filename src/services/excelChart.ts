/**
 * Injects one or more images into an already-generated .xlsx payload.
 *
 * SheetJS 0.18 cannot write images, so the workbook (a ZIP of XML parts) is
 * unpacked, the media/drawing parts and their relationships are added, and the
 * first worksheet is linked to the drawing. No expo imports → Node-testable.
 */
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { base64ToBytes, bytesToBase64, extForMime, splitDataUri } from '../utils/b64';

const NS_DRAWING = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_DRAW_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_DRAWING = `${NS_DRAW_REL}/drawing`;
const REL_IMAGE = `${NS_DRAW_REL}/image`;

export interface XlsxImage {
  /** data:image/png;base64,... (what `readLogoDataUri` returns). */
  dataUri: string;
  /** 0-based anchor cell of the image's top-left corner. */
  from: { col: number; row: number };
  /** Display size in CSS pixels (1 px = 9525 EMU). */
  width: number;
  height: number;
}

/** Resolve the first worksheet part and the sheet name used by its rels file. */
function firstSheetPath(files: Record<string, Uint8Array>): { path: string; name: string } {
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : '');
  const wb = read('xl/workbook.xml');
  const rels = read('xl/_rels/workbook.xml.rels');
  const ridMatch = /<sheet[^>]*r:id="([^"]+)"/.exec(wb);
  const rid = ridMatch ? ridMatch[1] : 'rId1';
  const relMatch = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels);
  let target = relMatch ? relMatch[1] : 'worksheets/sheet1.xml';
  target = target.replace(/^\//, '');
  if (!target.startsWith('xl/')) target = `xl/${target}`;
  return { path: target, name: target.split('/').pop() as string };
}

export function stampImagesIntoXlsx(xlsxBase64: string, images: XlsxImage[]): string {
  if (!images.length) return xlsxBase64;

  const files = unzipSync(base64ToBytes(xlsxBase64));
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : '');
  const write = (p: string, s: string) => {
    files[p] = strToU8(s);
  };

  const { path: sheetPath, name: sheetName } = firstSheetPath(files);

  const drawingRels: string[] = [];
  const anchors: string[] = [];
  const defaults: string[] = [];

  images.forEach((img, i) => {
    const split = splitDataUri(img.dataUri);
    if (!split) return;
    const ext = extForMime(split.mime);
    const media = `image${i + 1}.${ext}`;
    files[`xl/media/${media}`] = base64ToBytes(split.base64);

    const emb = i + 1;
    drawingRels.push(`<Relationship Id="rId${emb}" Type="${REL_IMAGE}" Target="../media/${media}"/>`);
    defaults.push(`<Default Extension="${ext}" ContentType="${split.mime}"/>`);

    const toCol = img.from.col + Math.max(1, Math.ceil(img.width / 64));
    const toRow = img.from.row + Math.max(1, Math.ceil(img.height / 20));
    anchors.push(
      `<xdr:twoCellAnchor editAs="oneCell">` +
        `<xdr:from><xdr:col>${img.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${img.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        `<xdr:pic>` +
        `<xdr:nvPicPr><xdr:cNvPr id="${100 + emb}" name="logo${emb}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip r:embed="rId${emb}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.width * 9525}" cy="${
          img.height * 9525
        }"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        `</xdr:pic><xdr:clientData/>` +
        `</xdr:twoCellAnchor>`
    );
  });

  if (!anchors.length) return xlsxBase64;

  write(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_DRAWING}" xmlns:r="${NS_DRAW_REL}">` +
      anchors.join('') +
      `</xdr:wsDr>`
  );
  write(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRels.join(
        ''
      )}</Relationships>`
  );

  /* --- link worksheet → drawing --- */
  const sheetRelsPath = `xl/worksheets/_rels/${sheetName}.rels`;
  const sheetRels = read(sheetRelsPath);
  let maxRid = 0;
  const ridRe = /Id="rId(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = ridRe.exec(sheetRels))) maxRid = Math.max(maxRid, Number(m[1]));
  const sheetRid = `rId${maxRid + 1}`;
  const drawingRel = `<Relationship Id="${sheetRid}" Type="${REL_DRAWING}" Target="/xl/drawings/drawing1.xml"/>`;
  write(
    sheetRelsPath,
    sheetRels
      ? sheetRels.replace('</Relationships>', `${drawingRel}</Relationships>`)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel}</Relationships>`
  );

  const sheetXml = read(sheetPath);
  write(sheetPath, sheetXml.replace('</worksheet>', `<drawing r:id="${sheetRid}"/></worksheet>`));

  /* --- content types --- */
  let ct = read('[Content_Types].xml');
  const wanted = [...new Set(defaults)];
  const addDefaults = wanted.filter((d) => !ct.includes(d.split('Extension="')[1].split('"')[0]));
  ct = ct.replace(
    '</Types>',
    `${addDefaults.join('')}<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
  );
  write('[Content_Types].xml', ct);

  return bytesToBase64(zipSync(files, { level: 6 }));
}
