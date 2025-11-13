<h1 align="center">TMDb Scraper</h1>

<p align="center">
  <b>Extract comprehensive data from The Movie Database (TMDb) effortlessly. Scrape movies, TV shows, and celebrity information with ease.</b>
</p>

<p align="center">
  <a href="https://apify.com/shahidirfan/themoviedb-scraper"><img src="https://img.shields.io/badge/Apify-Ready-blue.svg" alt="Apify Ready"></a>
  <a href="https://apify.com/shahidirfan/themoviedb-scraper"><img src="https://img.shields.io/apify/actor-builds/shahidirfan/themoviedb-scraper" alt="Build Status"></a>
  <a href="https://apify.com/shahidirfan/themoviedb-scraper"><img src="https://img.shields.io/apify/actor-runs/shahidirfan/themoviedb-scraper" alt="Runs"></a>
</p>

## 📖 Description

TMDb Scraper is a powerful and flexible tool designed for extracting detailed information from The Movie Database (TMDb). Whether you're building a personal project, conducting academic research, or developing a commercial application, this scraper offers a reliable and user-friendly solution to gather data on movies, TV shows, and people.

This actor prioritizes the official TMDb API for fast and accurate data retrieval, with a built-in fallback to web scraping methods when necessary. It supports customizable search parameters, allowing you to filter by genre, year, popularity, and more.

### Key Benefits
- **Comprehensive Data Collection**: Gather rich metadata including ratings, reviews, cast, crew, images, and keywords.
- **Flexible Search Capabilities**: Search by keywords, genres, release years, and specific queries.
- **High-Quality Output**: Structured JSON data ready for integration into your applications.
- **Reliable Performance**: Optimized for speed and efficiency with configurable delays to respect rate limits.

## ✨ Features

- **Multi-Content Support**: Scrape data for movies, TV shows, and people.
- **Advanced Filtering**: Use genre IDs, year ranges, and sorting options to refine results.
- **Rich Metadata Extraction**: Collect reviews, images, keywords, and collection details.
- **API-First Approach**: Leverages TMDb's official API for superior data quality and speed.
- **Customizable Limits**: Control the number of results, pages, and items per content.
- **Delay Management**: Built-in delays to ensure compliance with TMDb's terms of service.

## 🔧 Input Configuration

