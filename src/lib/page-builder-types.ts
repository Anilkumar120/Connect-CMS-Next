export type PageBuilderDevice = "desktop" | "tablet" | "mobile";

export type PageBuilderElementType =
  | "section"
  | "container"
  | "heading"
  | "text"
  | "image"
  | "icon"
  | "button"
  | "link"
  | "divider"
  | "spacer";

export type PageBuilderStyles = {
  color?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  hoverColor?: string;
  hoverBackgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
  borderRadius?: string;
  width?: string;
  height?: string;
  margin?: string;
  padding?: string;
  gap?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  flexBasis?: string;
  flexGrow?: string;
  flexShrink?: string;
  order?: string;
  overflow?: "visible" | "hidden" | "auto";
  borderWidth?: string;
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  borderColor?: string;
};

export type PageBuilderElement = {
  id: string;
  type: PageBuilderElementType;
  content?: string;
  level?: number;
  src?: string;
  alt?: string;
  href?: string;
  linkTarget?: "_self" | "_blank";
  display?: "flex" | "grid" | "block";
  columns?: number;
  alignItems?: string;
  justifyContent?: string;
  flexWrap?: "wrap" | "nowrap";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  alignContent?: "start" | "center" | "end" | "space-between" | "space-around" | "stretch";
  columnGap?: string;
  rowGap?: string;
  styles?: PageBuilderStyles;
  responsive?: Partial<Record<PageBuilderDevice, PageBuilderStyles>>;
  children?: PageBuilderElement[];
};

export type PageBuilderLayout = {
  version: 1;
  elements: PageBuilderElement[];
};
