import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import type { LayoutPDF, StoryboardPanel } from '../types';

const FONT = 'Avenir Next Condensed';

async function imagenABase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error al cargar imagen para el PPT:', error);
    return null;
  }
}

/** Rectángulo que mantiene la relación 16:9 dentro del espacio disponible. */
function calcImageRect(maxW: number, maxH: number) {
  const ratio = 16 / 9;
  const idealH = maxW / ratio;
  if (idealH <= maxH) return { w: maxW, h: idealH };
  return { w: maxH * ratio, h: maxH };
}

type Diapositiva = ReturnType<PptxGenJS['addSlide']>;

function addImageToSlide(slide: Diapositiva, imgData: string | null, x: number, y: number, w: number, h: number) {
  if (!imgData) return;
  slide.addImage({ data: imgData, x, y, w, h, sizing: { type: 'contain', w, h } });
}

/** Post-procesa el PPTX para añadir un borde blanco de 4 pt a cada imagen. */
async function addBordersToPPTX(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'),
  );

  const borderXml = '<a:ln w="25400"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>';

  for (const slidePath of slideFiles) {
    const file = zip.file(slidePath);
    if (!file) continue;

    let xmlStr = await file.async('string');
    xmlStr = xmlStr.replace(/<p:pic>([\s\S]*?)<\/p:pic>/g, (picMatch) => {
      if (picMatch.includes('<a:ln ')) return picMatch;

      return picMatch.replace(/(<p:spPr>)([\s\S]*?)(<\/p:spPr>)/, (_match, open, content, close) => {
        if (content.includes('<a:prstGeom')) {
          return `${open}${content.replace(/(<\/a:prstGeom>)/, `$1${borderXml}`)}${close}`;
        }
        return `${open}${borderXml}${content}${close}`;
      });
    });

    zip.file(slidePath, xmlStr);
  }

  return await zip.generateAsync({ type: 'arraybuffer' });
}

