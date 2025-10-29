import { Box, Typography } from "@mui/material";

// Types
interface CategoryCardsProps {
  categoryName: string;
  categoryNumber: number;
  active: boolean;
  handleChangeCategory: () => void;
}

const CategoryCards = ({
  categoryName,
  categoryNumber,
  active,
  handleChangeCategory,
}: CategoryCardsProps) => {
  return (
    <Box
      onClick={handleChangeCategory}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        height: "75px",
        width: "500px",
        cursor: "pointer",
        boxShadow: 3,
        background: active ? "#581d74" : "white",
        color: active ? "white" : "black",
        transition: "all 0.3s ease",
        "&:hover": {
          transform: "scale(1.02)",
          boxShadow: 6,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <Typography variant="h6" component="div">
          {categoryNumber}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            maxWidth: 150,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {categoryName}
        </Typography>
      </Box>
    </Box>
  );
};

export default CategoryCards;
