/**
 * Module IA Principal pour analyse intelligente des courriers
 * Utilise OpenAI GPT-4 pour classification, extraction, résumé
 */

const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

/**
 * Analyse complète d'un courrier
 * @param {string} text - Contenu du courrier
 * @param {Object} metadata - Métadonnées (expéditeur, date, etc.)
 * @returns {Promise<Object>} Analyse complète
 */
async function analyzeDocument(text, metadata = {}) {
  if (!text || text.trim().length < 10) {
    return {
      error: 'Texte trop court pour analyse',
      classification: null,
      entities: {},
      summary: null,
      priority: 'normale'
    };
  }

  try {
    const prompt = `Tu es un assistant IA spécialisé dans l'analyse de courriers administratifs.
Analyse le courrier suivant et fournis une réponse au format JSON strict :

COURRIER:
"""
${text.substring(0, 4000)}
"""

MÉTADONNÉES:
Expéditeur: ${metadata.sender || 'Inconnu'}
Date: ${metadata.date || 'Non spécifiée'}

TÂCHES:
1. CLASSIFICATION: Détermine le type de courrier parmi: demande, réponse, convocation, rapport, note_service, procès_verbal, contrat, courrier_simple, autre
2. ENTITÉS: Extrais les entités importantes (dates, montants, noms de personnes, organisations, lieux)
3. RÉSUMÉ: Crée un résumé en 2-3 phrases maximum
4. PRIORITÉ: Évalue la priorité (urgente, haute, normale, basse) selon les mots-clés et le contexte
5. MOTS-CLÉS: Extrais 5-8 mots-clés pertinents
6. SENTIMENT: Analyse le ton (formel, urgent, neutre, amical)

RÉPONDS UNIQUEMENT avec un objet JSON valide au format suivant (sans markdown):
{
  "classification": "type_courrier",
  "entities": {
    "dates": ["2025-01-15"],
    "amounts": ["1000 USD", "500 EUR"],
    "persons": ["Jean Dupont", "Marie Martin"],
    "organizations": ["Ministère X", "ONG Y"],
    "locations": ["Kinshasa", "Goma"]
  },
  "summary": "Résumé concis du courrier...",
  "priority": "normale|haute|urgente|basse",
  "keywords": ["mot1", "mot2", "mot3"],
  "sentiment": "formel|urgent|neutre|amical",
  "confidence": 0.85
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse de documents administratifs. Réponds toujours en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const content = response.choices[0].message.content.trim();
    
    // Nettoyer le JSON si entouré de markdown
    let jsonContent = content;
    if (content.startsWith('```')) {
      jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const analysis = JSON.parse(jsonContent);
    
    // Validation et valeurs par défaut
    const validatedAnalysis = {
      classification: {
        type: analysis.classification || 'autre',
        confidence: analysis.confidence || 0.5
      },
      entities: {
        dates: analysis.entities?.dates || [],
        amounts: analysis.entities?.amounts || [],
        persons: analysis.entities?.persons || [],
        organizations: analysis.entities?.organizations || [],
        locations: analysis.entities?.locations || []
      },
      summary: analysis.summary || text.substring(0, 200) + '...',
      priority: {
        level: analysis.priority || 'normale',
        reasons: analysis.priority === 'haute' || analysis.priority === 'urgente' 
          ? ['détecté par IA'] 
          : []
      },
      keywords: analysis.keywords || [],
      sentiment: analysis.sentiment || 'neutre',
      analyzedAt: new Date().toISOString(),
      model: 'gpt-4o-mini'
    };
    
    return validatedAnalysis;

  } catch (error) {
    console.error('Erreur analyse IA:', error.message);
    
    // Fallback avec analyse basique
    const classif = detectClassificationFallback(text);
    const priority = detectPriorityFallback(text);
    
    return {
      classification: {
        type: classif,
        confidence: 0.3
      },
      entities: extractEntitiesFallback(text),
      summary: text.substring(0, 200) + '...',
      priority: {
        level: priority,
        reasons: ['analyse de fallback']
      },
      keywords: extractKeywordsFallback(text),
      sentiment: 'neutre',
      error: error.message,
      analyzedAt: new Date().toISOString()
    };
  }
}

/**
 * Génère un résumé concis d'un texte
 */
