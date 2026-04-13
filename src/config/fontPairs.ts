export interface FontPair {
  id: string;
  label: string;
  display: string;
  body: string;
  displayName: string;
  bodyName: string;
  note: string;
  bodyItalic?: boolean;
}

export const FONT_PAIRS: FontPair[] = [
  {
    id: "A",
    label: "Option A",
    display: "'Italiana', serif",
    body: "'Arapey', serif",
    displayName: "Italiana",
    bodyName: "Arapey (italic)",
    note: "Elegant didone display + refined italic serif body. Luxurious, editorial.",
    bodyItalic: true,
  },
  {
    id: "B",
    label: "Option B",
    display: "'Lora', serif",
    body: "'Poppins', sans-serif",
    displayName: "Lora",
    bodyName: "Poppins",
    note: "Warm readable serif + geometric sans. Soft, approachable.",
  },
  {
    id: "C",
    label: "Option C",
    display: "'Cormorant Garamond', serif",
    body: "'Source Sans 3', sans-serif",
    displayName: "Cormorant Garamond",
    bodyName: "Source Sans 3",
    note: "Light refined serif + humanist sans. Airy, premium.",
  },
  {
    id: "D",
    label: "Option D",
    display: "'Bodoni Moda', serif",
    body: "'Quicksand', sans-serif",
    displayName: "Bodoni Moda",
    bodyName: "Quicksand",
    note: "High-contrast editorial serif + soft rounded sans. Elegant, warm, readable.",
  },
  {
    id: "E",
    label: "Option E",
    display: "'Poiret One', cursive",
    body: "'Montserrat', sans-serif",
    displayName: "Poiret One",
    bodyName: "Montserrat",
    note: "Geometric art deco display + versatile modern sans. Elegant, airy, distinctive.",
  },
  {
    id: "F",
    label: "Option F",
    display: "'Playfair Display', serif",
    body: "'DM Sans', sans-serif",
    displayName: "Playfair Display",
    bodyName: "DM Sans",
    note: "High-contrast didone serif + clean geometric sans. Luxurious, modern, editorial.",
  },
];
