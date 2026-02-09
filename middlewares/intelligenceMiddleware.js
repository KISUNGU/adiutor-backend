const { extractTextFromPDF } = require('../utils/pdf'); // déjà présent
const { analyzeText } = require('../modules/intelligence/nlp');

async function enrichIncomingMail(req, res, next) {
  try {
    const filePath = req.file?.path;
    if (!filePath) return next();

    const text = await extractTextFromPDF(filePath);
    const { keywords, classification } = analyzeText(text);

    req.body.extracted_text = text;
    req.body.keywords = keywords.join(', ');
    req.body.classification = classification;

    next();
  } catch (err) {
    console.error('Erreur enrichissement IA:', err.message);
    next();
  }
}

module.exports = { enrichIncomingMail };
