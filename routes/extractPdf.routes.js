const express = require('express');

module.exports = function extractPdfRoutes({
  authenticateToken,
  upload,
  openai,
  path,
  fsPromises,
  PDFParse,
  extractTextWithOCR,
  calculateFileHash,
  baseDir,
}) {
  const router = express.Router();

  router.post('/extract-pdf', authenticateToken, upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier PDF fourni.' });
    }
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Seuls les fichiers PDF sont acceptés.' });
    }

    const filePath = path.join(baseDir, `/uploads/${file.filename}`);
    const originalFilePath = `/uploads/${file.filename}`;
    let extracted_data = {
      reference: '',
      subject: '',
      sender: '',
      recipient: '',
      mail_date: '',
      received_date: '',
    };

    try {
      const buffer = await fsPromises.readFile(filePath);

      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      let rawText = (pdfData.text || '').trim();

      if (!rawText) {
        console.log('⚙️ Aucun texte natif trouvé, lancement OCR...');
        rawText = await extractTextWithOCR(filePath);
        if (!rawText) {
          console.warn("⚠️ Aucun texte extrait, retour vide au frontend.");
          rawText = '';
        }
      }

      if (!rawText || rawText.trim().length < 50) {
        await fsPromises.readFile(filePath).catch(() => {});
        const hostUrl = `${req.protocol}://${req.get('host')}`;
        return res.json({
          extracted_data,
          text: rawText,
          originalFilePath,
          originalFileAbsoluteUrl: `${hostUrl}${originalFilePath}`,
          originalFilename: file.originalname,
          warning: 'Texte PDF trop court pour une analyse IA détaillée.',
        });
      }

      const prompt = `
Tu es un assistant expert en analyse de documents administratifs et juridiques en français et en anglais. 

1. D'abord, identifie automatiquement le type de document parmi : 
   - lettre/courrier
   - rapport
   - termes de référence (TdR)
   - contrat
   - procès-verbal (PV)
   - article
   - autre (spécifier)

2. Selon le type identifié, extrais les éléments structurés suivants :

**Pour une lettre/courrier :**
- "Référence" (souvent commence par "N°", "Réf", "Ref")
- "Objet" ou "Concerne"
- "Expéditeur" (nom ou service, souvent après la signature)
- "Destinataire" (souvent précédé de "À", "Monsieur", "Madame")
- "Date d’émission" (souvent après "Fait à... le ...")
- "Date de réception" (si mentionnée)
- "Résumé" concis du contenu

**Pour un rapport :**
- Titre du rapport
- Période concernée
- Auteur(s) / organisme(s) émetteur(s)
- Destinataire(s)
- Date d’émission
- Résumé synthétique

**Pour un terme de référence (TdR) :**
- Objet / But du TdR
- Commanditaire
- Période et durée
- Livrables attendus
- Critères de performance
- Date d’émission

**Pour un contrat :**
- Titre du contrat
- Parties contractantes (avec rôle : Prestataire, Client, etc.)
- Objet du contrat
- Durée / Dates importantes
- Clauses principales (résumé)
- Date de signature

**Pour un procès-verbal (PV) :**
- Type de réunion ou événement
- Date et lieu
- Participants principaux
- Résumé des décisions prises
- Date de rédaction

**Pour un article :**
- Titre
- Auteur(s)
- Source / publication
- Date de publication
- Résumé
  "document_type": "rapport",
  "title": "",
  "period": "",
  "author": "",
  "recipient": "",
  "issue_date": "",
  "summary": "",
  "classeur": ""
}

4. Pour le champ "classeur", suggère LE NOM EXACT d'un classeur approprié parmi cette liste stricte (choisis le plus pertinent) :
   - "PTBA" pour Plan de Travail de Budget Annuel
   - "Banque Mondiale" pour correspondances Banque Mondiale
   - "FAO", "UNOPS" pour partenaires internationaux
   - "MINAGRI, MINDR, MIN P & EL" pour Ministère Agriculture/Développement Rural/Pêche
   - "Rapport audit externe" pour audits externes
   - "Rapport d'activité" pour rapports d'activités
   - "Contrats pretataires" pour contrats de prestataires
   - "Fournisseurs" pour factures et documents fournisseurs
   - "Facture fournisseurs 1", "Facture fournisseurs 2", "Facture fournisseurs 3" pour factures
   - "Facture staff 1", "Facture staff 2" pour factures du personnel
   - "Correspondance externe" ou "Correspondance Interne" selon le cas
   - "Courrier reçu/Courriel/TDR/Invitation" pour courriers et TDR
   - "Ordre de mission/Notes de service" pour ordres de mission
   - "Rapport de mission collective" pour rapports de mission
   - "RIKOLTO", "SAGEC-KAT", "VSF-B", "IIATA", "SAPHIR" pour partenaires de mise en œuvre
   - "Document de base" pour manuels, arrêtés ministériels
   - "Consultants", "Evaluateurs", "Auditeur Externe" selon le type
   - "Projet et Programme" pour documents de projets
   - Ou tout autre classeur de la liste si plus approprié
   
   IMPORTANT: Retourne UNIQUEMENT le nom exact tel qu'il apparaît dans la liste ci-dessus.

5. Si certains champs ne sont pas présents dans le texte, indique une chaîne vide "".

Voici le texte du document à analyser :
"""${rawText.slice(0, 8000)}"""
`;

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es un assistant d’extraction de métadonnées de documents administratifs.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      try {
        extracted_data = JSON.parse(aiResponse.choices[0].message.content);
      } catch (parseError) {
        console.warn('⚠️ Impossible de parser la réponse IA, réponse brute :', aiResponse.choices[0].message.content);
      }

      const fileHash = await calculateFileHash(filePath).catch((err) => {
        console.warn('⚠️ Impossible de calculer le hash du fichier:', err.message);
        return null;
      });

      const hostUrl = `${req.protocol}://${req.get('host')}`;
      res.json({
        extracted_data,
        text: rawText,
        originalFilePath,
        originalFileAbsoluteUrl: `${hostUrl}${originalFilePath}`,
        originalFilename: file.originalname,
        fileHash,
      });
    } catch (error) {
      console.error('❌ Erreur extraction PDF :', error.message);
      res.status(500).json({ error: 'Erreur lors de l’analyse du courrier.', cause: error.message });
    }
  });

  return router;
};
