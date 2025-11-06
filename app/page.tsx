import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Box,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

interface CopyReferentialDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: FormData) => void;
}

interface FormData {
  name: string;
  code: string;
  description: string;
  copyContent: boolean;
}

interface FieldError {
  message?: string;
}

interface FormErrors {
  name?: FieldError;
  code?: FieldError;
  description?: FieldError;
}

interface FormTouched {
  name: boolean;
  code: boolean;
  description: boolean;
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const formSchema = z.object({
  name: z.string().min(3, 'Minimum 3 caractères'),
  code: z.string().min(5, 'Minimum 5 caractères'),
  description: z.string().min(10, 'Minimum 10 caractères'),
  copyContent: z.boolean(),
});

// ============================================================================
// API - REMPLACE CETTE FONCTION PAR TON APPEL API RÉEL
// ============================================================================

const checkNameExists = async (name: string): Promise<boolean> => {
  // TODO: Remplace par ton endpoint réel
  // Exemple:
  // const response = await fetch(`/api/check-name?name=${encodeURIComponent(name)}`);
  // const data = await response.json();
  // return data.exists;

  // Mock pour la démo (supprime-le)
  return new Promise((resolve) => {
    setTimeout(() => {
      const exists = ['test', 'admin', 'user'].includes(name.toLowerCase());
      resolve(exists);
    }, 500);
  });
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export const CopyReferentialDialog: React.FC<CopyReferentialDialogProps> = ({
  open,
  onClose,
  onConfirm,
}) => {
  // État
  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    description: '',
    copyContent: true,
  });

  const [touched, setTouched] = useState<FormTouched>({
    name: false,
    code: false,
    description: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [nameExists, setNameExists] = useState<boolean>(false);

  // React Query - Vérification du nom
  const nameCheckMutation = useMutation({
    mutationFn: checkNameExists,
    onSuccess: (exists: boolean) => {
      setNameExists(exists);
      if (exists) {
        setErrors((prev) => ({
          ...prev,
          name: { message: 'Ce nom existe déjà dans la base' },
        }));
      }
    },
  });

  // Validation temps réel
  useEffect(() => {
    const result = formSchema.safeParse(formData);

    if (!result.success) {
      const newErrors: FormErrors = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormErrors;
        newErrors[field] = { message: issue.message };
      });
      setErrors(newErrors);
    } else {
      if (nameExists) {
        setErrors({ name: { message: 'Ce nom existe déjà dans la base' } });
      } else {
        setErrors({});
      }
    }
  }, [formData, nameExists]);

  // Vérifier le nom avec React Query
  useEffect(() => {
    if (formData.name.length >= 3 && touched.name && !errors.name) {
      nameCheckMutation.mutate(formData.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.name, touched.name]);

  // Handlers
  const handleChange =
    (field: keyof FormData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
      if (field === 'name' && nameExists) {
        setNameExists(false);
      }
    };

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData((prev) => ({ ...prev, copyContent: event.target.value === 'oui' }));
  };

  const handleBlur = (field: keyof FormTouched) => (): void => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const isFieldValid = (field: keyof FormErrors): boolean => {
    if (field === 'name') {
      return (
        touched[field] &&
        !errors[field] &&
        formData[field].length >= 3 &&
        !nameExists &&
        !nameCheckMutation.isPending
      );
    }
    return touched[field] && !errors[field] && formData[field].length > 0;
  };

  const isFormValid = (): boolean => {
    const result = formSchema.safeParse(formData);
    return result.success && !nameExists && !nameCheckMutation.isPending;
  };

  const handleSubmit = (): void => {
    if (isFormValid()) {
      onConfirm(formData);
      handleReset();
    }
  };

  const handleReset = (): void => {
    setFormData({ name: '', code: '', description: '', copyContent: true });
    setTouched({ name: false, code: false, description: false });
    setErrors({});
    setNameExists(false);
  };

  const handleClose = (): void => {
    handleReset();
    onClose();
  };

  const getStarColor = (field: keyof FormErrors): string => {
    return isFieldValid(field) ? 'success.main' : 'error.main';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          py: 2,
        }}
      >
        <Typography variant="h6" component="div" fontWeight={600}>
          Confirmation de Copie du référentiel sys_users
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Name */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Name
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: getStarColor('name'),
                  fontSize: '1.2rem',
                  transition: 'color 0.3s ease',
                }}
              >
                *
              </Typography>
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Saisissez le nom"
              value={formData.name}
              onChange={handleChange('name')}
              onBlur={handleBlur('name')}
              error={touched.name && (!!errors.name || nameExists)}
              helperText={
                touched.name && errors.name ? errors.name.message : 'Minimum 3 caractères'
              }
              disabled={nameCheckMutation.isPending}
            />
          </Box>

          {/* Code */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Code (libellé court)
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: getStarColor('code'),
                  fontSize: '1.2rem',
                  transition: 'color 0.3s ease',
                }}
              >
                *
              </Typography>
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Saisissez le code"
              value={formData.code}
              onChange={handleChange('code')}
              onBlur={handleBlur('code')}
              error={touched.code && !!errors.code}
              helperText={
                touched.code && errors.code ? errors.code.message : 'Minimum 5 caractères'
              }
            />
          </Box>

          {/* Description */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Description
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: getStarColor('description'),
                  fontSize: '1.2rem',
                  transition: 'color 0.3s ease',
                }}
              >
                *
              </Typography>
            </Box>
            <TextField
              fullWidth
              size="small"
              placeholder="Saisissez la description"
              value={formData.description}
              onChange={handleChange('description')}
              onBlur={handleBlur('description')}
              error={touched.description && !!errors.description}
              helperText={
                touched.description && errors.description
                  ? errors.description.message
                  : 'Minimum 10 caractères'
              }
            />
          </Box>

          {/* Radio */}
          <FormControl component="fieldset">
            <FormLabel component="legend" sx={{ mb: 1, fontWeight: 500 }}>
              Souhaitez-vous copier le contenu de la table ?
            </FormLabel>
            <RadioGroup
              row
              value={formData.copyContent ? 'oui' : 'non'}
              onChange={handleRadioChange}
            >
              <FormControlLabel value="oui" control={<Radio />} label="Oui" />
              <FormControlLabel value="non" control={<Radio />} label="Non" />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button
          onClick={handleClose}
          variant="contained"
          sx={{
            bgcolor: '#4A148C',
            color: 'white',
            textTransform: 'uppercase',
            px: 4,
            '&:hover': { bgcolor: '#6A1B9A' },
          }}
        >
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid()}
          sx={{
            bgcolor: isFormValid() ? '#9E9E9E' : '#E0E0E0',
            color: 'white',
            textTransform: 'uppercase',
            px: 4,
            '&:hover': { bgcolor: isFormValid() ? '#757575' : '#E0E0E0' },
            '&:disabled': { bgcolor: '#E0E0E0', color: '#9E9E9E' },
          }}
        >
          {nameCheckMutation.isPending ? 'Vérification...' : 'Copier'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
