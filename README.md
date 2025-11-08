# TMDb Comprehensive Data Scraper

> Production-ready Apify actor for collecting comprehensive data from The Movie Database (TMDb) with automatic fallback scraping capabilities.

This actor collects movies, TV shows, people, reviews, keywords, images, and collections data from TMDb. It uses the official TMDb API when available and automatically falls back to website scraping when needed, ensuring reliable data collection.

## ✨ Features

- **Multi-Content Support** – Scrape movies, TV shows, people, reviews, keywords, images, and collections
- **Flexible Data Collection** – Choose what data to collect with granular control
- **API with Fallback** – Uses TMDb API when available, falls back to website scraping
- **Comprehensive Search** – Search by query, discover by genre/year, or collect popular content
- **Rich Metadata** – Collect detailed information, credits, reviews, images, and more
- **People Data** – Collect actor/director profiles and filmographies
- **Rate Limiting** – Built-in delays to respect TMDb policies
- **Production Ready** – Handles errors, retries, and edge cases automatically

## 📥 Input Parameters

### API Configuration

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `apiKey` | String | No | Your TMDb API v3 key. If provided, uses API for faster data collection. If not provided, falls back to website scraping. | - |
| `useApiFirst` | Boolean | No | If true and API key is provided, attempts to use TMDb API first. If false or API key is missing, uses website scraping directly. | `true` |

### Content Selection

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `contentType` | String | Content type to scrape: 'movie', 'tv', 'person', or 'both' | `tv` |

### Search Options

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `searchQueries` | Array | List of search terms to query TMDb for. Each query will be searched separately. | `[]` |
| `genreIds` | Array | TMDb genre IDs to filter by. | - |
| `yearFrom` | Integer | Minimum release/first air year. | - |
| `yearTo` | Integer | Maximum release/first air year. | - |
| `sortBy` | String | Sort order for discover endpoint. | `popularity.desc` |

### Collection Options

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `resultsWanted` | Integer | Maximum number of content items to collect per search query. | 100 |
| `maxPages` | Integer | Maximum API result pages to fetch. | 5 |

### Additional Data Collection

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `collectPeople` | Boolean | Collect cast and crew data for each content item. | `false` |
| `collectReviews` | Boolean | Collect user reviews for each content item. | `false` |
| `collectKeywords` | Boolean | Collect keywords/tags for each content item. | `false` |
| `collectImages` | Boolean | Collect poster and backdrop images for each content item. | `false` |
| `collectCollections` | Boolean | Collect movie collection data (movies only). | `false` |
| `maxReviewsPerContent` | Integer | Maximum number of reviews to collect per content item. | 25 |
| `maxImagesPerContent` | Integer | Maximum number of images to collect per content item. | 20 |

### Rate Limiting

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `minDelayMs` | Integer | Minimum delay between requests to respect rate limits. | 1000 |
| `maxDelayMs` | Integer | Maximum delay between requests for randomization. | 3000 |

### People Data Collection

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `peopleQuery` | String | Search term for people data collection. | - |
| `peopleResultsWanted` | Integer | Maximum number of people to collect. | 10 |

## 🚀 Usage Examples

### Basic Movie Collection

Collect basic movie information without additional data.

```json
{
  "contentType": "movie",
  "searchQueries": ["Inception", "The Dark Knight"],
  "collectReviews": false,
  "collectKeywords": false,
  "collectImages": false,
  "collectPeople": false,
  "collectCollections": false
}
```

### Comprehensive TV Show Data Collection

Collect TV shows with all available data including reviews, images, and people.

```json
{
  "contentType": "tv",
  "searchQueries": ["Breaking Bad", "Stranger Things"],
  "collectReviews": true,
  "collectKeywords": true,
  "collectImages": true,
  "collectPeople": true,
  "collectCollections": false,
  "maxReviewsPerContent": 50,
  "maxImagesPerContent": 20
}
```

### People-Centric Collection

Collect detailed information about actors and directors.

```json
{
  "contentType": "person",
  "searchQueries": ["Leonardo DiCaprio", "Scarlett Johansson"],
  "collectReviews": false,
  "collectKeywords": false,
  "collectImages": false,
  "collectPeople": false,
  "collectCollections": false
}
```

