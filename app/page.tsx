import {
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarExport,
} from '@mui/x-data-grid';

function CustomToolbar() {
  const handlePurge = () => {
    console.log('Purge clicked');
  };

  return (
    <Box sx={{ 
      p: 1, 
      display: 'flex', 
      gap: 1, 
      alignItems: 'center',
      borderBottom: 1, 
      borderColor: 'divider' 
    }}>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
      <Box sx={{ flexGrow: 1 }} />
      <Button
        size="small"
        startIcon={<DeleteSweepIcon />}
        onClick={handlePurge}
        variant="outlined"
        color="error"
      >
        Purge
      </Button>
    </Box>
  );
}
