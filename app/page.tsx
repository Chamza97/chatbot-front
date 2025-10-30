import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
} from "@mui/material";
import { CloudUpload } from "@mui/icons-material";
import { useState } from "react";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File, format: string) => void;
}

const ImportModal = ({ open, onClose, onImport }: ImportModalProps) => {
  const [fileFormat, setFileFormat] = useState("json");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      onImport(selectedFile, fileFormat);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileFormat("json");
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        Type de fichier
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <RadioGroup
          value={fileFormat}
          onChange={(e) => setFileFormat(e.target.value)}
          sx={{ mb: 3 }}
        >
          <FormControlLabel
            value="json"
            control={<Radio />}
            label="Format JSON"
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            value="csv"
            control={<Radio />}
            label="Format CSV"
          />
        </RadioGroup>

        <Box
          sx={{
            border: "2px dashed",
            borderColor: "grey.400",
            borderRadius: 1,
            p: 4,
            textAlign: "center",
            position: "relative",
            bgcolor: "grey.50",
          }}
        >
          <CloudUpload 
            sx={{ 
              fontSize: 48, 
              color: "text.secondary", 
              mb: 2 
            }} 
          />
          
          <Typography 
            variant="body1" 
            sx={{ mb: 2, color: "text.primary" }}
          >
            Importer de nouvelles données
          </Typography>

          <Box component="input"
            type="file"
            id="file-upload"
            accept={fileFormat === "json" ? ".json" : ".csv"}
            onChange={handleFileChange}
            sx={{ display: "none" }}
          />

          <Box component="label" htmlFor="file-upload">
            <Button
              variant="contained"
              component="span"
              sx={{
                bgcolor: "#4a148c",
                color: "white",
                px: 4,
                py: 1,
                textTransform: "uppercase",
                fontWeight: 600,
                "&:hover": { 
                  bgcolor: "#6a1b9a" 
                },
              }}
            >
              Chemin de fichier
            </Button>
          </Box>

          {selectedFile && (
            <Typography 
              variant="caption" 
              sx={{ 
                display: "block", 
                mt: 2,
                color: "text.secondary"
              }}
            >
              {selectedFile.name}
            </Typography>
          )}

          <Typography
            variant="h6"
            sx={{ 
              color: "error.main", 
              position: "absolute", 
              top: 8, 
              right: 16,
              fontWeight: "bold"
            }}
          >
            *
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: 2, 
          gap: 2,
          justifyContent: "flex-start"
        }}
      >
        <Button
          onClick={handleClose}
          variant="contained"
          sx={{
            bgcolor: "#4a148c",
            color: "white",
            px: 4,
            py: 1,
            textTransform: "uppercase",
            fontWeight: 600,
            "&:hover": { 
              bgcolor: "#6a1b9a" 
            },
          }}
        >
          Annuler
        </Button>
        
        <Button
          onClick={handleImport}
          disabled={!selectedFile}
          variant="contained"
          sx={{
            bgcolor: selectedFile ? "#e0e0e0" : "#f5f5f5",
            color: "text.primary",
            px: 4,
            py: 1,
            textTransform: "uppercase",
            fontWeight: 600,
            "&:hover": { 
              bgcolor: selectedFile ? "#d5d5d5" : "#f5f5f5" 
            },
            "&.Mui-disabled": {
              bgcolor: "#f5f5f5",
              color: "text.disabled"
            }
          }}
        >
          Importer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportModal;
