/* eslint-disable @next/next/no-img-element */
"use client";
import React, { useState, useEffect } from "react";
import type { BookshopWidgetProps, BookData } from "./types";
import { fetchBookshopBookData } from "./parser";
import Link from "next/link";

/**
 * BookshopWidget component to display book information
 * @param {BookshopWidgetProps} props - The properties for the widget
 * @returns {JSX.Element} - The rendered widget
 */
const BookshopWidget: React.FC<BookshopWidgetProps> = ({
  type = "book",
  affiliateId,
  sku,
}) => {
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Use our API service to fetch book data
        const response = await fetchBookshopBookData(affiliateId, sku);
        setBookData(response);
        setLoading(false);
      } catch (err) {
        setError("Failed to load book data");
        setLoading(false);
        console.error("Error fetching book data:", err);
      }
    };

    void fetchData();
  }, [sku, affiliateId]);

  if (loading) {
    return (
      <div className="w-full py-4 text-center">Loading book information...</div>
    );
  }

  if (error || !bookData) {
    return (
      <div className="w-full py-4 text-center text-red-500">
        {error ?? "Failed to load book data"}
      </div>
    );
  }

  // Render different widget types
  const renderWidget = () => {
    switch (type) {
      case "book":
        return renderBookWidget();
      case "featured":
        return renderFeaturedWidget();
      case "book_button":
        return renderBookButtonWidget();
      default:
        return renderBookWidget(); // Default to book widget
    }
  };

  const renderBookWidget = () => {
    return (
      // <a
      //   href={bookData.affiliateUrl}
      //   target="_blank"
      //   rel="noopener noreferrer"
      //   className="block no-underline"
      // >
      <div className="inline-flex h-full w-full rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
        {/* Image container */}
        <div className="flex w-1/2 flex-shrink-0 p-4">
          <Link
            className="relative my-auto overflow-hidden rounded-2xl shadow-md transition-shadow duration-200 hover:shadow-lg"
            href={bookData.affiliateUrl}
          >
            <img
              src={bookData.imageUrl}
              alt={bookData.title}
              className="block h-auto w-full"
            />
          </Link>
        </div>

        {/* Book details */}
        <div className="flex flex-1 flex-col pt-4 pr-4 pb-4">
          {/* Header with affiliate info */}
          {bookData.affiliateInfo && (
            <header className="mb-3 flex">
              <img
                src={bookData.affiliateInfo.logoUrl}
                alt={bookData.affiliateInfo.name}
                className="mt-1 mr-2 h-5 w-5 rounded-full object-cover"
              />
              <div>
                <h1 className="text-base font-normal">
                  {bookData.affiliateInfo.name}
                </h1>
                <h2 className="text-xs text-gray-500 uppercase">
                  POWERED BY
                  <span className="ml-1 text-purple-700">Bookshop.org</span>
                </h2>
              </div>
            </header>
          )}

          {/* Book title and author */}
          <h1 className="mb-0 max-w-prose text-base font-semibold">
            {bookData.title}
          </h1>
          <h2 className="text-base font-light">by {bookData.author}</h2>

          {/* Pricing */}
          <div className="mb-4">
            <span className="mr-1 text-pink-600 line-through">
              {bookData.listPrice}
            </span>
            <span className="font-medium">{bookData.salePrice}</span>
          </div>

          {/* Button */}
          <div className="max-w-xs">
            <Link
              className="block rounded-full bg-pink-600 px-4 py-2 text-center text-sm font-semibold tracking-wider text-white uppercase shadow-md transition-shadow duration-200 hover:shadow-xl"
              href={bookData.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy On Bookshop.org
            </Link>
            <span className="mt-1 block text-center text-sm font-light">
              Support Local Bookstores
            </span>
          </div>
        </div>
      </div>
      // </a>
    );
  };

  const renderFeaturedWidget = () => {
    return (
      <a
        href={bookData.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline"
      >
        <div className="flex w-full flex-col rounded border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
          {/* Image container */}
          <div className="mb-1 flex justify-center p-1">
            <div className="relative w-full">
              <img
                src={bookData.imageUrl}
                alt={bookData.title}
                className="block h-auto w-full"
              />
            </div>
          </div>

          {/* Book details */}
          <div className="flex flex-col items-center">
            {/* Book title and author */}
            <h1 className="mb-0 text-center text-base font-semibold">
              {bookData.title}
            </h1>
            <h2 className="text-center text-base font-light">
              by {bookData.author}
            </h2>

            {/* Pricing */}
            <div className="mb-4">
              <span className="mr-1 text-pink-600 line-through">
                {bookData.listPrice}
              </span>
              <span className="font-medium">{bookData.salePrice}</span>
            </div>

            {/* Button */}
            <div className="w-52 pb-4">
              <a
                className="block rounded-full bg-pink-600 px-4 py-2 text-center text-sm font-semibold tracking-wider text-white uppercase"
                href={bookData.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy On Bookshop.org
              </a>
              <span className="mt-1 block text-center text-sm font-light">
                Support Local Bookstores
              </span>
            </div>
          </div>
        </div>
      </a>
    );
  };

  const renderBookButtonWidget = () => {
    return (
      <div className="flex flex-col">
        <a
          className="block rounded-full bg-pink-600 px-4 py-2 text-center text-sm font-semibold tracking-wider text-white uppercase"
          href={bookData.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Buy “{bookData.title}” on Bookshop.org
        </a>
        <span className="mt-1 block text-center text-sm font-light">
          Support Local Bookstores
        </span>
      </div>
    );
  };

  return renderWidget();
};

export default BookshopWidget;
