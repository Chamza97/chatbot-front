import { Box, TextField, IconButton, Checkbox } from "@mui/material";
import {
  Upload,
  Edit,
  Visibility,
  Download,
  ContentCopy,
  Delete,
} from "@mui/icons-material";

interface ReferentialCardProps {
  name: string;
  flag: string;
  description: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpload?: () => void;
  onEdit?: () => void;
  onView?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

const ReferentialCard = ({
  name,
  flag,
  description,
  isSelected = false,
  onSelect,
  onUpload,
  onEdit,
  onView,
  onDownload,
  onCopy,
  onDelete,
}: ReferentialCardProps) => {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 400,
        bgcolor: "background.paper",
        borderRadius: 1,
        boxShadow: 2,
        p: 2,
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: 4,
        },
      }}
    >
      {/* Checkbox */}
      <Box sx={{ mb: 2 }}>
        <Checkbox checked={isSelected} onChange={onSelect} />
      </Box>

      {/* Name TextField */}
      <TextField
        label="Name"
        value={name}
        variant="standard"
        disabled
        fullWidth
        sx={{ mb: 2 }}
      />

      {/* Flag TextField */}
      <TextField
        label="Flag"
        value={flag}
        variant="standard"
        disabled
        fullWidth
        sx={{ mb: 2 }}
      />

      {/* Description TextField */}
      <TextField
        label="Description"
        value={description}
        variant="standard"
        disabled
        fullWidth
        multiline
        sx={{ mb: 3 }}
      />

      {/* Action Buttons */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          pt: 2,
        }}
      >
        <IconButton onClick={onUpload} size="small">
          <Upload />
        </IconButton>
        <IconButton onClick={onEdit} size="small">
          <Edit />
        </IconButton>
        <IconButton onClick={onView} size="small">
          <Visibility />
        </IconButton>
        <IconButton onClick={onDownload} size="small">
          <Download />
        </IconButton>
        <IconButton onClick={onCopy} size="small">
          <ContentCopy />
        </IconButton>
        <IconButton onClick={onDelete} size="small" color="error">
          <Delete />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ReferentialCard;
