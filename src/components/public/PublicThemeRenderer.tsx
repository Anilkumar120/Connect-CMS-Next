
"use client";

import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { subscribeToThemeUpdates } from "@/lib/theme-events";

export type MenuItem = {
  id: string;
  label: string;
  href: string;
  target?: string | null;
  children: MenuItem[];
};

export type ThemeElement = {
  id: string;
  type: string;
  location?: string;
  menuId?: string;
  label?: string;
  url?: string;
  text?: string;
  iconName?: string;
  mobileIconName?: string;
  mobileIconColor?: string;
  imageUrl?: string;
  alt?: string;
  caption?: string;
  level?: number;
  items?: string[];
  value?: number;
  size?: ResponsiveValue;
  widgetStyle?: Record<string, string>;
  widgetAdvanced?: Record<string, string>;
  widgetResponsive?: Partial<
    Record<"width" | "height" | "padding" | "margin" | "gap", ResponsiveValue>
  >;
  width?: ResponsiveValue;
  height?: ResponsiveValue;
  display?: "flex" | "grid" | "block";
  columns?: number;
  flex?: string;
  alignItems?: string;
  justifyContent?: string;
  flexWrap?: "wrap" | "nowrap";
  children?: ThemeElement[];
};

type ResponsiveValue = {
  desktop?: string;
  tablet?: string;
  mobile?: string;
};

type ThemeLogo = {
  text?: string;
  url?: string;
  imageUrl?: string;
  alt?: string;
  width?: ResponsiveValue;
  height?: ResponsiveValue;
};

export type ThemeConfig = {
  header: {
    layout?: string;
    background?: string;
    textColor?: string;
    logo?: ThemeLogo;
    elements?: ThemeElement[];
    styles?: {
      normal?: Record<string, string>;
      hover?: Record<string, string>;
    };
    advanced?: {
      width?: ResponsiveValue;
      height?: ResponsiveValue;
      padding?: ResponsiveValue;
      margin?: ResponsiveValue;
      gap?: ResponsiveValue;
      alignment?: string;
      position?: string;
      zIndex?: string;
      borderRadius?: string;
      overlayColor?: string;
      fontFamily?: string;
      fontSize?: string;
      fontWeight?: string;
      lineHeight?: string;
      display?: "flex" | "grid" | "block";
      columns?: string;
      flexWrap?: string;
      menuColor?: string;
      menuHoverColor?: string;
      menuHoverBackground?: string;
      submenuColor?: string;
      submenuBackground?: string;
      submenuHoverColor?: string;
      submenuHoverBackground?: string;
      buttonBackground?: string;
      buttonText?: string;
      buttonRadius?: string;
      buttonHoverBackground?: string;
      buttonHoverText?: string;
    };
  };
  footer: {
    background?: string;
    textColor?: string;
    columns?: number;
    description?: string;
    logo?: ThemeLogo;
    elements?: ThemeElement[];
    advanced?: {
      width?: ResponsiveValue;
      height?: ResponsiveValue;
      padding?: ResponsiveValue;
      margin?: ResponsiveValue;
      gap?: ResponsiveValue;
      columns?: ResponsiveValue;
      display?: "flex" | "grid" | "block";
      fontFamily?: string;
      fontSize?: string;
      fontWeight?: string;
      lineHeight?: string;
    };
  };
  globalStyles: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    contentWidth?: string;
  };
};

type PublicThemeContextType = {
  theme: ThemeConfig;
  headerMenu: MenuItem[];
  footerMenu: MenuItem[];
  loading: boolean;
  currentYear: string;
};

const defaultTheme: ThemeConfig = {
  header: {
    layout: "horizontal",
    background: "#ffffff",
    textColor: "#34465b",
    logo: {
      text: "",
      url: "/",
    },
    elements: [],
  },
  footer: {
    background: "#071e35",
    textColor: "#ffffff",
    columns: 2,
    elements: [],
    description: "Connecting people, homes and businesses.",
    logo: {
      text: "CONNECT BROADBAND",
      url: "/",
      imageUrl: "",
      alt: "Connect Broadband",
    },
    advanced: {
      width: { desktop: "1200px", tablet: "100%", mobile: "100%" },
      height: { desktop: "auto", tablet: "auto", mobile: "auto" },
      padding: {
        desktop: "35px 24px",
        tablet: "30px 20px",
        mobile: "30px 20px",
      },
      margin: { desktop: "0", tablet: "0", mobile: "0" },
      gap: { desktop: "30px", tablet: "22px", mobile: "18px" },
      columns: { desktop: "2", tablet: "2", mobile: "1" },
      display: "grid",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      lineHeight: "1.6",
    },
  },
  globalStyles: {
    primaryColor: "#0c2f55",
    secondaryColor: "#3984e8",
    fontFamily: "Arial, Helvetica, sans-serif",
    contentWidth: "1200px",
  },
};

const defaultContextValue: PublicThemeContextType = {
  theme: defaultTheme,
  headerMenu: [],
  footerMenu: [],
  loading: true,
  currentYear: "",
};

const PublicThemeContext =
  createContext<PublicThemeContextType | null>(null);

export function usePublicTheme() {
  const context = useContext(PublicThemeContext);

  if (!context) {
    throw new Error(
      "usePublicTheme must be used inside PublicThemeRenderer"
    );
  }

  return context;
}

