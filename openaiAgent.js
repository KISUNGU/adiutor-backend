const dotenv = require('dotenv');
dotenv.config();

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Fonction pour appeler le modèle de chat OpenAI.
 * @param {Array} messages - Un tableau d'objets messages au format OpenAI ({ role: 'user', content: '...' })
 * @param {Array} tools - (Optionnel) Un tableau de définitions d'outils (fonctions) que l'IA peut appeler.
 * @returns {Promise<Object>} La réponse complète de l'API OpenAI.
 */
async function getAgentResponse(messages, tools = []) {
  try {
    // Ajoute la date du jour dans le prompt système
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const systemPrompt = {
      role: 'system',
      content: `Nous sommes le ${today}. Réponds toujours en tenant compte de cette date.`
    };

    // Place le prompt système en premier
    const userMessages = messages.filter(msg => msg.role !== 'system');
    const filteredMessages = [systemPrompt, ...userMessages].filter(msg => msg.role !== 'tool');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: filteredMessages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    });
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API OpenAI:', error);
    if (error.response) {
      console.error('Statut HTTP:', error.response.status);
      console.error('Données d\'erreur:', error.response.data);
    }
    throw new Error('Impossible de contacter l\'agent AI.');
  }
}

module.exports = { getAgentResponse };