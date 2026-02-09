/**
 * services/documents.service.js
 * Service de gestion des documents (PDF, QR, OCR, IA)
 * 
 * ✅ Génération QR codes
 * ✅ Génération PDF (accusés réception)
 * ✅ Extraction texte (PDF, DOCX, DOC)
 * ✅ OCR (Tesseract)
 * ✅ Analyse IA documents
 * ✅ Aucune dépendance req/res
 */

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const QRCode = require('qrcode');
const { PDFDocument, StandardFonts } = require('pdf-lib');
let PDFParse = null;
try {
  ({ PDFParse } = require('pdf-parse'));
} catch (err) {
  console.warn(
    '⚠️ pdf-parse indisponible: extraction PDF désactivée. Cause:',
    err?.message || err
  );
  PDFParse = null;
}
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const axios = require('axios');
const { analyzeDocument } = require('../ai/documentAnalyzer');
const { indexDocument } = require('../ai/semanticSearch');

/**
 * Analyse IA complète d'un document
 * - Classification
 * - Extraction entités
 * - Génération résumé
 * - Détermination priorité
 * - Extraction mots-clés
 * - Indexation sémantique (embeddings)
 * 
 * @param {object} db - Instance SQLite
 * @param {string} table - Nom de la table (incoming_mails, archives, etc.)
 * @param {number} documentId - ID du document
 * @param {string} extractedText - Texte extrait du document
 * @param {object} metadata - Métadonnées additionnelles
 * @returns {Promise<object|null>} Résultat analyse IA ou null si échec
 */
