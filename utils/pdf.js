const fs = require('fs/promises');
let PDFParse = null;
try {
  PDFParse = require('pdf-parse');
} catch (err) {
  console.warn(
    '⚠️ pdf-parse indisponible: extraction PDF désactivée. Cause:',
    err?.message || err
  );
  PDFParse = null;
}

async function extractTextFromPDF(filePath) {
  try {
    if (!PDFParse) {
      console.warn('⚠️ Extraction PDF ignorée (pdf-parse indisponible):', filePath);
      return '';
    }
    const dataBuffer = await fs.readFile(filePath);
    const pdf = await PDFParse(dataBuffer);
    return pdf.text.trim();
  } catch (error) {
    console.error('Erreur extraction texte PDF:', error.message);
    return '';
  }
}

module.exports = { extractTextFromPDF };
