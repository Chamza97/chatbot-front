import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useSnackbar } from "notistack";

const MyPage = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [openImportModal, setOpenImportModal] = useState(false);

  // Mutation pour l'import
  const importMutation = useMutation({
    mutationFn: async ({ file, format }: { file: File; format: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("format", format);

      const response = await axios.post("/api/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    },
    onSuccess: (data) => {
      enqueueSnackbar("Import réussi!", { variant: "success" });
      // Invalider les queries pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["dynamic-models"] });
      setOpenImportModal(false);
    },
    onError: (error: any) => {
      enqueueSnackbar(
        `Erreur lors de l'import: ${error.message}`,
        { variant: "error" }
      );
    },
  });

  const handleImport = (file: File, format: string) => {
    importMutation.mutate({ file, format });
  };

  return (
    <Box sx={{ p: 4 }}>
      <Button
        variant="contained"
        onClick={() => setOpenImportModal(true)}
      >
        Importer des données
      </Button>

      <ImportModal
        open={openImportModal}
        onClose={() => setOpenImportModal(false)}
        onImport={handleImport}
      />

      {/* Afficher un loader pendant l'import */}
      {importMutation.isPending && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress size={24} />
          <Typography sx={{ ml: 2 }}>Import en cours...</Typography>
        </Box>
      )}
    </Box>
  );
};