### Mixed Content Types with API Key

Use TMDb API for comprehensive data collection across multiple content types.

```json
{
  "apiKey": "your_tmdb_api_key_here",
  "useApiFirst": true,
  "contentType": "both",
  "searchQueries": ["Avengers", "The Mandalorian"],
  "collectReviews": true,
  "collectKeywords": true,
  "collectImages": true,
  "collectPeople": true,
  "collectCollections": true,
  "maxReviewsPerContent": 25,
  "maxImagesPerContent": 15
}
```

### Discover by Genre and Year

Discover content by genre and release year without specific search queries.

```json
{
  "contentType": "movie",
  "genreIds": [28, 12],
  "yearFrom": 2020,
  "yearTo": 2024,
  "sortBy": "popularity.desc",
  "resultsWanted": 50,
  "collectImages": true
}
```

## 📤 Output Data Types

The scraper can collect multiple types of data, each stored as separate dataset items with a `data_type` field.

### Content Data (Movies/TV Shows)

```json
{
  "tmdb_id": 1399,
  "title": "Game of Thrones",
  "overview": "Seven noble families fight for control of the mythical land of Westeros.",
  "first_air_date": "2011-04-17",
  "vote_average": 8.4,
  "vote_count": 22000,
  "popularity": 400.0,
  "poster_path": "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
  "backdrop_path": "/suopoADq0k8YZr4dQXcU6pToj6s.jpg",
  "content_type": "tv",
  "genres": ["Sci-Fi & Fantasy", "Drama", "Action & Adventure"],
  "number_of_seasons": 8,
  "number_of_episodes": 73,
  "episode_run_time": [60],
  "status": "Ended",
  "networks": ["HBO"],
  "created_by": ["David Benioff", "D.B. Weiss"],
  "fetchedAt": "2025-08-11T12:00:00.000Z"
}
```

### Credits Data

```json
{
  "content_id": 1399,
  "content_type": "tv",
  "content_title": "Game of Thrones",
  "cast": [
    {
      "id": 1223786,
      "name": "Emilia Clarke",
      "character": "Daenerys Targaryen",
      "order": 0,
      "profile_path": "/iN5G7AdKKnvh5p3iKS5BdMK0q9Z.jpg"
    }
  ],
  "crew": [
    {
      "id": 9813,
      "name": "David Benioff",
      "job": "Executive Producer",
      "department": "Production",
      "profile_path": null
    }
  ],
  "data_type": "credits",
  "fetchedAt": "2025-08-11T12:00:00.000Z"
}
```

### Reviews Data

```json
{
  "content_id": 1399,
  "content_type": "tv",
  "content_title": "Game of Thrones",
  "reviews": [
    {
      "id": "1234567890",
      "author": "MovieCritic123",
      "content": "An epic tale of power and betrayal...",
      "url": "https://www.themoviedb.org/review/1234567890",
      "created_at": "2020-05-20T10:30:00.000Z",
      "updated_at": "2020-05-20T10:30:00.000Z",
      "author_details": {
        "name": "MovieCritic123",
        "username": "moviecritic123",
        "avatar_path": "/avatar.jpg",
        "rating": 9.0
      }
    }
  ],
  "total_results": 150,
  "data_type": "reviews",
  "fetchedAt": "2025-08-11T12:00:00.000Z"
}
```

### Images Data

```json
{
  "content_id": 1399,
  "content_type": "tv",
  "content_title": "Game of Thrones",
  "posters": [
    {
      "file_path": "/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
      "width": 1000,
      "height": 1500,
      "aspect_ratio": 0.667,
      "vote_average": 5.5,
      "vote_count": 12
    }
  ],
  "backdrops": [
    {
      "file_path": "/suopoADq0k8YZr4dQXcU6pToj6s.jpg",
      "width": 1920,
      "height": 1080,
      "aspect_ratio": 1.778,
      "vote_average": 6.2,
      "vote_count": 8
    }
  ],
  "data_type": "images",
  "fetchedAt": "2025-08-11T12:00:00.000Z"
}
```

### People Data

