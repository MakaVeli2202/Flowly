import apiClient from './axios';

const FALLBACK_REVIEWS = [
  { id: 1, author: "Jack Stoker", fallbackInitials: "JS", rating: 5, date: "6 days ago", text: "Noah and Bert are the bomb! They came out and made my car look better than when I first bought it!" },
  { id: 2, author: "Jaden Reynolds", fallbackInitials: "JR", rating: 5, date: "1 week ago", text: "Thank you Bert and Noah for working with me on 2 separate days. Everything turned out great!" },
  { id: 3, author: "Drew D'Armond", fallbackInitials: "DA", rating: 5, date: "2 weeks ago", text: "Thorough and meticulous interior cleaning. Looks fantastic, thanks!" },
  { id: 4, author: "Kamryn Schoeffler", fallbackInitials: "KS", rating: 5, date: "1 month ago", text: "Excellent service, would use again!" },
  { id: 5, author: "Troy", fallbackInitials: "T", rating: 5, date: "1 month ago", text: "Did an amazing job, quick and fast.. truck looks great." },
  { id: 6, author: "William Norman", fallbackInitials: "WN", rating: 5, date: "1 month ago", text: "Now I have the cleanest 2002 Honda Pilot. My friends were making fun of me!" },
  { id: 7, author: "Paul Panzica", fallbackInitials: "PP", rating: 5, date: "1 month ago", text: "Great service, quick, courteous and responsive." },
  { id: 8, author: "Tim Bosworth", fallbackInitials: "TB", rating: 5, date: "1 month ago", text: "Easy to book with, fast response. The guys showed up on time and did an amazing job!" },
  { id: 9, author: "Sean Gregg", fallbackInitials: "SG", rating: 5, date: "1 month ago", text: "The detailers did a very good job. They got my truck looking like I bought it yesterday." }
];

const FALLBACK_SUMMARY = { averageRating: 4.9, totalReviews: 500, fiveStarPercent: 95 };

export const reviewsAPI = {
  getPublic: async () => {
    try {
      const response = await apiClient.get('/reviews/public');
      const data = response?.data;
      const reviews = Array.isArray(data?.reviews)
        ? data.reviews
        : Array.isArray(data)
          ? data
          : [];

      return reviews.length > 0 ? reviews : FALLBACK_REVIEWS;
    } catch {
      return FALLBACK_REVIEWS;
    }
  },
  getSummary: async () => {
    try {
      const response = await apiClient.get('/reviews/summary');
      const data = response?.data;
      if (data && typeof data === 'object') return data;
      return FALLBACK_SUMMARY;
    } catch {
      return FALLBACK_SUMMARY;
    }
  },
};