async function analyzeDocumentAsync(db, table, documentId, extractedText, metadata = {}) {
  if (!extractedText || extractedText.trim().length < 50) {
    console.log(`Document ${documentId}: texte trop court, pas d'analyse IA`);
    return null;
  }

  try {
    console.log(`🤖 Analyse IA du document ${documentId} (${table})...`);
    
    // 1. Analyse complète du document
    const analysis = await analyzeDocument(extractedText, metadata);
    
    // 2. Génération de l'embedding pour recherche sémantique
    await indexDocument(db, table, documentId, extractedText);

    // 3. Sauvegarde des résultats dans la table
    const updateSql = `
      UPDATE ${table} SET
        classification = ?,
        extracted_entities = ?,
        ai_summary = ?,
        ai_priority = ?,
        ai_keywords = ?,
        analyzed_at = datetime('now')
      WHERE id = ?
    `;

    const params = [
      analysis.classification?.type || null,
      JSON.stringify(analysis.entities || {}),
      analysis.summary || null,
      analysis.priority?.level || null,
      analysis.keywords?.join(', ') || null,
      documentId
    ];

    await new Promise((resolve, reject) => {
      db.run(updateSql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`✅ Document ${documentId} analysé: ${analysis.classification?.type} (priorité: ${analysis.priority?.level})`);
    
    return analysis;

  } catch (error) {
    console.error(`❌ Erreur analyse IA document ${documentId}:`, error.message);
    // Non-bloquant : on continue même si l'IA échoue
    return null;
  }
}

/**
 * Génère un QR code PNG pour un courrier
 * Le QR code contient un lien vers l'application frontend
 * 
 * @param {string} reference - Référence du courrier
 * @param {number} mailId - ID du courrier
 * @returns {Promise<string|null>} Chemin relatif du QR code ou null si échec
 */
async function generateMailQRCode(reference, mailId) {
  try {
    const qrData = `${process.env.APP_URL || 'http://localhost:5174'}/courrier-entrant/indexation?highlightId=${mailId}`;
    
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const qrDir = path.join(__dirname, '..', 'uploads', 'qr-codes');
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const safeRef = String(reference || mailId).replace(/[\\/\s]/g, '-');
    const qrFileName = `qr-${safeRef}-${Date.now()}.png`;
    const qrFilePath = path.join(qrDir, qrFileName);

    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(qrFilePath, base64Data, 'base64');

    return `/uploads/qr-codes/${qrFileName}`;
  } catch (error) {
    console.error('❌ Erreur génération QR code:', error.message);
    return null;
  }
}

/**
 * Génère un PDF d'accusé de réception pour un courrier
 * Contient : référence, objet, expéditeur, date réception, statut QR
 * 
 * @param {object} mail - Objet courrier {ref_code, subject, sender, date_reception, qr_code_path, ...}
 * @returns {Promise<string|null>} Chemin relatif du PDF ou null si échec
 */
async function generateARPDF(mail) {
  try {
    if (!mail) return null;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4

    const marginX = 40;
    let y = 800;
    const lineHeight = 18;

    // Titre
    page.drawText('Accusé de réception', { x: marginX, y, size: 20, font });
    y -= lineHeight * 2;

    // Informations du courrier
    const rows = [
      ['Référence', mail.ref_code || mail.reference || String(mail.id || '')],
      ['Objet', mail.subject || ''],
      ['Expéditeur', mail.sender || ''],
      ['Date de réception', mail.date_reception || ''],
      ['QR Code', mail.qr_code_path ? 'Généré' : 'Non généré'],
    ];

    rows.forEach(([label, value]) => {
      page.drawText(`${label}: ${value}`, { x: marginX, y, size: 12, font });
      y -= lineHeight;
    });

    // Sauvegarder le PDF
    const pdfBytes = await pdfDoc.save();
    const outDir = path.join(__dirname, '..', 'uploads', 'ar-pdf');
    
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const safeRef = String(mail.ref_code || mail.reference || mail.id || 'mail').replace(/[\\/\s]/g, '-');
    const fileName = `ar-${safeRef}-${Date.now()}.pdf`;
    const filePath = path.join(outDir, fileName);
    
    await fsPromises.writeFile(filePath, pdfBytes);

    return `/uploads/ar-pdf/${fileName}`;
  } catch (error) {
    console.error('❌ Erreur génération AR PDF:', error.message);
    return null;
  }
}

/**
 * Extrait le texte d'un fichier PDF
 * Utilise pdf-parse v2
 * 
 * @param {string} filePath - Chemin absolu du fichier PDF
 * @returns {Promise<string>} Texte extrait (vide si échec)
 */
async function extractTextFromPDF(filePath) {
  try {
    if (!PDFParse) {
      console.warn('⚠️ Extraction PDF ignorée (pdf-parse indisponible):', filePath);
      return '';
    }
    const dataBuffer = await fsPromises.readFile(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    return pdfData.text.trim();
  } catch (error) {
    console.error('❌ Erreur extraction texte PDF:', filePath, error.message);
    return '';
  }
}

/**
 * Extrait le texte d'un fichier DOCX
 * Utilise mammoth
 * 
 * @param {string} filePath - Chemin absolu du fichier DOCX
 * @returns {Promise<string>} Texte extrait (vide si échec)
 */
async function extractTextFromDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim();
  } catch (error) {
    console.error('❌ Erreur extraction texte DOCX:', filePath, error.message);
    return '';
  }
}

/**
 * Extrait le texte d'un fichier (détection automatique du type)
 * Supporte : PDF, DOCX, DOC
 * 
 * @param {string} filePath - Chemin absolu du fichier
 * @returns {Promise<string>} Texte extrait (vide si type non supporté ou échec)
 */
async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    return await extractTextFromPDF(filePath);
  } else if (ext === '.docx' || ext === '.doc') {
    return await extractTextFromDocx(filePath);
  }
  
  console.warn(`⚠️ Type de fichier non supporté pour extraction: ${ext}`);
  return '';
}

/**
 * Convertit un fichier DOCX en PDF
 * (Nécessite libreoffice-convert - désactivé par défaut)
 * 
 * @param {string} inputPath - Chemin DOCX source
 * @param {string} outputPath - Chemin PDF destination
 * @returns {Promise<string|null>} Chemin PDF ou null si échec
 */
async function convertDocxToPDF(inputPath, outputPath) {
  try {
    // ⚠️ Nécessite libreoffice-convert installé
    // const libre = require('libreoffice-convert');
    // const convertAsync = require('util').promisify(libre.convert);
    
    // const docxBuf = await fsPromises.readFile(inputPath);
    // const pdfBuf = await convertAsync(docxBuf, '.pdf', undefined);
    // await fsPromises.writeFile(outputPath, pdfBuf);
    // return outputPath;
    
    console.warn('⚠️ Conversion DOCX→PDF désactivée (libreoffice-convert non disponible)');
    return null;
  } catch (error) {
    console.error('❌ Erreur conversion DOCX vers PDF:', error.message);
    return null;
  }
}