```json
{
  "person_id": 6193,
  "name": "Leonardo DiCaprio",
  "biography": "Leonardo Wilhelm DiCaprio is an American actor...",
  "birthday": "1974-11-11",
  "deathday": null,
  "gender": 2,
  "known_for_department": "Acting",
  "place_of_birth": "Los Angeles, California, USA",
  "profile_path": "/wo2hJpn04vbtmh0B9utCFdsQhxM.jpg",
  "popularity": 25.5,
  "also_known_as": ["Leo DiCaprio", "Leonardo Di Caprio"],
  "movie_credits": [
    {
      "id": 27205,
      "title": "Inception",
      "character": "Dom Cobb",
      "release_date": "2010-07-15"
    }
  ],
  "tv_credits": [
    {
      "id": 1399,
      "name": "Game of Thrones",
      "character": "Guest",
      "first_air_date": "2011-04-17"
    }
  ],
  "data_type": "person",
  "fetchedAt": "2025-08-11T12:00:00.000Z"
}
```

### Collection Data

```json
{
  "collection_id": 1241,
  "name": "Harry Potter Collection",
  "overview": "The Harry Potter film series...",
  "poster_path": "/eVPs2Y0LyvTLZn6AP5Z6O2rtiGB.jpg",
  "backdrop_path": "/wfnMt6LGqYHcNyOfsuusw5lX3bL.jpg",
  "parts": [
    {
      "id": 671,
      "title": "Harry Potter and the Philosopher's Stone",
      "release_date": "2001-11-16",
      "poster_path": "/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg",
      "vote_average": 7.9
    }
  ],
  "data_type": "collection",
  "fetchedAt": "2025-08-11T12:00:00.000Z"
}
```

## ⚙️ API Limits & Best Practices

- **TMDb API Limits**: 40 requests per 10 seconds, 200 requests per hour for free accounts
- **Apify Platform**: No strict limits, but consider costs for large-scale scraping
- **Delay Settings**: Use `minDelayMs` and `maxDelayMs` to respect rate limits
- **Error Handling**: Automatic fallback to website scraping when API limits are reached
- **Caching**: Results are cached to avoid duplicate API calls

## 🔧 Getting a TMDb API Key

1. Visit [https://www.themoviedb.org/](https://www.themoviedb.org/)
2. Create a free account
3. Go to Settings > API
4. Request an API key (v3 auth)
5. Copy the API key to use in the `apiKey` parameter

## 📊 TMDb Genre IDs

### Movie Genres
- `28`: Action
- `12`: Adventure
- `16`: Animation
- `35`: Comedy
- `80`: Crime
- `99`: Documentary
- `18`: Drama
- `10751`: Family
- `14`: Fantasy
- `36`: History
- `27`: Horror
- `10402`: Music
- `9648`: Mystery
- `10749`: Romance
- `878`: Science Fiction
- `10770`: TV Movie
- `53`: Thriller
- `10752`: War
- `37`: Western

### TV Genres
- `10759`: Action & Adventure
- `16`: Animation
- `35`: Comedy
- `80`: Crime
- `99`: Documentary
- `18`: Drama
- `10751`: Family
- `10762`: Kids
- `9648`: Mystery
- `10763`: News
- `10764`: Reality
- `10765`: Sci-Fi & Fantasy
- `10766`: Soap
- `10767`: Talk
- `10768`: War & Politics
- `37`: Western

## 🐛 Troubleshooting

### Common Issues

**No results returned**
- Check your search parameters
- Try broader search queries
- Verify genre IDs are correct

**API rate limiting**
- The actor includes automatic delays
- Reduce `resultsWanted` or increase delay settings
- Consider getting a TMDb API key for higher limits

**Missing data fields**
- Some content may not have complete information in TMDb
- Enable fallback scraping for more comprehensive data collection

**Authentication errors**
- Verify your TMDb API key is correct and active
- Check that your API key has the necessary permissions

### Fallback Behavior

When API access fails, the actor automatically falls back to website scraping:

- **Data Source**: Switches from TMDb API to TMDb website
- **Data Format**: Converted to match API format where possible
- **Limitations**: Fewer fields available, slower collection
- **Tracking**: Fallback data includes `"source": "tmdb_website_fallback"` field

## 📝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**⚠️ Important**: Use this actor responsibly and respect TMDb's terms of service and API usage policies.
