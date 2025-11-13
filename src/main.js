import { Actor, Dataset, log } from 'apify';
import { gotScraping } from 'got-scraping';
import { HeaderGenerator } from 'header-generator';
import { load as loadHtml } from 'cheerio';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_WEB_BASE = 'https://www.themoviedb.org';
const MAX_PERSON_PAGES = 5;
let REQUEST_TIMEOUT_MS = 35000;

const WEB_HEADERS = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Pragma: 'no-cache',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelay = async (min, max) => {
    const boundedMin = Number.isFinite(min) ? Math.max(0, min) : 0;
    const boundedMax = Number.isFinite(max) ? Math.max(boundedMin, max) : boundedMin;
    const duration = boundedMin + Math.random() * (boundedMax - boundedMin);
    if (duration > 0) await sleep(duration);
};

const parseStringList = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === 'string') return item.trim();
                if (typeof item === 'number' && Number.isFinite(item)) return String(item);
                return '';
            })
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return [String(value)];
    }
    return [];
};

const parseNumberList = (value) => parseStringList(value)
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num));

const limitArray = (items = [], limit = items.length) => {
    if (!Array.isArray(items) || limit <= 0) return [];
    return items.slice(0, Math.max(0, limit));
};

const buildDiscoverParams = (contentType, filters, page) => {
    const params = {
        page,
        sort_by: filters.sortBy || 'popularity.desc',
        include_adult: false,
        with_genres: filters.genreIds?.length ? filters.genreIds.join(',') : undefined,
    };

    if (filters.yearFrom) {
        const key = contentType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
        params[key] = `${filters.yearFrom}-01-01`;
    }
    if (filters.yearTo) {
        const key = contentType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte';
        params[key] = `${filters.yearTo}-12-31`;
    }

    return params;
};

const tmdbApiRequest = async ({ path, apiKey, params = {}, label }) => {
    if (!apiKey) throw new Error('TMDb API key is missing.');

    const url = new URL(`${TMDB_API_BASE}${path}`);
    url.searchParams.set('api_key', apiKey);
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }

    const response = await gotScraping({
        url: url.toString(),
        responseType: 'json',
        retry: { limit: 2 },
        timeout: { request: REQUEST_TIMEOUT_MS },
    });

    if (response.statusCode && response.statusCode >= 400) {
        throw new Error(`TMDb API ${label || path} failed with HTTP ${response.statusCode}`);
    }

    return response.body;
};

const formatList = (values) => {
    if (!Array.isArray(values)) return null;
    const sanitized = values
        .map((value) => {
            if (typeof value === 'string') return value.trim();
            if (typeof value === 'number' && Number.isFinite(value)) return String(value);
            return null;
        })
        .filter(Boolean);
    return sanitized.length ? sanitized.join(', ') : null;
};

const formatObjectList = (values, extractor) => {
    if (!Array.isArray(values)) return null;
    const sanitized = values
        .map((item) => extractor(item))
        .filter(Boolean);
    return sanitized.length ? sanitized.join(', ') : null;
};

const mapContentRecord = (detail, contentType, source) => {
    const baseTitle = contentType === 'movie' ? detail.title : detail.name;
    const genreNames = formatObjectList(detail.genres, (genre) => genre?.name);
    const genreIdsRaw = Array.isArray(detail.genres)
        ? detail.genres.map((g) => g.id).filter((id) => Number.isFinite(id))
        : null;
    const genreIds = formatList(genreIdsRaw);
    const spokenLanguages = formatObjectList(detail.spoken_languages, (lang) => lang?.english_name || lang?.name);
    const productionCompanies = formatObjectList(detail.production_companies, (company) => company?.name);
    const productionCountries = formatObjectList(detail.production_countries, (country) => country?.name);
    const originCountries = formatList(detail.origin_country);
    const networks = formatObjectList(detail.networks, (network) => network?.name);
    const createdBy = formatObjectList(detail.created_by, (creator) => creator?.name);
    const episodeRunTime = formatList(detail.episode_run_time);

    return {
        data_type: 'content',
        source,
        content_type: contentType,
        tmdb_id: detail.id,
        title: baseTitle,
        original_title: detail.original_title || detail.original_name || baseTitle,
        overview: detail.overview,
        tagline: detail.tagline,
        homepage: detail.homepage,
        status: detail.status,
        in_production: detail.in_production,
        vote_average: detail.vote_average,
        vote_count: detail.vote_count,
        popularity: detail.popularity,
        poster_path: detail.poster_path,
        backdrop_path: detail.backdrop_path,
        adult: detail.adult ?? false,
        genres: genreNames,
        genre_ids: genreIds,
        spoken_languages: spokenLanguages,
        production_companies: productionCompanies,
        production_countries: productionCountries,
        fetchedAt: new Date().toISOString(),
        ...(contentType === 'movie'
            ? {
                release_date: detail.release_date,
                runtime: detail.runtime,
                budget: detail.budget,
                revenue: detail.revenue,
            }
            : {
                first_air_date: detail.first_air_date,
                last_air_date: detail.last_air_date,
                number_of_seasons: detail.number_of_seasons,
                number_of_episodes: detail.number_of_episodes,
                episode_run_time: episodeRunTime,
                networks,
                created_by: createdBy,
                origin_country: originCountries,
            }),
    };
};