export async function generateStoryboardPPT(
  storyboardName: string,
  panels: StoryboardPanel[],
  locutions: string[],
  panelsPerSlide: LayoutPDF,
  colorCliente = 'E8580C',
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CUSTOM_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'CUSTOM_16_9';

  const SW = 13.333;
  const SH = 7.5;
  const M = 0.3;
  const BG = '0F172B';
  const TXT_COLOR = 'FFFFFF';

  const base64Images: (string | null)[] = await Promise.all(
    panels.map((panel) => {
      if (!panel.image_url) return Promise.resolve(null);
      const url = panel.version ? `${panel.image_url}?v=${panel.version}` : panel.image_url;
      return imagenABase64(url);
    }),
  );

  const perPage = panelsPerSlide;
  const totalSlides = Math.ceil(panels.length / perPage);

  for (let s = 1; s <= totalSlides; s++) {
    const slide = pptx.addSlide();
    slide.background = { color: BG };

    if (panelsPerSlide === 1) {
      const idx = s - 1;
      if (idx >= panels.length) break;

      const panel = panels[idx];
      const loc = locutions[idx] || '';
      const img = base64Images[idx];

      const imgY = M + 0.55;
      const imgBoxW = SW - M * 2;
      const imgBoxH = SH - imgY - 0.7;
      const { w: imgW, h: imgH } = calcImageRect(imgBoxW, imgBoxH);
      const offsetX = (imgBoxW - imgW) / 2;
      const offsetY = (imgBoxH - imgH) / 2;
      const imgLeft = M + offsetX;

      slide.addText(panel.filename || `Panel ${idx + 1}`, {
        x: imgLeft,
        y: M,
        w: SW - imgLeft - M,
        h: 0.45,
        fontSize: 20,
        fontFace: FONT,
        color: TXT_COLOR,
        bold: true,
      });
      addImageToSlide(slide, img, imgLeft, imgY + offsetY, imgW, imgH);
      slide.addText(
        [
          { text: 'Locución: ', options: { bold: true, fontFace: FONT, fontSize: 15, color: TXT_COLOR } },
          { text: loc, options: { italic: true, fontFace: FONT, fontSize: 15, color: TXT_COLOR } },
        ],
        { x: imgLeft, y: SH - M - 0.4, w: SW - imgLeft - M, h: 0.5 },
      );
    } else if (panelsPerSlide === 4 || panelsPerSlide === 6) {
      const cols = panelsPerSlide === 4 ? 2 : 3;
      const rows = 2;
      const gapX = panelsPerSlide === 4 ? 0.35 : 0.25;
      const gapY = 0.3;
      const cardW = (SW - M * 2 - gapX * (cols - 1)) / cols;
      const cardH = (SH - M * 2 - gapY * (rows - 1)) / rows;
      const titleH = panelsPerSlide === 4 ? 0.35 : 0.28;
      const locH = 0.35;
      const imgBoxW = cardW;
      const imgBoxH = cardH - titleH - locH;
      const titleSize = 13;
      const locSize = 11;

      for (let cell = 0; cell < perPage; cell++) {
        const idx = (s - 1) * perPage + cell;
        if (idx >= panels.length) break;

        const col = cell % cols;
        const row = Math.floor(cell / cols);
        const x = M + col * (cardW + gapX);
        const y = M + row * (cardH + gapY);
        const panel = panels[idx];
        const loc = locutions[idx] || '';
        const img = base64Images[idx];

        const { w: imgW, h: imgH } = calcImageRect(imgBoxW, imgBoxH);
        const offsetX = (imgBoxW - imgW) / 2;
        const imgLeft = x + offsetX;
        const imgY = y + titleH + 0.03;

        slide.addText(panel.filename || 'Plano', {
          x: imgLeft,
          y,
          w: cardW - offsetX,
          h: titleH,
          fontSize: titleSize,
          fontFace: FONT,
          color: TXT_COLOR,
          bold: true,
        });
        addImageToSlide(slide, img, imgLeft, imgY, imgW, imgH);

        const textY = imgY + imgH + 0.06;
        slide.addText(
          [
            { text: 'Locución: ', options: { bold: true, fontFace: FONT, fontSize: locSize, color: TXT_COLOR } },
            { text: loc, options: { italic: true, fontFace: FONT, fontSize: locSize, color: TXT_COLOR } },
          ],
          { x: imgLeft, y: textY, w: cardW - offsetX, h: cardH - (textY - y), valign: 'top' },
        );
      }
    } else if (panelsPerSlide === 20) {
      const cols = 5;
      const rows = 4;
      const gapX = 0.03;
      const gapY = 0.03;
      const cardW = (SW - M * 2 - gapX * (cols - 1)) / cols;
      const cardH = (SH - M * 2 - gapY * (rows - 1)) / rows;
      const titleH = 0.18;
      const locH = 0.2;
      const imgBoxW = cardW;
      const imgBoxH = cardH - titleH - locH;

      for (let cell = 0; cell < perPage; cell++) {
        const idx = (s - 1) * perPage + cell;
        if (idx >= panels.length) break;

        const col = cell % cols;
        const row = Math.floor(cell / cols);
        const x = M + col * (cardW + gapX);
        const y = M + row * (cardH + gapY);
        const panel = panels[idx];
        const img = base64Images[idx];

        const { w: imgW, h: imgH } = calcImageRect(imgBoxW, imgBoxH);
        const offsetX = (imgBoxW - imgW) / 2;
        const imgLeft = x + offsetX;
        const imgY = y + titleH + 0.04;

        slide.addText(panel.filename || 'Plano', {
          x: imgLeft,
          y,
          w: cardW - offsetX,
          h: titleH,
          fontSize: 10,
          fontFace: FONT,
          color: TXT_COLOR,
          bold: true,
        });
        addImageToSlide(slide, img, imgLeft, imgY, imgW, imgH);
      }
    }
  }

  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const borderedBuffer = await addBordersToPPTX(buffer);

  const blob = new Blob([borderedBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${storyboardName.toLowerCase().replace(/\s+/g, '_')}_storyboard.pptx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
