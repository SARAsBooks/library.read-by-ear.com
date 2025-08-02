"use server";
import type { BookData } from "./types";

/**
 * Parses HTML content from Bookshop.org widget URL to extract book data
 * @param html The HTML content from https://bookshop.org/widgets/book/book/{affiliateId}/{sku}
 * @param affiliateId The affiliate ID used
 * @param sku The book SKU
 * @returns Parsed BookData object
 */
export async function parseBookshopWidgetHtml(
  html: string,
  affiliateId: string,
  sku: string,
): Promise<BookData> {
  // Default values in case extraction fails
  const defaultData: BookData = {
    title: "Book Title Not Found",
    author: "Author Not Found",
    imageUrl: `https://images-us.bookshop.org/ingram/${sku}.jpg?height=500&v=v2`,
    listPrice: "",
    salePrice: "",
    affiliateUrl: `https://bookshop.org/a/${affiliateId}/${sku}`,
    affiliateInfo: {
      name: "Bookshop.org Affiliate",
      logoUrl: "",
    },
  };

  try {
    // Extract book title
    const titleRegex =
      /<aside[^>]*[\s\S]*?<\/header>\s*<h1[^>]*>([^<]+)<\/h1>\s*<h2/i;
    const titleMatch = titleRegex.exec(html);
    if (titleMatch?.[1]) {
      defaultData.title = titleMatch[1].trim();
    }

    // Extract author
    const authorRegex =
      /<aside[^>]*[\s\S]*?<\/header>[\s\S]*?<h2[^>]*>by\s+([^<]+)<\/h2>/i;
    const authorMatch = authorRegex.exec(html);
    if (authorMatch?.[1]) {
      defaultData.author = authorMatch[1].trim();
    }

    // Extract list price
    const listPriceRegex = /<span class="list-price">\s*([^<]+)\s*<\/span>/i;
    const listPriceMatch = listPriceRegex.exec(html);
    if (listPriceMatch?.[1]) {
      defaultData.listPrice = listPriceMatch[1].trim();
    }

    // Extract sale price
    const salePriceRegex = /<span class="price">([^<]+)<\/span>/i;
    const salePriceMatch = salePriceRegex.exec(html);
    if (salePriceMatch?.[1]) {
      defaultData.salePrice = salePriceMatch[1].trim();
    }

    // Extract affiliate URL
    const affiliateUrlRegex =
      /<a[^>]*href="([^"]+)"[^>]*>Buy On Bookshop\.org<\/a>/i;
    const affiliateUrlMatch = affiliateUrlRegex.exec(html);
    if (affiliateUrlMatch?.[1]) {
      defaultData.affiliateUrl = affiliateUrlMatch[1].trim();
    }

    // Extract affiliate name
    const affiliateNameRegex = /<header[^>]*>[\s\S]*?<h1[^>]*>([^<]+)<\/h1>/i;
    const affiliateNameMatch = affiliateNameRegex.exec(html);
    if (affiliateNameMatch?.[1]) {
      defaultData.affiliateInfo = {
        ...defaultData.affiliateInfo,
        name: affiliateNameMatch[1].trim(),
        logoUrl: defaultData.affiliateInfo?.logoUrl ?? "",
      };
    }

    // Extract affiliate logo URL
    const affiliateLogoRegex = /<header[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i;
    const affiliateLogoMatch = affiliateLogoRegex.exec(html);
    if (affiliateLogoMatch?.[1]) {
      defaultData.affiliateInfo = {
        ...defaultData.affiliateInfo,
        name: defaultData.affiliateInfo?.name ?? "Bookshop.org Affiliate",
        logoUrl: affiliateLogoMatch[1].trim(),
      };
    }

    return defaultData;
  } catch (error) {
    console.error("Error parsing Bookshop.org widget HTML:", error);
    return defaultData;
  }
}

/**
 * Server-side function to fetch and parse the Bookshop.org widget HTML
 * @param affiliateId The affiliate ID
 * @param sku The book SKU
 * @returns Promise resolving to BookData if successful, null otherwise
 */
export async function fetchBookshopBookData(
  affiliateId: string,
  sku: string,
): Promise<BookData | null> {
  try {
    const url = `https://bookshop.org/widgets/book/book/${affiliateId}/${sku}`;

    // This should be run server-side to avoid CORS issues
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch widget HTML: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    return parseBookshopWidgetHtml(html, affiliateId, sku);
  } catch (error) {
    console.error("Error fetching Bookshop.org widget data:", error);

    // Return default data if fetching fails
    return null;
  }
}