const pushCreditsRecord = async (detail, contentType, source) => {
    const cast = detail.credits?.cast?.map((person) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        order: person.order,
        gender: person.gender,
        profile_path: person.profile_path,
    })) || [];

    const crew = detail.credits?.crew?.map((person) => ({
        id: person.id,
        name: person.name,
        job: person.job,
        department: person.department,
        gender: person.gender,
        profile_path: person.profile_path,
    })) || [];

    if (!cast.length && !crew.length) return 0;

    await Dataset.pushData({
        data_type: 'credits',
        source,
        content_type: contentType,
        content_id: detail.id,
        content_title: detail.title || detail.name,
        cast,
        crew,
        fetchedAt: new Date().toISOString(),
    });
    return 1;
};

const collectAllReviews = async (detail, apiKey, contentType, maxReviews) => {
    if (!maxReviews) return [];
    const allReviews = [...(detail.reviews?.results ?? [])];
    const totalPages = detail.reviews?.total_pages ?? 1;
    let currentPage = 1;

    while (allReviews.length < maxReviews && currentPage < totalPages) {
        currentPage += 1;
        const response = await tmdbApiRequest({
            path: `/${contentType}/${detail.id}/reviews`,
            apiKey,
            params: { page: currentPage },
            label: `${contentType} reviews`,
        });
        allReviews.push(...(response.results ?? []));
    }

    return limitArray(allReviews, maxReviews).map((review) => ({
        id: review.id,
        author: review.author,
        author_details: review.author_details,
        content: review.content,
        created_at: review.created_at,
        updated_at: review.updated_at,
        url: review.url,
    }));
};

const pushReviewsRecord = async (detail, apiKey, contentType, source, maxReviews) => {
    const reviews = await collectAllReviews(detail, apiKey, contentType, maxReviews);
    if (!reviews.length) return 0;

    await Dataset.pushData({
        data_type: 'reviews',
        source,
        content_type: contentType,
        content_id: detail.id,
        content_title: detail.title || detail.name,
        reviews,
        fetchedAt: new Date().toISOString(),
    });
    return 1;
};

const pushKeywordsRecord = async (detail, contentType, source) => {
    const keywordsBlock = contentType === 'movie'
        ? detail.keywords?.keywords
        : detail.keywords?.results;

    if (!keywordsBlock?.length) return 0;

    await Dataset.pushData({
        data_type: 'keywords',
        source,
        content_type: contentType,
        content_id: detail.id,
        content_title: detail.title || detail.name,
        keywords: keywordsBlock.map((keyword) => ({
            id: keyword.id,
            name: keyword.name,
        })),
        fetchedAt: new Date().toISOString(),
    });
    return 1;
};

const pushImagesRecord = async (detail, contentType, source, maxImages) => {
    const posters = limitArray(detail.images?.posters ?? [], maxImages).map((img) => ({
        file_path: img.file_path,
        width: img.width,
        height: img.height,
        aspect_ratio: img.aspect_ratio,
        vote_average: img.vote_average,
        vote_count: img.vote_count,
        iso_639_1: img.iso_639_1,
    }));

    const backdrops = limitArray(detail.images?.backdrops ?? [], maxImages).map((img) => ({
        file_path: img.file_path,
        width: img.width,
        height: img.height,
        aspect_ratio: img.aspect_ratio,
        vote_average: img.vote_average,
        vote_count: img.vote_count,
        iso_639_1: img.iso_639_1,
    }));

    if (!posters.length && !backdrops.length) return 0;

    await Dataset.pushData({
        data_type: 'images',
        source,
        content_type: contentType,
        content_id: detail.id,
        content_title: detail.title || detail.name,
        posters,
        backdrops,
        fetchedAt: new Date().toISOString(),
    });
    return 1;
};

