
export type BuilderKind =
  | "header"
  | "footer"
  | "page"
  | "post"
  | "single"
  | "archive"
  | "custom";

export type BuilderDevice = "desktop" | "tablet" | "mobile";

export type BuilderDocumentStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

export type BuilderTarget = {
  kind: BuilderKind;
  id?: string;
  slug?: string;
  postTypeSlug?: string;
  title?: string;
};

export type ResponsiveValue<T> = {
  desktop?: T;
  tablet?: T;
  mobile?: T;
};

export type BuilderUnit =
  | "px"
  | "%"
  | "em"
  | "rem"
  | "vw"
  | "vh"
  | "auto"
  | "custom";

export type BuilderSpacing = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  unit?: BuilderUnit;
  linked?: boolean;
};

export type BuilderTypography = {
  fontFamily?: string;
  fontSize?: ResponsiveValue<string>;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  wordSpacing?: string;
  textTransform?:
    | "none"
    | "uppercase"
    | "lowercase"
    | "capitalize";
  fontStyle?: "normal" | "italic" | "oblique";
  textDecoration?:
    | "none"
    | "underline"
    | "overline"
    | "line-through";
  textAlign?: ResponsiveValue<
    "left" | "center" | "right" | "justify"
  >;
  textShadow?: string;
  textStroke?: string;
};

export type BuilderGradientStop = {
  color: string;
  position: number;
};

export type BuilderGradient = {
  type?: "linear" | "radial";
  angle?: number;
  position?: string;
  stops?: BuilderGradientStop[];
  color1?: string;
  color2?: string;
};

export type BuilderBackground = {
  type?:
    | "classic"
    | "gradient"
    | "image"
    | "video"
    | "slideshow";

  color?: string | ResponsiveValue<string>;
  image?: string;
  imageId?: string;
  imageAlt?: string;
  resolution?: string;

  position?: string;
  positionX?: ResponsiveValue<string>;
  positionY?: ResponsiveValue<string>;
  size?: string;
  customWidth?: ResponsiveValue<string>;
  repeat?: string;
  attachment?: string;

  overlayColor?: string;
  overlayOpacity?: number;
  overlayImage?: string;
  overlayImageId?: string;
  overlayGradient?: BuilderGradient;
  blendMode?: string;

  gradient?: BuilderGradient;

  videoUrl?: string;
  videoStart?: number;
  videoEnd?: number;
  videoLoop?: boolean;
  videoMute?: boolean;
  videoMobileFallback?: string;

  slideshow?: Array<{
    id: string;
    url: string;
    alt?: string;
  }>;
  slideshowDuration?: number;
  slideshowTransition?: string;
  slideshowTransitionDuration?: number;
};

export type BuilderBorder = {
  style?:
    | "none"
    | "solid"
    | "dashed"
    | "dotted"
    | "double";
  width?: string;
  color?: string | ResponsiveValue<string>;
  radius?: ResponsiveValue<string>;
  topWidth?: string;
  rightWidth?: string;
  bottomWidth?: string;
  leftWidth?: string;
};

export type BuilderFilters = {
  blur?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  grayscale?: number;
  sepia?: number;
  invert?: number;
};

export type BuilderFlexDirection =
  | "row"
  | "column"
  | "row-reverse"
  | "column-reverse";

export type BuilderJustifyContent =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type BuilderAlignItems =
  | "flex-start"
  | "center"
  | "flex-end"
  | "stretch"
  | "baseline";

export type BuilderAlignSelf =
  | "auto"
  | "flex-start"
  | "center"
  | "flex-end"
  | "stretch"
  | "baseline";

export type BuilderAlignContent =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "stretch";

export type BuilderFlexWrap =
  | "nowrap"
  | "wrap"
  | "wrap-reverse";

export type BuilderDisplay =
  | "block"
  | "inline"
  | "inline-block"
  | "flex"
  | "grid"
  | "inline-flex"
  | "inline-grid"
  | "none";

export type BuilderPosition =
  | "default"
  | "static"
  | "relative"
  | "absolute"
  | "fixed"
  | "sticky";

export type BuilderOverflow =
  | "visible"
  | "hidden"
  | "auto"
  | "scroll";

export type BuilderGridAutoFlow =
  | "row"
  | "column"
  | "row dense"
  | "column dense";

export type BuilderTransform = {
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scaleX?: number;
  scaleY?: number;
  translateX?: string;
  translateY?: string;
  skewX?: number;
  skewY?: number;
  origin?: string;
};

export type BuilderMask = {
  enabled?: boolean;
  shape?: string;
  size?: string;
  position?: string;
};

export type BuilderMotion = {
  entranceAnimation?: string;
  animationDuration?: number;
  animationDelay?: number;
  animationEasing?: string;
  scrollEffects?: boolean;
  sticky?: boolean;
  stickyPosition?: "top" | "bottom";
  stickyOffset?: number;
  mouseEffects?: boolean;
};