async function generateSummary(text, maxLength = 150) {
  if (!text || text.length < 50) {
    return text;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Tu es un expert en synthèse de documents. Résume en français, de manière concise et professionnelle.' 
        },
        { 
          role: 'user', 
          content: `Résume ce courrier en maximum ${maxLength} caractères:\n\n${text.substring(0, 3000)}` 
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Erreur génération résumé:', error.message);
    return text.substring(0, maxLength) + '...';
  }
}

/**
 * Classification simple par mots-clés (fallback)
 */
function detectClassificationFallback(text) {
  const lower = text.toLowerCase();
  
  if (lower.includes('demande') || lower.includes('sollicite') || lower.includes('requête')) {
    return 'demande';
  }
  if (lower.includes('réponse') || lower.includes('suite à') || lower.includes('en réponse')) {
    return 'réponse';
  }
  if (lower.includes('convocation') || lower.includes('réunion') || lower.includes('invitation')) {
    return 'convocation';
  }
  if (lower.includes('rapport') || lower.includes('compte rendu')) {
    return 'rapport';
  }
  if (lower.includes('procès-verbal') || lower.includes('pv')) {
    return 'procès_verbal';
  }
  if (lower.includes('contrat') || lower.includes('accord')) {
    return 'contrat';
  }
  
  return 'courrier_simple';
}

/**
 * Extraction basique d'entités (fallback)
 */
function extractEntitiesFallback(text) {
  const entities = {
    dates: [],
    amounts: [],
    persons: [],
    organizations: [],
    locations: []
  };

  // Dates (format DD/MM/YYYY ou YYYY-MM-DD)
  const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g;
  const dates = text.match(dateRegex);
  if (dates) entities.dates = [...new Set(dates)].slice(0, 5);

  // Montants (USD, EUR, FC, $)
  const amountRegex = /\b(\d+[\s,.]?\d*)\s?(USD|EUR|FC|\$|dollars?|euros?|francs?)\b/gi;
  const amounts = text.match(amountRegex);
  if (amounts) entities.amounts = [...new Set(amounts)].slice(0, 5);

  return entities;
}

/**
 * Détection priorité par mots-clés (fallback)
 */
function detectPriorityFallback(text) {
  const lower = text.toLowerCase();
  
  const urgentKeywords = ['urgent', 'immédiat', 'prioritaire', 'd\'urgence', 'sans délai'];
  const highKeywords = ['important', 'crucial', 'essentiel', 'dans les meilleurs délais'];
  
  if (urgentKeywords.some(kw => lower.includes(kw))) {
    return 'urgente';
  }
  if (highKeywords.some(kw => lower.includes(kw))) {
    return 'haute';
  }
  
  return 'normale';
}

/**
 * Extraction mots-clés simples (fallback)
 */
function extractKeywordsFallback(text) {
  // Mots vides français
  const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'à', 'au', 'en', 'pour', 'sur', 'dans', 'par', 'avec', 'sans']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüÿæœç]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.has(w));
  
  // Compter occurrences
  const freq = {};
  words.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });
  
  // Top 8 mots
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

/**
 * Suggestion de routing intelligent
 */
async function suggestRouting(text, analysis) {
  const classification = analysis?.classification || 'courrier_simple';
  const keywords = analysis?.keywords || [];
  
  // Règles de routing basiques
  const routes = {
    'demande': ['Service Administratif', 'Direction Générale'],
    'rapport': ['Direction', 'Service Suivi-Évaluation'],
    'contrat': ['Service Juridique', 'Direction Administrative'],
    'procès_verbal': ['Secrétariat', 'Direction'],
    'convocation': ['Tous les services'],
    'courrier_simple': ['Service Courrier']
  };

  const suggested = routes[classification] || ['Service Courrier'];
  
  // Affiner selon mots-clés
  if (keywords.some(kw => ['budget', 'finance', 'comptable'].includes(kw))) {
    suggested.unshift('Service Financier');
  }
  if (keywords.some(kw => ['rh', 'personnel', 'recrutement', 'contrat'].includes(kw))) {
    suggested.unshift('Service RH');
  }
  if (keywords.some(kw => ['projet', 'terrain', 'mission'].includes(kw))) {
    suggested.unshift('Coordination Projets');
  }

  return [...new Set(suggested)].slice(0, 3);
}

module.exports = {
  analyzeDocument,
  generateSummary,
  suggestRouting,
  detectClassificationFallback,
  detectPriorityFallback
};