const pushCollectionRecord = async (detail, apiKey, source) => {
    if (!detail.belongs_to_collection?.id) return 0;
    const collection = await tmdbApiRequest({
        path: `/collection/${detail.belongs_to_collection.id}`,
        apiKey,
        label: 'collection',
    });

    await Dataset.pushData({
        data_type: 'collection',
        source,
        collection_id: collection.id,
        name: collection.name,
        overview: collection.overview,
        poster_path: collection.poster_path,
        backdrop_path: collection.backdrop_path,
        parts: collection.parts?.map((part) => ({
            id: part.id,
            title: part.title || part.name,
            release_date: part.release_date || part.first_air_date,
            vote_average: part.vote_average,
            vote_count: part.vote_count,
            popularity: part.popularity,
        })) || [],
        fetchedAt: new Date().toISOString(),
    });
    return 1;
};

const fetchContentDetailFromApi = async ({
    id,
    apiKey,
    contentType,
    extrasConfig,
}) => {
    const append = [];
    if (extrasConfig.collectPeople) append.push('credits');
    if (extrasConfig.collectReviews) append.push('reviews');
    if (extrasConfig.collectKeywords) append.push('keywords');
    if (extrasConfig.collectImages) append.push('images');

    const params = append.length
        ? { append_to_response: append.join(','), include_image_language: 'en,null' }
        : {};

    return tmdbApiRequest({
        path: `/${contentType}/${id}`,
        apiKey,
        params,
        label: `${contentType} ${id}`,
    });
};

const pushContentAndExtras = async ({
    detail,
    contentType,
    apiKey,
    extrasConfig,
    stats,
    source,
}) => {
    try {
        await Dataset.pushData(mapContentRecord(detail, contentType, source));
        stats.contents += 1;
    } catch (error) {
        log.error(`Failed to push content data for ${contentType} ${detail.id}`, { error: error.message });
        throw error;
    }

    if (extrasConfig.collectPeople) {
        stats.extraItems += await pushCreditsRecord(detail, contentType, source);
    }
    if (extrasConfig.collectReviews) {
        stats.extraItems += await pushReviewsRecord(detail, apiKey, contentType, source, extrasConfig.maxReviewsPerContent);
    }
    if (extrasConfig.collectKeywords) {
        stats.extraItems += await pushKeywordsRecord(detail, contentType, source);
    }
    if (extrasConfig.collectImages) {
        stats.extraItems += await pushImagesRecord(detail, contentType, source, extrasConfig.maxImagesPerContent);
    }
    if (extrasConfig.collectCollections && contentType === 'movie') {
        stats.extraItems += await pushCollectionRecord(detail, apiKey, source);
    }
};

const collectContentWithApi = async ({
    apiKey,
    contentType,
    query,
    discoverFilters,
    limit,
    maxPages,
    delayRange,
    extrasConfig,
    stats,
    maxConcurrency = 1,
    startPage = 1,
}) => {
    let saved = 0;
    const concurrency = Math.max(1, Number(maxConcurrency) || 1);
    let lastPage = startPage - 1;

    for (let page = startPage; page <= maxPages && saved < limit; page += 1) {
        lastPage = page;
        const params = query
            ? { query, page, include_adult: false }
            : buildDiscoverParams(contentType, discoverFilters, page);

        const endpoint = query ? `/search/${contentType}` : `/discover/${contentType}`;
        log.info(`TMDb API ${endpoint} page ${page} (${contentType})`);
        const response = await tmdbApiRequest({
            path: endpoint,
            apiKey,
            params,
            label: `${endpoint} page ${page}`,
        });

        const items = response.results ?? [];
        if (!items.length) break;

        const queue = items.slice(0, limit - saved);
        while (queue.length && saved < limit) {
            const batch = queue.splice(0, concurrency);
            const results = await Promise.all(batch.map(async (item) => {
                try {
                    const detail = await fetchContentDetailFromApi({
                        id: item.id,
                        apiKey,
                        contentType,
                        extrasConfig,
                    });
                    await pushContentAndExtras({
                        detail,
                        contentType,
                        apiKey,
                        extrasConfig,
                        stats,
                        source: 'tmdb_api',
                    });
                    await randomDelay(delayRange.minDelayMs, delayRange.maxDelayMs);
                    return 1;
                } catch (error) {
                    log.warning(`Failed to process ${contentType} ${item.id}: ${error.message}`);
                    return 0;
                }
            }));
            saved += results.reduce((sum, val) => sum + val, 0);
        }

        if ((response.total_pages ?? 1) <= page) break;
    }
    return { collected: saved, lastPage };
};

