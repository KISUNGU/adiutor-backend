import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config(); // Charge les variables d'environnement

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Votre clé API Google
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID; // Votre ID de moteur de recherche personnalisé

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.warn("ATTENTION : Les variables d'environnement GOOGLE_API_KEY ou GOOGLE_CSE_ID ne sont pas définies. La fonction de recherche web ne fonctionnera pas.");
}

/**
 * Effectue une recherche web en utilisant Google Custom Search API.
 * @param {string} query - La requête de recherche.
 * @returns {Promise<string>} - Une chaîne JSON représentant les résultats de la recherche.
 */
export async function searchWeb(query) {
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
        return JSON.stringify({ error: "API de recherche non configurée. Veuillez définir GOOGLE_API_KEY et GOOGLE_CSE_ID dans votre fichier .env." });
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(url);
        const items = response.data.items;

        if (!items || items.length === 0) {
            return JSON.stringify({ message: "Aucun résultat trouvé pour la requête : " + query });
        }

        // Formate les résultats pour les rendre concis et utiles pour l'IA
        const formattedResults = items.slice(0, 3).map(item => ({ // Prend les 3 premiers résultats
            title: item.title,
            link: item.link,
            snippet: item.snippet
        }));

        return JSON.stringify({ results: formattedResults });

    } catch (error) {
        console.error("Erreur lors de la recherche web:", error.response ? error.response.data : error.message);
        return JSON.stringify({ error: "Impossible d'effectuer la recherche web.", details: error.message });
    }
}