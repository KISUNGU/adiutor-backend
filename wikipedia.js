for (const toolCall of assistantMessage.tool_calls) {
  const functionName = toolCall.function.name;
  const functionArgs = JSON.parse(toolCall.function.arguments);
  const tool_call_id = toolCall.id;

  let functionOutput;

  try {
    if (functionName === "wikipedia_search") {
      const wikiResult = await availableTools["wikipedia_search"]({ query: functionArgs.query });

      const wikiFailed = typeof wikiResult === 'string' &&
        (wikiResult.toLowerCase().includes("aucune") || wikiResult.toLowerCase().includes("erreur"));

      if (wikiFailed) {
        const googleResult = await availableTools["google_search"]({ query: functionArgs.query });
        functionOutput = {
          type: "google_search",
          source: "fallback_from_wikipedia",
          ...googleResult
        };
      } else {
        functionOutput = {
          type: "wikipedia",
          summary: wikiResult,
          query: functionArgs.query
        };
      }
    } else if (availableTools[functionName]) {
      functionOutput = await availableTools[functionName](functionArgs);
    } else {
      functionOutput = { error: `Fonction ${functionName} non trouvée.` };
    }
  } catch (err) {
    functionOutput = { error: `Erreur dans la fonction ${functionName}`, details: err.message };
  }

  // ✅ TOUJOURS envoyer une réponse pour chaque tool_call_id
  messages.push({
    role: 'tool',
    tool_call_id,
    name: functionName, // ⚠️ obligatoire
    content: JSON.stringify(functionOutput)
  });

  await saveMessage(currentSessionId, 'tool', JSON.stringify(functionOutput), currentUserId, functionName, tool_call_id);
}