const buildWebListingUrl = ({ contentType, query, discoverFilters, page }) => {
    if (query) {
        const url = new URL(`${TMDB_WEB_BASE}/search/${contentType}`);
        url.searchParams.set('query', query);
        url.searchParams.set('page', String(page));
        return url.href;
    }

    const url = new URL(`${TMDB_WEB_BASE}/discover/${contentType}`);
    url.searchParams.set('page', String(page));
    if (discoverFilters.genreIds?.length) url.searchParams.set('with_genres', discoverFilters.genreIds.join(','));
    if (discoverFilters.sortBy) url.searchParams.set('sort_by', discoverFilters.sortBy);
    if (discoverFilters.yearFrom) {
        const key = contentType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
        url.searchParams.set(key, `${discoverFilters.yearFrom}-01-01`);
    }
    if (discoverFilters.yearTo) {
        const key = contentType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte';
        url.searchParams.set(key, `${discoverFilters.yearTo}-12-31`);
    }
    return url.href;
};

const fetchWebPage = async (url, proxyConfiguration, headerGenerator) => {
    const headers = {
        ...headerGenerator.getHeaders({ httpVersion: '2' }),
        ...WEB_HEADERS,
    };

    const requestOptions = {
        url,
        headers,
        responseType: 'text',
        timeout: { request: REQUEST_TIMEOUT_MS },
        http2: true,
        retry: { limit: 1 },
    };

    if (proxyConfiguration) {
        const proxyUrl = await proxyConfiguration.newUrl();
        if (proxyUrl) requestOptions.proxyUrl = proxyUrl;
    }

    const response = await gotScraping(requestOptions);
    if (response.statusCode && response.statusCode >= 400) {
        throw new Error(`TMDb web request failed (${response.statusCode}) for ${url}`);
    }

    return {
        page$: loadHtml(response.body),
        finalUrl: response.url ?? url,
    };
};

const extractListingItems = ($, contentType) => {
    const entries = new Map();
    $('.card').each((_, card) => {
        const link = $(card).find(`a[href^="/${contentType}/"]`).first();
        if (!link.length) return;
        const href = link.attr('href');
        if (!href) return;
        const match = href.match(/\/(movie|tv)\/(\d+)/);
        if (!match) return;
        const id = Number(match[2]);
        if (!id || match[1] !== contentType) return;

        const title = $(card).find('h2, h3').first().text().trim() || link.text().trim();
        const overview = $(card).find('.overview p').text().trim() || null;
        const releaseDate = $(card).find('.release_date').text().trim() || null;
        const poster = $(card).find('img.poster').attr('data-src') || $(card).find('img.poster').attr('src') || null;

        entries.set(id, {
            id,
            title,
            overview,
            releaseDate,
            poster,
            href: new URL(href, TMDB_WEB_BASE).href,
        });
    });
    return [...entries.values()];
};

