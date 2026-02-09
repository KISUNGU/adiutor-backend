const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const text = 'Test Acquisition PDF - Hello PICAGL';
    page.drawText(text, {
      x: 50,
      y: 800,
      size: 18,
      font,
      color: rgb(0, 0.25, 0.6),
    });

    const bytes = await pdfDoc.save();
    const outDir = path.join(__dirname, '..', 'test', 'data');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'test-acq.pdf');
    fs.writeFileSync(outPath, bytes);
    console.log('PDF écrit:', outPath);
  } catch (e) {
    console.error('Erreur génération PDF:', e.message);
    process.exit(1);
  }
})();