export type BuilderStyle = {
  width?: ResponsiveValue<string>;
  height?: ResponsiveValue<string>;
  minWidth?: ResponsiveValue<string>;
  maxWidth?: ResponsiveValue<string>;
  minHeight?: ResponsiveValue<string>;
  maxHeight?: ResponsiveValue<string>;

  display?: ResponsiveValue<BuilderDisplay>;
  direction?: ResponsiveValue<BuilderFlexDirection>;
  justifyContent?: ResponsiveValue<BuilderJustifyContent>;
  alignItems?: ResponsiveValue<BuilderAlignItems>;
  alignContent?: ResponsiveValue<BuilderAlignContent>;
  alignSelf?: ResponsiveValue<BuilderAlignSelf>;
  flexWrap?: ResponsiveValue<BuilderFlexWrap>;

  gap?: ResponsiveValue<string>;
  rowGap?: ResponsiveValue<string>;
  columnGap?: ResponsiveValue<string>;

  flexGrow?: ResponsiveValue<string>;
  flexShrink?: ResponsiveValue<string>;
  flexBasis?: ResponsiveValue<string>;
  order?: ResponsiveValue<string>;

  gridTemplateColumns?: ResponsiveValue<string>;
  gridTemplateRows?: ResponsiveValue<string>;
  gridAutoColumns?: ResponsiveValue<string>;
  gridAutoRows?: ResponsiveValue<string>;
  gridAutoFlow?: ResponsiveValue<BuilderGridAutoFlow>;
  gridColumn?: ResponsiveValue<string>;
  gridRow?: ResponsiveValue<string>;
  gridColumnGap?: ResponsiveValue<string>;
  gridRowGap?: ResponsiveValue<string>;

  padding?: ResponsiveValue<BuilderSpacing>;
  margin?: ResponsiveValue<BuilderSpacing>;
  stylePadding?: ResponsiveValue<BuilderSpacing>;
  styleMargin?: ResponsiveValue<BuilderSpacing>;

  typography?: BuilderTypography;

  color?: string | ResponsiveValue<string>;
  colorHover?: string | ResponsiveValue<string>;
  blendMode?: string;
  background?: BuilderBackground;
  backgroundHover?: BuilderBackground;

  border?: BuilderBorder;
  borderHover?: BuilderBorder;

  opacity?: number;
  opacityHover?: number;
  boxShadow?: string;
  boxShadowHover?: string;
  textShadow?: string;

  position?: BuilderPosition;
  top?: ResponsiveValue<string>;
  right?: ResponsiveValue<string>;
  bottom?: ResponsiveValue<string>;
  left?: ResponsiveValue<string>;

  zIndex?: number;
  overflow?: BuilderOverflow;

  transform?: string;
  transformSettings?: BuilderTransform;
  transformSettingsHover?: BuilderTransform;
  mask?: BuilderMask;
  transition?: string;
  transitionDuration?: string;

  filters?: BuilderFilters;
  hoverFilters?: BuilderFilters;

  motion?: BuilderMotion;
  customCss?: string;

  /** Device-specific visual overrides. Tablet and Mobile inherit from Desktop
   * unless a value is explicitly set for that device. */
  responsive?: Partial<Record<BuilderDevice, BuilderStyleResponsiveOverride>>;
};

export type BuilderStyleResponsiveOverride = Partial<Omit<BuilderStyle, "responsive">>;

export type BuilderAdvancedSettings = {
  cssId?: string;
  cssClasses?: string;
  customCss?: string;

  hideOnDesktop?: boolean;
  hideOnTablet?: boolean;
  hideOnMobile?: boolean;

  locked?: boolean;
  htmlTag?: string;

  link?: string;
  openInNewTab?: boolean;
  widthMode?:
    | "default"
    | "inline"
    | "full"
    | "custom"
    | ResponsiveValue<"default" | "inline" | "full" | "custom">;
  displayCondition?: "always" | "hidden";
  cacheEnabled?: boolean;
  cacheDuration?: number;

  attributes?: Record<string, string>;
};

export type BuilderDynamicSource =
  | "current.title"
  | "current.slug"
  | "current.url"
  | "current.description"
  | "current.excerpt"
  | "current.content"
  | "current.featuredImage"
  | "current.publishedAt"
  | "current.authorName"
  | "current.authorBio"
  | "current.categories"
  | "custom.field";

export type BuilderDynamicBinding = {
  source: BuilderDynamicSource;
  fieldName?: string;
  fallback?: string;
};
export type BuilderNode = {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  locked?: boolean;
  children?: BuilderNode[];
  props: Record<string, unknown>;
  styles: BuilderStyle;
  dynamicBindings?: Record<string, BuilderDynamicBinding>;
  // CONNECT_BUILDER_DYNAMIC_BINDINGS_V1
  advanced?: BuilderAdvancedSettings;
};

export type BuilderLayout = {
  version: 1;
  root: BuilderNode[];
};

export type BuilderGlobalColor = {
  id: string;
  name: string;
  value: string;
};

export type BuilderGlobalFont = {
  id: string;
  name: string;
  family: string;
  weight?: string;
  size?: string;
  lineHeight?: string;
};

export type BuilderGlobalStyles = {
  colors: BuilderGlobalColor[];
  fonts: BuilderGlobalFont[];
};

export type BuilderDocumentData = {
  id?: string;
  documentKey: string;
  kind: BuilderKind;
  title: string;
  slug?: string | null;
  targetId?: string | null;
  postTypeSlug?: string | null;
  status: BuilderDocumentStatus;
  layout: BuilderLayout;
  settings: Record<string, unknown>;
  globalStyles: BuilderGlobalStyles;
  conditions: Record<string, unknown>;
  publishedAt?: string | null;
  updatedAt?: string;
};

export type BuilderWidgetDefinition = {
  type: string;
  label: string;
  description: string;
  category: string;
  icon: string;
  defaultProps: Record<string, unknown>;
  supportsChildren?: boolean;
};