function normalizeTheme(themeData: Partial<ThemeConfig>): ThemeConfig {
  const headerData = themeData.header || {};
  const footerData = themeData.footer || {};
  const globalData = themeData.globalStyles || {};

  return {
    header: {
      ...defaultTheme.header,
      ...headerData,
      logo: {
        ...defaultTheme.header.logo,
        ...(headerData.logo || {}),
      },
      elements: Array.isArray(headerData.elements)
        ? headerData.elements
        : defaultTheme.header.elements,
    },

    footer: {
      ...defaultTheme.footer,
      ...footerData,
      logo: {
        ...defaultTheme.footer.logo,
        ...(footerData.logo || {}),
      },
      advanced: {
        ...defaultTheme.footer.advanced,
        ...(footerData.advanced || {}),
        width: {
          ...defaultTheme.footer.advanced?.width,
          ...(footerData.advanced?.width || {}),
        },
        height: {
          ...defaultTheme.footer.advanced?.height,
          ...(footerData.advanced?.height || {}),
        },
        padding: {
          ...defaultTheme.footer.advanced?.padding,
          ...(footerData.advanced?.padding || {}),
        },
        margin: {
          ...defaultTheme.footer.advanced?.margin,
          ...(footerData.advanced?.margin || {}),
        },
        gap: {
          ...defaultTheme.footer.advanced?.gap,
          ...(footerData.advanced?.gap || {}),
        },
        columns: {
          ...defaultTheme.footer.advanced?.columns,
          ...(footerData.advanced?.columns || {}),
        },
      },
      elements: Array.isArray(footerData.elements)
        ? footerData.elements
        : defaultTheme.footer.elements,
    },

    globalStyles: {
      ...defaultTheme.globalStyles,
      ...globalData,
    },
  };
}

function normalizeMenuItems(items: unknown): MenuItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .map((item) => ({
      id: String(item.id || ""),
      label: String(item.label || ""),
      href: String(item.href || "#"),
      target:
        typeof item.target === "string"
          ? item.target
          : "_self",
      children: normalizeMenuItems(item.children),
    }));
}

function findMenuId(elements: ThemeElement[] | undefined): string | null {
  for (const element of elements ?? []) {
    if (element.type === "menu" && element.menuId) return element.menuId;
    const nested = findMenuId(element.children);
    if (nested) return nested;
  }
  return null;
}

export default function PublicThemeRenderer({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <PublicThemeContext.Provider value={defaultContextValue}>
          {children}
        </PublicThemeContext.Provider>
      }
    >
      <PublicThemeContent>{children}</PublicThemeContent>
    </Suspense>
  );
}

function PublicThemeContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);

  const [headerMenu, setHeaderMenu] = useState<MenuItem[]>([]);
  const [footerMenu, setFooterMenu] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState("");

  useEffect(() => {
    let cancelled = false;
    let activeRequest = 0;

    async function loadPublicTheme() {
      const requestId = ++activeRequest;
      setLoading(true);

      try {
        const themeResponse = await fetch(
          `/api/public/theme?path=${encodeURIComponent(pathname)}`,
          { cache: "no-store" }
        );
        if (!themeResponse.ok) {
          throw new Error(
            `Public theme request failed with HTTP ${themeResponse.status}.`
          );
        }
        const themeResult = await themeResponse.json();
        const selectedMenuId = findMenuId(themeResult?.theme?.header?.elements);
        const headerMenuUrl = selectedMenuId
          ? `/api/public/menus/HEADER?menuId=${encodeURIComponent(selectedMenuId)}`
          : "/api/public/menus/HEADER";
        const [headerResponse, footerResponse] = await Promise.all([
          fetch(headerMenuUrl, { cache: "no-store" }),
          fetch("/api/public/menus/FOOTER", { cache: "no-store" }),
        ]);
        if (!headerResponse.ok || !footerResponse.ok) {
          throw new Error("Public menu request failed.");
        }
        const [headerResult, footerResult] = await Promise.all([
          headerResponse.json(),
          footerResponse.json(),
        ]);

        if (cancelled || requestId !== activeRequest) {
          return;
        }

        if (typeof themeResult?.currentYear === "number") {
          setCurrentYear(String(themeResult.currentYear));
        }

        if (themeResult?.success && themeResult.theme) {
          setTheme(
            normalizeTheme(
              themeResult.theme as Partial<ThemeConfig>
            )
          );
        }

        if (headerResult?.success && headerResult.menu) {
          setHeaderMenu(
            normalizeMenuItems(headerResult.menu.items)
          );
        } else {
          setHeaderMenu([]);
        }

        if (footerResult?.success && footerResult.menu) {
          setFooterMenu(
            normalizeMenuItems(footerResult.menu.items)
          );
        } else {
          setFooterMenu([]);
        }
      } catch (error) {
        if (!cancelled && requestId === activeRequest) {
          console.error("Public theme loading failed:", error);
        }
      } finally {
        if (!cancelled && requestId === activeRequest) {
          setLoading(false);
        }
      }
    }

    void loadPublicTheme();
    const unsubscribe = subscribeToThemeUpdates(() => {
      void loadPublicTheme();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pathname]);

  return (
    <PublicThemeContext.Provider
      value={{
        theme,
        headerMenu,
        footerMenu,
        loading,
        currentYear,
      }}
    >
      {children}
    </PublicThemeContext.Provider>
  );
}