const extractTmdbContentData = ($, contentType) => {
    const data = {
        title: $('.title h2, .header h2, h1').first().text().trim()
            || $('[data-testid="hero-title"]').first().text().trim()
            || null,
        overview: $('[data-testid="series_overview"] p, .overview p, .plot, .summary').first().text().trim()
            || $('[data-testid="overview"]').first().text().trim()
            || $('.panel h3 + p').first().text().trim()
            || null,
        rating: (() => {
            const ratingText = $('.user_score_chart').attr('data-percent')
                || $('[data-testid="score"]').text()
                || $('.vote_average').text();
            if (!ratingText) return null;
            const match = ratingText.match(/(\d+(?:\.\d+)?)/);
            return match ? Number(match[1]) / (ratingText.includes('%') ? 10 : 1) : null;
        })(),
        genres: [],
        releaseDate: null,
        runtime: null,
        firstAirDate: null,
        lastAirDate: null,
        numberOfSeasons: null,
        numberOfEpisodes: null,
        episodeRunTime: [],
        status: null,
        networks: [],
        createdBy: [],
    };

    $('.genres a, .genre, [data-testid="genres"] a').each((_, el) => {
        const text = $(el).text().trim();
        if (text && !data.genres.includes(text)) data.genres.push(text);
    });

    $('.facts p').each((_, el) => {
        const label = $(el).find('strong').text().toLowerCase();
        const value = $(el).clone().children().remove().end().text().trim();
        if (contentType === 'movie' && label.includes('runtime')) {
            const match = value.match(/(\d+)\s*min/i);
            if (match) data.runtime = Number(match[1]);
        }
        if (label.includes('status')) data.status = value;
    });

    if (contentType === 'movie') {
        const dateMatch = $('.release_date, .facts p').text().match(/(\d{4}-\d{2}-\d{2}|\d{4})/);
        if (dateMatch) data.releaseDate = dateMatch[1].length === 4 ? `${dateMatch[1]}-01-01` : dateMatch[1];
    } else {
        const firstMatch = $('.first_air_date, .facts p').text().match(/First Aired\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
        if (firstMatch) data.firstAirDate = firstMatch[1];
        const lastMatch = $('.last_air_date, .facts p').text().match(/Last Aired\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
        if (lastMatch) data.lastAirDate = lastMatch[1];
    }

    $('.created_by a').each((_, el) => {
        const text = $(el).text().trim();
        if (text) data.createdBy.push(text);
    });

    $('.networks li').each((_, el) => {
        const text = $(el).text().trim();
        if (text) data.networks.push(text);
    });

    const poster = $('.poster img').attr('src') || $('.profile img').attr('src');
    const backdrop = $('.backdrop img, .hero_image img').attr('src');

    return {
        ...data,
        posterPath: poster || null,
        backdropPath: backdrop || null,
    };
};

const pushWebContentRecord = async (listingItem, detailData, contentType, stats) => {
    const genreList = formatList(detailData.genres);
    const networks = formatList(detailData.networks);
    const createdBy = formatList(detailData.createdBy);
    const episodeRunTime = formatList(detailData.episodeRunTime);

    const record = {
        data_type: 'content',
        source: 'tmdb_web',
        content_type: contentType,
        tmdb_id: listingItem.id,
        title: detailData.title || listingItem.title,
        overview: detailData.overview || listingItem.overview,
        vote_average: detailData.rating,
        poster_path: detailData.posterPath || listingItem.poster,
        backdrop_path: detailData.backdropPath,
        fetchedAt: new Date().toISOString(),
        genres: genreList,
        ...(contentType === 'movie'
            ? { release_date: detailData.releaseDate || listingItem.releaseDate }
            : {
                first_air_date: detailData.firstAirDate || listingItem.releaseDate,
                last_air_date: detailData.lastAirDate,
                number_of_seasons: detailData.numberOfSeasons,
                number_of_episodes: detailData.numberOfEpisodes,
                episode_run_time: episodeRunTime,
                status: detailData.status,
                networks,
                created_by: createdBy,
            }),
    };

    await Dataset.pushData(record);
    stats.contents += 1;
};

const collectContentWithWeb = async ({
    contentType,
    query,
    discoverFilters,
    limit,
    delayRange,
    stats,
    proxyConfiguration,
    headerGenerator,
    concurrency = 1,
    startPage = 1,
}) => {
    if (!limit || limit <= 0) return { collected: 0, lastPage: startPage - 1 };

    let saved = 0;
    let page = startPage;
    let nextUrl = buildWebListingUrl({ contentType, query, discoverFilters: discoverFilters ?? {}, page });
    const seenIds = new Set();
    const effectiveConcurrency = Math.max(1, Number(concurrency) || 1);
    let lastPage = startPage - 1;

    const resolveNextUrl = ($, currentUrl) => {
        const infiniteDiv = $('[id^="pagination_page_"][data-next-page]').first();
        if (infiniteDiv.length) {
            const nextPage = infiniteDiv.attr('data-next-page');
            if (nextPage) {
                const urlObj = new URL(currentUrl);
                urlObj.searchParams.set('page', nextPage);
                return urlObj.href;
            }
        }

        const selectors = [
            'a[rel="next"]',
            '.pagination a[rel="next"]',
            '.pagination .next a',
            '.pagination a.next',
            'a[aria-label="next"]',
            'a[aria-label="Next"]',
        ];
        for (const selector of selectors) {
            const anchor = $(selector).first();
            if (anchor && anchor.length) {
                const href = anchor.attr('href');
                if (href) return new URL(href, TMDB_WEB_BASE).href;
            }
        }
        const fallbackAnchor = $('.pagination a').filter((_, el) => {
            const text = $(el).text().trim().toLowerCase();
            return text === 'next' || text === '›' || text === '»' || text.includes('next');
        }).first();
        if (fallbackAnchor && fallbackAnchor.length) {
            const href = fallbackAnchor.attr('href');
            if (href) return new URL(href, TMDB_WEB_BASE).href;
        }
        return null;
    };

    while (nextUrl && saved < limit) {
        lastPage = page;
        log.info(`TMDb web scraping ${contentType} page ${page} :: ${nextUrl}`);
        const { page$, finalUrl } = await fetchWebPage(nextUrl, proxyConfiguration, headerGenerator);
        const items = extractListingItems(page$, contentType);
        if (!items.length) break;

        const candidates = [];
        for (const item of items) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            candidates.push(item);
        }

        while (candidates.length && saved < limit) {
            const batch = candidates.splice(0, effectiveConcurrency);
            const results = await Promise.all(batch.map(async (item) => {
                try {
                    const { page$: detail$ } = await fetchWebPage(item.href, proxyConfiguration, headerGenerator);
                    const detailData = extractTmdbContentData(detail$, contentType);
                    await pushWebContentRecord(item, detailData, contentType, stats);
                    await randomDelay(delayRange.minDelayMs, delayRange.maxDelayMs);
                    return 1;
                } catch (error) {
                    log.warning(`TMDb web fallback failed for ${item.href}: ${error.message}`);
                    return 0;
                }
            }));
            saved += results.reduce((sum, val) => sum + val, 0);
        }

        nextUrl = resolveNextUrl(page$, finalUrl);
        page += 1;
    }

    return { collected: saved, lastPage };
};

const collectPeopleWithApi = async ({
    apiKey,
    query,
    limit,
    delayRange,
    stats,
    startPage = 1,
}) => {
    if (!query) return { collected: 0, lastPage: startPage - 1 };
    let collected = 0;
    let page = startPage;
    let lastPage = startPage - 1;

    while (collected < limit && page <= MAX_PERSON_PAGES) {
        lastPage = page;
        const response = await tmdbApiRequest({
            path: '/search/person',
            apiKey,
            params: { query, page },
            label: 'search/person',
        });

        const persons = response.results ?? [];
        if (!persons.length) break;

        for (const person of persons) {
            if (collected >= limit) break;
            const detail = await tmdbApiRequest({
                path: `/person/${person.id}`,
                apiKey,
                params: { append_to_response: 'combined_credits,images,external_ids' },
                label: `person ${person.id}`,
            });

            await Dataset.pushData({
                data_type: 'person',
                source: 'tmdb_api',
                person_id: detail.id,
                name: detail.name,
                biography: detail.biography,
                birthday: detail.birthday,
                deathday: detail.deathday,
                gender: detail.gender,
                known_for_department: detail.known_for_department,
                place_of_birth: detail.place_of_birth,
                also_known_as: detail.also_known_as,
                popularity: detail.popularity,
                profile_path: detail.profile_path,
                homepage: detail.homepage,
                combined_credits: {
                    cast: limitArray(detail.combined_credits?.cast ?? [], 15).map((credit) => ({
                        id: credit.id,
                        media_type: credit.media_type,
                        title: credit.title || credit.name,
                        character: credit.character,
                        release_date: credit.release_date || credit.first_air_date,
                    })),
                    crew: limitArray(detail.combined_credits?.crew ?? [], 15).map((credit) => ({
                        id: credit.id,
                        media_type: credit.media_type,
                        title: credit.title || credit.name,
                        job: credit.job,
                        department: credit.department,
                        release_date: credit.release_date || credit.first_air_date,
                    })),
                },
                fetchedAt: new Date().toISOString(),
            });

            stats.extraItems += 1;
            collected += 1;
            await randomDelay(delayRange.minDelayMs, delayRange.maxDelayMs);
        }

        if ((response.total_pages ?? 1) <= page) break;
        page += 1;
    }
    return { collected, lastPage };
};

await Actor.main(async () => {
    const input = (await Actor.getInput()) ?? {};

    // Validate contentType early
    const validContentTypes = ['movie', 'tv', 'person', 'both'];
    const contentType = input.contentType || 'tv';
    if (!validContentTypes.includes(contentType)) {
        const errorMsg = `Invalid contentType: "${contentType}". Must be one of: ${validContentTypes.join(', ')}`;
        log.error(errorMsg);
        throw new Error(errorMsg);
    }

    // Validate numeric inputs
    if (input.resultsWanted !== undefined && input.resultsWanted !== null) {
        const val = Number(input.resultsWanted);
        if (!Number.isFinite(val) || val < 1) {
            log.warning(`Invalid resultsWanted: ${input.resultsWanted}. Using default: 5`);
            input.resultsWanted = 5;
        }
    }

    if (input.maxPages !== undefined && input.maxPages !== null) {
        const val = Number(input.maxPages);
        if (!Number.isFinite(val) || val < 1) {
            log.warning(`Invalid maxPages: ${input.maxPages}. Using default: 5`);
            input.maxPages = 5;
        }
    }

    if (input.maxConcurrency !== undefined && input.maxConcurrency !== null) {
        const val = Number(input.maxConcurrency);
        if (!Number.isFinite(val) || val < 1) {
            log.warning(`Invalid maxConcurrency: ${input.maxConcurrency}. Using default: 10`);
            input.maxConcurrency = 10;
        }
    }

    const stateKey = 'scraper_state';
    let state = (await Actor.getValue(stateKey)) || {
        currentType: null,
        currentQuery: null,
        currentPage: 1,
        collectedForCurrent: 0,
        apiAvailable: true,
        peopleCurrentQuery: null,
        peoplePage: 1,
        peopleCollected: 0,
    };

    // Handle graceful shutdown for resumability
    process.on('SIGTERM', async () => {
        log.info('Received SIGTERM, saving current state for resumption');
        await Actor.setValue(stateKey, state);
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        log.info('Received SIGINT, saving current state for resumption');
        await Actor.setValue(stateKey, state);
        process.exit(0);
    });

    const {
        apiKey,
        useApiFirst = true,
        searchQueries = [],
        genreIds = [],
        yearFrom,
        yearTo,
        resultsWanted = 5,
        maxPages = 5,
        sortBy = 'popularity.desc',
        collectPeople = false,
        collectReviews = false,
        collectKeywords = false,
        collectImages = false,
        collectCollections = false,
        maxReviewsPerContent = 25,
        maxImagesPerContent = 20,
        minDelayMs = 1000,
        maxDelayMs = 3000,
        peopleQuery,
        peopleResultsWanted = 3,
        proxyConfiguration,
        maxConcurrency = 10,
        requestTimeoutSecs = 35,
        metamorph,
    } = input;

    const activeApiKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : null;

    // Log configuration at start
    log.info('Starting TMDb scraper with configuration:', {
        contentType,
        useApiFirst,
        hasApiKey: Boolean(activeApiKey),
        resultsWanted,
        maxPages,
        maxConcurrency,
    });

    const delayRange = { minDelayMs, maxDelayMs };
    const extrasConfig = {
        collectPeople,
        collectReviews,
        collectKeywords,
        collectImages,
        collectCollections,
        maxReviewsPerContent,
        maxImagesPerContent,
    };

    const concurrencyLimit = Math.max(1, Number(maxConcurrency) || 10);
    const timeoutSecs = Number(requestTimeoutSecs);
    REQUEST_TIMEOUT_MS = Math.max(5000, Number.isFinite(timeoutSecs) ? timeoutSecs * 1000 : 35000);

    const normalizedSearchQueries = parseStringList(searchQueries);
    const normalizedPeopleQuery = parseStringList(peopleQuery);
    const normalizedGenreIds = parseNumberList(genreIds);

    const stats = {
        mode: activeApiKey && useApiFirst ? 'api-first' : 'web-only',
        contents: 0,
        extraItems: 0,
        apiFailures: 0,
    };

    const requestedContentTypes = contentType === 'both'
        ? ['movie', 'tv']
        : contentType === 'person'
            ? []
            : [contentType];

    const effectiveQueries = normalizedSearchQueries.length
        ? normalizedSearchQueries
        : [null]; // null indicates discover mode

    // Warn if running with minimal configuration
    if (!normalizedSearchQueries.length && !normalizedGenreIds.length && !yearFrom && !yearTo) {
        log.info('Running in discover mode without filters. Will collect popular content.');
    }

    // Ensure there's something to scrape
    if (requestedContentTypes.length === 0 && !peopleQuery && contentType !== 'person') {
        const errorMsg = 'No content type specified. Please set contentType to movie, tv, both, or person.';
        log.error(errorMsg);
        throw new Error(errorMsg);
    }

    let resuming = state.currentType !== null;
    if (resuming) {
        log.info(`Resuming from saved state: type ${state.currentType}, query ${state.currentQuery}, page ${state.currentPage}`);
    }

    const discoverFilters = {
        genreIds: normalizedGenreIds,
        yearFrom,
        yearTo,
        sortBy,
    };

    let proxyConfigurationInstance = null;
    try {
        proxyConfigurationInstance = await Actor.createProxyConfiguration(proxyConfiguration ?? { useApifyProxy: true });
    } catch (error) {
        log.warning(`Proxy configuration failed (${error.message}), continuing without proxy.`);
    }
    const headerGenerator = new HeaderGenerator({
        browsers: [{ name: 'chrome', minVersion: 120, maxVersion: 130 }],
        devices: ['desktop'],
        operatingSystems: ['windows', 'macos'],
    });

    let apiAvailable = Boolean(activeApiKey) && useApiFirst;
    const extrasRequireApi = extrasConfig.collectPeople
        || extrasConfig.collectReviews
        || extrasConfig.collectKeywords
        || extrasConfig.collectImages
        || extrasConfig.collectCollections;

    if (extrasRequireApi && !activeApiKey) {
        log.warning('Detailed extras (people/reviews/keywords/images/collections) require a TMDb API key. Requested extras will be skipped.');
    }

    const maxResults = Number.isFinite(Number(resultsWanted)) && Number(resultsWanted) > 0
        ? Math.min(Number(resultsWanted), 100) // Cap at 100 to prevent runaway
        : 5; // Default to 5 if invalid
    let remainingResults = maxResults;

    for (const type of requestedContentTypes) {
        if (resuming && type !== state.currentType) continue;
        resuming = false;
        state.currentType = type;
        state.currentQuery = null;
        state.currentPage = 1;
        state.collectedForCurrent = 0;
        await Actor.setValue(stateKey, state);

        let queryResuming = state.currentQuery !== null;
        for (const query of effectiveQueries) {
            if (remainingResults <= 0) break;
            if (queryResuming && query !== state.currentQuery) continue;
            queryResuming = false;

            const limit = Number.isFinite(Number(resultsWanted)) && Number(resultsWanted) > 0
                ? Number(resultsWanted)
                : 5;

            const pages = Number.isFinite(Number(maxPages)) && Number(maxPages) > 0
                ? Number(maxPages)
                : 1;

            const label = query ? `query "${query}"` : 'discover mode';
            const limitForQuery = Math.min(remainingResults, limit) - state.collectedForCurrent;
            if (limitForQuery <= 0) {
                state.collectedForCurrent = 0;
                continue;
            }

            log.info(`Processing ${type} :: ${label} :: limit ${limitForQuery}`);

            state.currentQuery = query;
            state.currentPage = 1;
            await Actor.setValue(stateKey, state);

            let collected = 0;
            let startPage = state.currentPage;

            if (apiAvailable) {
                try {
                    const result = await collectContentWithApi({
                        apiKey: activeApiKey,
                        contentType: type,
                        query,
                        discoverFilters,
                        limit: limitForQuery,
                        maxPages: pages,
                        delayRange,
                        extrasConfig,
                        stats,
                        maxConcurrency: concurrencyLimit,
                        startPage,
                    });
                    collected += result.collected;
                    state.currentPage = result.lastPage;
                    state.collectedForCurrent += collected;
                    await Actor.setValue(stateKey, state);
                    remainingResults = Math.max(0, remainingResults - collected);
                } catch (error) {
                    stats.apiFailures += 1;
                    apiAvailable = false;
                    state.apiAvailable = false;
                    await Actor.setValue(stateKey, state);
                    log.exception(error, 'TMDb API failed, switching to website scraping for remaining work.');
                }
            }

            if (!apiAvailable) {
                const result = await collectContentWithWeb({
                    contentType: type,
                    query,
                    discoverFilters,
                    limit: limitForQuery,
                    delayRange,
                    stats,
                    proxyConfiguration: proxyConfigurationInstance,
                    headerGenerator,
                    concurrency: concurrencyLimit,
                    startPage,
                });
                collected += result.collected;
                state.currentPage = result.lastPage;
                state.collectedForCurrent += collected;
                await Actor.setValue(stateKey, state);
                remainingResults = Math.max(0, remainingResults - collected);
            }
        }
    }

    if (contentType === 'person' || peopleQuery) {
        if (!activeApiKey) {
            log.warning('People collection requires a TMDb API key. Skipping people data.');
        } else {
            const queries = contentType === 'person' && normalizedSearchQueries.length
                ? normalizedSearchQueries
                : normalizedPeopleQuery;

            let peopleResuming = state.peopleCurrentQuery !== null;
            for (const query of queries) {
                if (peopleResuming && query !== state.peopleCurrentQuery) continue;
                peopleResuming = false;
                if (!query) continue;
                log.info(`Collecting people data for "${query}"`);
                state.peopleCurrentQuery = query;
                state.peoplePage = 1;
                state.peopleCollected = 0;
                await Actor.setValue(stateKey, state);
                const result = await collectPeopleWithApi({
                    apiKey: activeApiKey,
                    query,
                    limit: peopleResultsWanted,
                    delayRange,
                    stats,
                    startPage: state.peoplePage,
                });
                state.peoplePage = result.lastPage;
                state.peopleCollected += result.collected;
                await Actor.setValue(stateKey, state);
            }
        }
    }

    // Check if any data was collected
    if (stats.contents === 0) {
        log.warning('No content items were collected. This might indicate an issue with the input configuration or TMDb availability.');
    }

    const summary = `Completed successfully! Collected ${stats.contents} content items and ${stats.extraItems} auxiliary records.`;
    log.info(summary);
    log.info('Scraper finished successfully', {
        contentsCollected: stats.contents,
        extraItemsCollected: stats.extraItems,
        mode: stats.mode,
        apiFailures: stats.apiFailures,
    });
    await Actor.setStatusMessage(summary);
    await Actor.setValue(stateKey, null); // Clear state on completion

    // Handle metamorph if configured (for chaining actors)
    if (metamorph) {
        log.info('Metamorphing to another actor', { actorId: metamorph });
        await Actor.metamorph(metamorph);
    }

    // Exit gracefully
    await Actor.exit('Actor finished successfully', { exitCode: 0 });
});
