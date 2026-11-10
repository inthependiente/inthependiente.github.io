import { jsPDF } from 'jspdf';
import { barlowRegular } from '../fonts/BarlowCondensed-Regular';
import { barlowBold } from '../fonts/BarlowCondensed-Bold';
import { barlowItalic } from '../fonts/BarlowCondensed-Italic';
import type { LayoutPDF, StoryboardPanel } from '../types';

const MARGEN_NARANJA: [number, number, number] = [234, 88, 12];

/** Convierte la URL de una viñeta en un data URL para incrustarla en el PDF. */
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
    console.error('Error al cargar imagen para el PDF:', error);
    return null;
  }
}

/** jsPDF necesita el formato real del archivo: incrustar un PNG como JPEG rompe el PDF. */
function formatoDeDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function dibujarImagen(
  doc: jsPDF,
  dataUrl: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!dataUrl) return false;
  doc.addImage(dataUrl, formatoDeDataUrl(dataUrl), x, y, w, h, undefined, 'FAST');
  return true;
}

export async function generateStoryboardPDF(
  storyboardName: string,
  panels: StoryboardPanel[],
  locutions: string[],
  panelsPerPage: LayoutPDF,
  showDescription = false,
): Promise<void> {
  // Todos los PDF se exportan en horizontal.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });

  doc.addFileToVFS('BarlowCondensed-Regular.ttf', barlowRegular);
  doc.addFont('BarlowCondensed-Regular.ttf', 'BarlowCondensed', 'normal');
  doc.addFileToVFS('BarlowCondensed-Bold.ttf', barlowBold);
  doc.addFont('BarlowCondensed-Bold.ttf', 'BarlowCondensed', 'bold');
  doc.addFileToVFS('BarlowCondensed-Italic.ttf', barlowItalic);
  doc.addFont('BarlowCondensed-Italic.ttf', 'BarlowCondensed', 'italic');

  const pageWidth = doc.internal.pageSize.getWidth(); // 279 mm
  const margin = 5;
  const usableWidth = pageWidth - margin * 2; // 269 mm

  const base64Images: (string | null)[] = await Promise.all(
    panels.map((panel) => {
      if (!panel.image_url) return Promise.resolve(null);
      // ?v= evita incrustar en el PDF la imagen vieja que quedó en caché tras reemplazarla.
      const url = panel.version ? `${panel.image_url}?v=${panel.version}` : panel.image_url;
      return imagenABase64(url);
    }),
  );

  const drawHeader = (pageNum: number, totalPages: number) => {
    doc.setFont('BarlowCondensed', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(storyboardName.toUpperCase(), margin, 8);

    doc.setFont('BarlowCondensed', 'normal');
    doc.setFontSize(8);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin - 20, 8);

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, 10, pageWidth - margin, 10);
  };

  const cornerRadius = 3;

  if (panelsPerPage === 1) {
    const totalPages = panels.length;
    for (let i = 0; i < panels.length; i++) {
      if (i > 0) doc.addPage();
      drawHeader(i + 1, totalPages);

      const panel = panels[i];
      const locution = locutions[i] || '';
      const imgData = base64Images[i];

      const cardX = margin;
      const cardY = 20;
      const cardW = usableWidth;
      const cardH = 187;

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, cardY, cardW, cardH, cornerRadius, cornerRadius, 'S');

      const imgW = cardW - 10;
      const imgH = ((cardW - 10) * 9) / 16;
      const imgX = cardX + 5;
      const imgY = cardY + 5;

      const dibujada = dibujarImagen(doc, imgData, imgX, imgY, imgW, imgH);
      if (!dibujada) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(120, 120, 120);
        doc.text('Imagen no disponible', imgX + 55, imgY + 45);
      }

      const textX = 14;
      let textY = cardY + 12;

      doc.setFont('BarlowCondensed', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...MARGEN_NARANJA);
      doc.text(`PLANO: ${panel.filename || `Panel ${i + 1}`}`, textX - 3, 17);

      doc.setTextColor(50, 50, 50);
      textY += 14;

      if (showDescription) {
        doc.setFont('BarlowCondensed', 'bold');
        doc.setFontSize(12);
        doc.text('DESCRIPCIÓN:', textX, textY + 130);
        doc.setFont('BarlowCondensed', 'normal');
        doc.setFontSize(11);
        const descLines = doc.splitTextToSize(panel.description || '', 250);
        doc.text(descLines, textX, textY + 135);
        textY += 15 + descLines.length * 4.5;
      } else {
        textY = imgY + imgH + 8;
      }

      if (showDescription) {
        doc.setFont('BarlowCondensed', 'bold');
        doc.setFontSize(12);
        doc.text('LOCUCIÓN / LETRA:', textX, textY + 122);
        doc.setFont('BarlowCondensed', 'italic');
        doc.setFontSize(11);
        const locLines = doc.splitTextToSize(locution, 250);
        doc.text(locLines, textX, textY + 127);
      } else {
        doc.setFont('BarlowCondensed', 'bold');
        doc.setFontSize(12);
        doc.text('LOCUCIÓN / LETRA:', textX, textY);
        doc.roundedRect(textX - 3, textY + 3, cardW - 14, 22, 2, 2, 'S');
        doc.setFont('BarlowCondensed', 'italic');
        doc.setFontSize(11);
        const locLines = doc.splitTextToSize(locution, 250);
        doc.text(locLines.slice(0, 4), textX, textY + 9);
      }
    }
  } else if (panelsPerPage === 4) {
    const panelsPerPg = 4;
    const totalPages = Math.ceil(panels.length / panelsPerPg);

    const colWidth = 110;
    const colHeight = 100;
    const colGap = 15;
    const rowGap = 2;
    const startX = margin + (usableWidth - (colWidth * 2 + colGap)) / 2;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) doc.addPage();
      drawHeader(pageNum, totalPages);

      for (let cell = 0; cell < panelsPerPg; cell++) {
        const idx = (pageNum - 1) * panelsPerPg + cell;
        if (idx >= panels.length) break;

        const colIdx = cell % 2;
        const rowIdx = Math.floor(cell / 2);
        const x = startX + colIdx * (colWidth + colGap);
        const y = 12 + rowIdx * (colHeight + rowGap);

        const panel = panels[idx];
        const locution = locutions[idx] || '';
        const imgData = base64Images[idx];

        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(x, y, colWidth, colHeight, cornerRadius, cornerRadius, 'S');

        doc.setFont('BarlowCondensed', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...MARGEN_NARANJA);
        doc.text(panel.filename || 'Plano', x + 4, y + 4.5);

        const imgW = colWidth;
        const imgH = (colWidth * 9) / 16;
        const imgY = y + 6;

        if (!dibujarImagen(doc, imgData, x, imgY, imgW, imgH)) {
          doc.setFillColor(245, 245, 245);
          doc.setFont('BarlowCondensed', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(140, 140, 140);
          doc.text('Sin imagen', x + imgW / 2 - 10, imgY + imgH / 2);
        }

        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(x, y, colWidth, colHeight, cornerRadius, cornerRadius, 'S');

        let textY = imgY + imgH + 4;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        if (showDescription) {
          doc.setFont('BarlowCondensed', 'bold');
          doc.text('Descripción:', x + 3, textY);
          doc.roundedRect(x + 2, textY + 1, 106, 10, 2, 2, 'S');
          doc.setFont('BarlowCondensed', 'normal');
          const descLines = doc.splitTextToSize(panel.description || '', colWidth - 4);
          doc.text(descLines.slice(0, 2), x + 4, textY + 5);
          textY += 4.5;
        } else {
          textY -= 1;
        }

        doc.setFont('BarlowCondensed', 'bold');
        doc.text('Locución / Letra:', x + 3, textY + (showDescription ? 10 : 1));
        doc.roundedRect(x + 2, textY + (showDescription ? 11 : 2), 106, showDescription ? 10 : 20, 2, 2, 'S');
        doc.setFont('BarlowCondensed', 'italic');
        const locLines = doc.splitTextToSize(locution, colWidth - 4);
        doc.text(locLines.slice(0, showDescription ? 2 : 4), x + 4, textY + (showDescription ? 15 : 6));
      }
    }
  } else if (panelsPerPage === 6) {
    const panelsPerPg = 6;
    const totalPages = Math.ceil(panels.length / panelsPerPg);

    const colWidth = 82;
    const colHeight = 89;
    const colGap = 10;
    const rowGap = 7;
    const startX = margin + (usableWidth - (colWidth * 3 + colGap * 2)) / 2;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) doc.addPage();
      drawHeader(pageNum, totalPages);

      for (let cell = 0; cell < panelsPerPg; cell++) {
        const idx = (pageNum - 1) * panelsPerPg + cell;
        if (idx >= panels.length) break;

        const colIdx = cell % 3;
        const rowIdx = Math.floor(cell / 3);
        const x = startX + colIdx * (colWidth + colGap);
        const y = 22 + rowIdx * (colHeight + rowGap);

        const panel = panels[idx];
        const locution = locutions[idx] || '';
        const imgData = base64Images[idx];

        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(x, y, colWidth, colHeight, cornerRadius, cornerRadius, 'S');

        doc.setFont('BarlowCondensed', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...MARGEN_NARANJA);
        doc.text(panel.filename || 'Plano', x + 3, y + 5);

        const imgW = colWidth;
        const imgH = (colWidth * 9) / 16;
        const imgY = y + 6.5;

        if (!dibujarImagen(doc, imgData, x, imgY, imgW, imgH)) {
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(x, imgY, imgW, imgH, cornerRadius, cornerRadius, 'F');
          doc.setFont('BarlowCondensed', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(140, 140, 140);
          doc.text('Sin imagen', x + imgW / 2 - 10, imgY + imgH / 2);
        }

        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(x, y, colWidth, colHeight, cornerRadius, cornerRadius, 'S');

        let textY = imgY + imgH + 4;
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        if (showDescription) {
          doc.setFont('BarlowCondensed', 'bold');
          doc.text('Descripción:', x + 4, textY + 1);
          doc.roundedRect(x + 2, textY + 2, 78, 10, 2, 2, 'S');
          doc.setFont('BarlowCondensed', 'normal');
          const descLines = doc.splitTextToSize(panel.description || '', colWidth - 10);
          doc.text(descLines.slice(0, 2), x + 5, textY + 6);
          textY += 10;
        }

        doc.setFont('BarlowCondensed', 'bold');
        doc.text('Locución / Letra:', x + 4, textY + (showDescription ? 7 : 1));
        doc.roundedRect(x + 2, textY + (showDescription ? 9 : 3), 78, showDescription ? 10 : 25, 2, 2, 'S');
        doc.setFont('BarlowCondensed', 'italic');
        const locLines = doc.splitTextToSize(locution, colWidth - 10);
        doc.text(locLines.slice(0, showDescription ? 2 : 4), x + 5, textY + (showDescription ? 13 : 7));
      }
    }
  } else if (panelsPerPage === 20) {
    const panelsPerPg = 20;
    const totalPages = Math.ceil(panels.length / panelsPerPg);

    const colWidth = 48;
    const colHeight = 47;
    const colGap = 6;
    const rowGap = 3;
    const startX = margin + (usableWidth - (colWidth * 5 + colGap * 4)) / 2;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (pageNum > 1) doc.addPage();
      drawHeader(pageNum, totalPages);

      for (let cell = 0; cell < panelsPerPg; cell++) {
        const idx = (pageNum - 1) * panelsPerPg + cell;
        if (idx >= panels.length) break;

        const colIdx = cell % 5;
        const rowIdx = Math.floor(cell / 5);
        const x = startX + colIdx * (colWidth + colGap);
        const y = 14 + rowIdx * (colHeight + rowGap);

        const panel = panels[idx];
        const locution = locutions[idx] || '';
        const imgData = base64Images[idx];

        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(x, y, colWidth, colHeight, 2, 2, 'S');

        doc.setFont('BarlowCondensed', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...MARGEN_NARANJA);
        doc.text(panel.filename || 'Plano', x + 2.5, y + 4);

        const imgW = colWidth;
        const imgH = (colWidth * 9) / 16;
        const imgY = y + 5.5;

        if (!dibujarImagen(doc, imgData, x, imgY, imgW, imgH)) {
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(x, imgY, imgW, imgH, 2, 2, 'F');
          doc.setFont('BarlowCondensed', 'italic');
          doc.setFontSize(5.5);
          doc.setTextColor(140, 140, 140);
          doc.text('Sin imagen', x + imgW / 2 - 8, imgY + imgH / 2);
        }

        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(x, y, colWidth, colHeight, 2, 2, 'S');

        const textY = imgY + imgH + 3;
        doc.setFontSize(6);
        doc.setTextColor(60, 60, 60);

        doc.setFont('BarlowCondensed', 'bold');
        doc.text('Locución / Letra:', x + 2.5, textY);
        doc.setFont('BarlowCondensed', 'italic');

        const locLines = doc.splitTextToSize(locution, colWidth - 5);
        doc.text(locLines.slice(0, 3), x + 2.5, textY + 3);
      }
    }
  }

  doc.save(`${storyboardName.toLowerCase().replace(/\s+/g, '_')}_storyboard.pdf`);
}