Configure the scraper using the following input parameters to tailor the data extraction to your needs.

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `apiKey` | String | Your TMDb API key for enhanced reliability and speed. Obtain one from [TMDb](https://www.themoviedb.org/settings/api). | `YOUR_TMDB_API_KEY_HERE` |
| `useApiFirst` | Boolean | Prioritize the TMDb API over web scraping. | `true` |
| `contentType` | String | Type of content to scrape: `movie`, `tv`, or `person`. | `tv` |
| `searchQueries` | String | Comma-separated list of search terms for content queries. | `""` |
| `genreIds` | String | Comma-separated genre IDs to filter results (e.g., "28" for Action). | `""` |
| `yearFrom` | Integer | Starting year for release date filtering. |  |
| `yearTo` | Integer | Ending year for release date filtering. |  |
| `resultsWanted` | Integer | Maximum number of main results to return. | `5` |
| `maxPages` | Integer | Maximum pages to scrape from search results. | `3` |
| `sortBy` | String | Sorting criteria (e.g., `popularity.desc`, `vote_average.desc`). | `popularity.desc` |
| `collectPeople` | Boolean | Include cast and crew information. | `true` |
| `collectReviews` | Boolean | Gather user reviews and ratings. | `true` |
| `collectKeywords` | Boolean | Extract associated keywords and tags. | `true` |
| `collectImages` | Boolean | Download high-resolution images. | `true` |
| `collectCollections` | Boolean | For movies, include collection details. | `false` |
| `maxReviewsPerContent` | Integer | Limit reviews collected per item. | `25` |
| `maxImagesPerContent` | Integer | Limit images collected per item. | `20` |
| `minDelayMs` | Integer | Minimum delay between requests (ms). | `1000` |
| `maxDelayMs` | Integer | Maximum delay between requests (ms). | `3000` |
| `peopleQuery` | String | Search term for people (when contentType is `person`). |  |
| `peopleResultsWanted` | Integer | Maximum people results to return. | `3` |

## 📤 Output Data

The scraper outputs structured JSON data for each scraped item. Below are examples of the data formats for different content types.

### Movie Data
```json
{
  "tmdb_id": 27205,
  "title": "Inception",
  "overview": "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: 'inception', the implantation of another person's idea into a target's subconscious.",
  "release_date": "2010-07-15",
  "vote_average": 8.4,
  "popularity": 102.6,
  "content_type": "movie",
  "genres": ["Action", "Science Fiction", "Thriller"],
  "cast": [...],
  "crew": [...],
  "reviews": [...],
  "images": [...],
  "keywords": [...]
}
```

### TV Show Data
```json
{
  "tmdb_id": 1396,
  "title": "Breaking Bad",
  "overview": "When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live. He breaks bad.",
  "first_air_date": "2008-01-20",
  "vote_average": 8.8,
  "popularity": 297.4,
  "content_type": "tv",
  "genres": ["Crime", "Drama", "Thriller"],
  "cast": [...],
  "crew": [...],
  "reviews": [...],
  "images": [...],
  "keywords": [...]
}
```

### Person Data
```json
{
  "person_id": 6193,
  "name": "Leonardo DiCaprio",
  "biography": "Leonardo Wilhelm DiCaprio is an American actor, producer, and environmentalist. He has often played unconventional roles, particularly in biopics and period films.",
  "birthday": "1974-11-11",
  "known_for_department": "Acting",
  "popularity": 35.1,
  "filmography": [...]
}
```

## 🚀 Usage Examples

### Example 1: Scrape Popular Movies from 2024
```json
{
  "contentType": "movie",
  "yearFrom": 2024,
  "yearTo": 2024,
  "sortBy": "popularity.desc",
  "resultsWanted": 5,
  "collectReviews": true,
  "collectImages": true
}
```

### Example 2: Get Details of Specific TV Shows
```json
{
  "contentType": "tv",
  "searchQueries": ["Breaking Bad", "Game of Thrones", "Stranger Things"],
  "collectPeople": true,
  "collectReviews": true,
  "maxReviewsPerContent": 10
}
```

### Example 3: Find Celebrities by Name
```json
{
  "contentType": "person",
  "peopleQuery": "Leonardo DiCaprio",
  "peopleResultsWanted": 3
}
```

### Example 4: Scrape Action Movies with High Ratings
```json
{
  "contentType": "movie",
  "genreIds": "28",
  "sortBy": "vote_average.desc",
  "resultsWanted": 5,
  "collectKeywords": true
}
```

## ⚙️ How to Use

1. **Set Up Your API Key**: Provide your TMDb API key in the `apiKey` field for optimal performance.
2. **Configure Inputs**: Use the input parameters to specify your search criteria and data collection preferences.
3. **Run the Actor**: Execute the scraper on the Apify platform.
4. **Download Results**: Access and download the scraped data in JSON format.

## 📊 Limits and Considerations

- **Rate Limiting**: Respects TMDb API limits with configurable delays.
- **Data Volume**: Large result sets may take longer to process.
- **API Key Requirements**: Using your own API key is recommended for better reliability.
- **Content Availability**: Data availability depends on TMDb's database.

## 📝 Disclaimer

This scraper is intended for personal, educational, and research purposes. Users are responsible for complying with TMDb's terms of service and applicable laws. The developers are not liable for any misuse of this tool.

## 🔗 Related Links

- [TMDb Official Website](https://www.themoviedb.org/)
- [Apify Platform](https://apify.com/)
- [Get TMDb API Key](https://www.themoviedb.org/settings/api)