export const downloadJsonFile = (
  jsonContent: string | Record<string, unknown> | unknown[],
  fileName: string = "data.json"
): void => {
  // Convertir l'objet en string si nécessaire
  const jsonString: string =
    typeof jsonContent === "string"
      ? jsonContent
      : JSON.stringify(jsonContent, null, 2);

  // Créer un Blob avec le contenu JSON
  const blob = new Blob([jsonString], { type: "application/json" });

  // Créer une URL temporaire pour le Blob
  const url = URL.createObjectURL(blob);

  // Créer un élément <a> temporaire pour déclencher le téléchargement
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  // Ajouter au DOM, cliquer, puis nettoyer
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libérer l'URL du Blob
  URL.revokeObjectURL(url);
};
