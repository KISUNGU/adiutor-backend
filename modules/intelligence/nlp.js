function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4); // filtre les mots courts

  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return sorted;
}

function classifyText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('paiement') || lower.includes('facture')) return 'Financier';
  if (lower.includes('réunion') || lower.includes('rapport')) return 'Administratif';
  if (lower.includes('marché') || lower.includes('appel d\'offres')) return 'Passation des Marchés';
  if (lower.includes('mission') || lower.includes('déplacement')) return 'Logistique';
  return 'Autre';
}

function analyzeText(text) {
  const keywords = extractKeywords(text);
  const classification = classifyText(text);
  return { keywords, classification };
}

module.exports = { analyzeText };
