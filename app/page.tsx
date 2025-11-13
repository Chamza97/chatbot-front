import { DataGrid, GridColDef, Toolbar, ToolbarButton } from '@mui/x-data-grid';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

function CustomToolbar() {
  const handlePurge = () => {
    console.log('Purge clicked');
  };

  return (
    <Toolbar>
      <ToolbarButton 
        onClick={handlePurge}
        startIcon={<DeleteSweepIcon />}
      >
        Purge
      </ToolbarButton>
    </Toolbar>
  );
}

function MyDataGrid() {
  return (
    <DataGrid
      rows={rows}
      columns={columns}
      showToolbar
      slots={{
        toolbar: CustomToolbar,
      }}
    />
  );
}
