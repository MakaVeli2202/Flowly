using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace Glanz.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private static readonly HttpClient _httpClient = new HttpClient();

    // Your Google Business profile ID
    private const string PlaceId = "CbY8wgSE0iXGEAE";

    // Hardcoded fallback reviews (used when API fails)
    private static readonly List<object> FallbackReviews = new()
    {
        new { id = 1, author = "Jack Stoker", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjUZTLRAS10KNOwUGa7UlniVgxZBSd6CeXLZ4wNTZ7u1eSh3RSPowQ=w80-h80-c-rp-mo-ba3-br100", fallbackInitials = "JS", rating = 5, date = "6 days ago", text = "Noah and Bert are the bomb! They came out and made my car look better than when I first bought it! I would use these guys again and again!" },
        new { id = 2, author = "Jaden Reynolds", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjVl-8iYeGys1-Y_sH4qLenRZxbAinRyVbKEQeYn5v2822Exyi6JKw=w80-h80-c-rp-mo-br100", fallbackInitials = "JR", rating = 5, date = "1 week ago", text = "Thank you Bert and Noah for working with me on 2 separate days in getting the vehicle cleaned. Everything turned out great and CLEAN 🧼." },
        new { id = 3, author = "Drew D'Armond", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjWpnP-klxJ73HEyajqUTqrYEjd959PIK6e3wubBHv3wP7foWvY=w80-h80-c-rp-mo-br100", fallbackInitials = "DA", rating = 5, date = "2 weeks ago", text = "Thorough and meticulous interior cleaning. Looks fantastic, thanks!" },
        new { id = 4, author = "Kamryn Schoeffler", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjXhLt0wpdvhkSrLyfbmQ_BAvVtKIWReScZ7ehGJmaPxdBs6wzbU=w80-h80-c-rp-mo-br100", fallbackInitials = "KS", rating = 5, date = "1 month ago", text = "Excellent service, would use again!" },
        new { id = 5, author = "Troy", avatar = "https://lh3.googleusercontent.com/a/ACg8ocJ_n0-jYhV2tl1ULCdEsCuCX0cR3UJwKrTwdFZI9gdjlcjp5Os=w80-h80-c-rp-mo-br100", fallbackInitials = "T", rating = 5, date = "1 month ago", text = "Did an amazing job, quick and fast.. truck looks great." },
        new { id = 6, author = "William Norman", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjU8jMgWZJRu14ZpU2BTHxn96M4jMjRTs23yrc21lNaUC1zoJTWP=w80-h80-c-rp-mo-ba3-br100", fallbackInitials = "WN", rating = 5, date = "1 month ago", text = "Now I have the cleanest 2002 Honda Pilot. My friends were making fun of me for spending $400 to clean a $3000 car, but who's laughing now?!" },
        new { id = 7, author = "Paul Panzica", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjUCaTaheLP3shn7yc2CytvkpiMShGId4Cei2FEsKrDIDP_E8q0=w80-h80-c-rp-mo-br100", fallbackInitials = "PP", rating = 5, date = "1 month ago", text = "Great service, quick, courteous and responsive. Full 1 year coat applied and shining on my Lucid and Tesla." },
        new { id = 8, author = "Tim Bosworth", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjVLZ1e0HzRTYCdgSnv4zj6N9FY-4kBHVsRQr6dwAO5aCv0HFeBG=w80-h80-c-rp-mo-br100", fallbackInitials = "TB", rating = 5, date = "1 month ago", text = "Easy to book with, fast response, and really worked with my schedule. The guys showed up on time and did an amazing job!" },
        new { id = 9, author = "Sean Gregg", avatar = "https://lh3.googleusercontent.com/a-/ALV-UjWh_GK5UQ55wa0CVx1irt1q29HXCLlBSxCXu81hoSWF4N03ei4c=w80-h80-c-rp-mo-br100", fallbackInitials = "SG", rating = 5, date = "1 month ago", text = "The detailers did a very good job. They got my truck looking like I bought it yesterday." }
    };

    public ReviewsController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("public")]
    public async Task<IActionResult> GetPublic()
    {
        try
        {
            // Try to fetch from Google Places API
            var apiKey = _configuration["Google:PlacesApiKey"];
            if (!string.IsNullOrEmpty(apiKey))
            {
                var url = $"https://maps.googleapis.com/maps/api/place/details/json?place_id={PlaceId}&fields=reviews&key={apiKey}";
                var response = await _httpClient.GetAsync(url);
                
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    
                    if (root.TryGetProperty("result", out var result) && 
                        result.TryGetProperty("reviews", out var reviews))
                    {
                        var googleReviews = new List<object>();
                        int id = 1;
                        foreach (var review in reviews.EnumerateArray())
                        {
                            var authorName = review.GetProperty("author_name").GetString() ?? "Anonymous";
                            var rating = review.TryGetProperty("rating", out var r) ? r.GetInt32() : 5;
                            var text = review.TryGetProperty("text", out var t) ? t.GetString() : "";
                            var time = review.TryGetProperty("relative_time_description", out var rel) ? rel.GetString() : "";
                            var profilePhoto = review.TryGetProperty("profile_photo_url", out var photo) ? photo.GetString() : "";
                            
                            googleReviews.Add(new { 
                                id = id++, 
                                author = authorName,
                                avatar = profilePhoto,
                                fallbackInitials = GetInitials(authorName),
                                rating = rating,
                                date = time,
                                text = text
                            });
                        }
                        
                        if (googleReviews.Count > 0)
                        {
                            return Ok(new { reviews = googleReviews });
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to fetch Google reviews: {ex.Message}");
        }

        // Fallback to hardcoded reviews
        return Ok(new { reviews = FallbackReviews });
    }

    [HttpGet("summary")]
    public IActionResult GetSummary()
    {
        // Return review summary (could be cached)
        return Ok(new
        {
            averageRating = 4.9,
            totalReviews = 500,
            fiveStarPercent = 95,
            fourStarPercent = 4,
            threeStarPercent = 1,
            googleReviewUrl = "https://g.page/r/CbY8wgSE0iXGEAE/review"
        });
    }

    private static string GetInitials(string name)
    {
        if (string.IsNullOrEmpty(name)) return "?";
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 1) return parts[0][0].ToString().ToUpper();
        return $"{parts[0][0]}{parts[^1][0]}".ToUpper();
    }
}