/**
 * Appelle une API IA externe pour générer un résumé
 * (API Flask, n8n, ou autre service IA)
 * 
 * @param {string} text - Texte à résumer
 * @param {string} subject - Sujet/titre optionnel
 * @returns {Promise<string>} Résumé généré (vide si échec)
 */
async function callAISummary(text, subject) {
  try {
    const aiUrl = process.env.AI_SUMMARY_URL || 'http://localhost:5000/summarize';

    const payload = {
      task: 'summary',
      text,
      subject: subject || null,
    };

    const response = await axios.post(aiUrl, payload, {
      timeout: 60000, // 60 secondes
    });

    return response.data.summary || response.data.answer || '';
  } catch (error) {
    console.error('❌ Erreur appel AI Summary:', error.message);
    return '';
  }
}

/**
 * Extrait le texte d'un PDF via OCR (Tesseract)
 * Convertit chaque page en image puis applique OCR
 * Langues : français + anglais + détection orientation
 * 
 * @param {string} pdfPath - Chemin absolu du PDF
 * @returns {Promise<string>} Texte extrait via OCR (vide si échec)
 */
async function extractTextWithOCR(pdfPath) {
  try {
    console.log('🧠 OCR en cours sur:', pdfPath);

    const convert = fromPath(pdfPath, {
      density: 200,
      saveFilename: 'page',
      savePath: path.join(__dirname, '..', 'uploads', 'temp-ocr'),
      format: 'png',
      width: 2000,
      height: 2000,
    });

    let fullText = '';
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const result = await convert(page, { responseType: 'image' }).catch(() => null);
      
      if (!result || !result.path) {
        hasNext = false;
        break;
      }

      const imagePath = result.path;
      console.log(`🧠 OCR page ${page} (${imagePath})...`);

      const { data: { text } } = await Tesseract.recognize(imagePath, 'fra+eng+osd', {
        tessedit_pageseg_mode: 1,
        logger: m => console.log(`OCR ${page}: ${Math.round(m.progress * 100)}%`)
      });

      if (text && text.trim().length > 0) {
        fullText += `\n--- PAGE ${page} ---\n${text}`;
      }

      // Nettoyer l'image temporaire
      await fsPromises.unlink(imagePath).catch(() => {});
      page++;
    }

    if (fullText.trim().length === 0) {
      console.warn("⚠️ Aucun texte OCR détecté.");
    }

    return fullText.trim();

  } catch (err) {
    console.error("❌ Erreur OCR:", err.message);
    return "";
  }
}

/**
 * Récupère le contenu texte de tous les PDF dans un répertoire
 * Utile pour indexation massive
 * 
 * @param {string} uploadsDir - Répertoire contenant les PDFs
 * @returns {Promise<array>} Liste d'objets {fileName, content}
 */
async function getAllPDFContent(uploadsDir) {
  try {
    const files = await fsPromises.readdir(uploadsDir);
    const pdfFiles = files.filter(f => path.extname(f).toLowerCase() === '.pdf');
    
    const results = [];
    
    for (const fileName of pdfFiles) {
      const filePath = path.join(uploadsDir, fileName);
      const content = await extractTextFromPDF(filePath);
      
      results.push({
        fileName,
        filePath,
        content,
        contentLength: content.length
      });
    }
    
    return results;
  } catch (error) {
    console.error('❌ Erreur getAllPDFContent:', error.message);
    return [];
  }
}

module.exports = {
  // Analyse IA
  analyzeDocumentAsync,
  
  // Génération
  generateMailQRCode,
  generateARPDF,
  
  // Extraction texte
  extractTextFromPDF,
  extractTextFromDocx,
  extractTextFromFile,
  getAllPDFContent,
  
  // Conversion
  convertDocxToPDF,
  
  // IA externe
  callAISummary,
  
  // OCR
  extractTextWithOCR
};
