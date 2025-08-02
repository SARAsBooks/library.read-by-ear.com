// types.ts

export interface BookshopWidgetProps {
  type: "book" | "book_button" | "search" | "indiebound" | "list" | "featured";
  affiliateId: string;
  sku: string;
}

export interface BookData {
  title: string;
  author: string;
  imageUrl: string;
  listPrice: string;
  salePrice: string;
  affiliateUrl: string;
  affiliateInfo?: {
    name: string;
    logoUrl: string;
  };
}

export interface SearchData {
  keyword: string;
  results: BookData[];
}

export interface ListData {
  title: string;
  books: BookData[];
}
