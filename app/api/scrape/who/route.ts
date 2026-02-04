import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    try {
        // Strategy 1: Direct Health Topic URL
        // WHO URLs are often https://www.who.int/health-topics/[disease-name]
        // We try to fetch this directly first.
        let directUrl = `https://www.who.int/health-topics/${query.toLowerCase().replace(/ /g, '-')}`;

        // Some common remappings
        if (query.toLowerCase() === 'flu') directUrl = 'https://www.who.int/health-topics/influenza-seasonal';

        try {
            const directResponse = await axios.get(directUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0'
                },
                validateStatus: status => status === 200 // Only accept 200 OK
            });

            const $ = cheerio.load(directResponse.data);
            const title = $('h1').first().text().trim();

            // Extract tab content or main sections without tabs
            // WHO pages often have "Overview", "Symptoms", "Treatment" in various containers.
            // We generally look for text blocks heavily populated with content.

            const contentBlocks: any[] = [];

            // Try to find specific headers and their following content
            const headings = ['Overview', 'Symptoms', 'Treatment', 'Prevention', 'Diagnosis'];

            headings.forEach(heading => {
                // Look for h2/h3 containing the heading
                $('h2, h3').each((i, el) => {
                    if ($(el).text().trim().includes(heading)) {
                        // Get the next paragraph or list
                        let nextEl = $(el).next();
                        let text = '';
                        // Gather a bit of text from subsequent siblings until another header
                        for (let k = 0; k < 3; k++) {
                            if (nextEl.is('p') || nextEl.is('ul')) {
                                text += nextEl.text().trim() + ' ';
                                nextEl = nextEl.next();
                            } else if (nextEl.is('div')) {
                                text += nextEl.text().trim() + ' ';
                                nextEl = nextEl.next();
                            } else {
                                break;
                            }
                        }

                        if (text) {
                            contentBlocks.push({
                                title: heading,
                                snippet: text.substring(0, 300) + (text.length > 300 ? '...' : '')
                            });
                        }
                    }
                });
            });

            // If specific headers not found, pull the first meaningful paragraph
            if (contentBlocks.length === 0) {
                const firstP = $('.sf-content-block p').first().text().trim() || $('p').eq(2).text().trim(); // Heuristic
                if (firstP) {
                    contentBlocks.push({
                        title: 'Overview',
                        snippet: firstP
                    });
                }
            }

            if (contentBlocks.length > 0) {
                return NextResponse.json({
                    results: contentBlocks.map(b => ({
                        title: `${title} - ${b.title}`,
                        link: directUrl,
                        snippet: b.snippet
                    }))
                });
            }

        } catch (err) {
            // Direct URL failed (404 etc), fall back to search
            console.log(`Direct WHO topic fetch failed for ${query}, falling back to search.`);
        }

        // Strategy 2: Fallback to Search
        const searchUrl = `https://www.who.int/home/search?indexCatalogue=genericsearchindex1&searchQuery=${encodeURIComponent(query)}&wordsMode=AllWords`;

        // ... existing search logic ...
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results: any[] = [];

        // Improved selectors for WHO Search
        $('.result-list-item, .sf-search-result-item').each((i, el) => {
            if (i < 3) {
                const title = $(el).find('.result-list-item-title, .sf-search-result-title').text().trim();
                const link = $(el).find('a').attr('href');
                // Try different classes for snippet
                const snippet = $(el).find('.result-list-item-description, .sf-search-result-snippet, .content').text().trim();

                if (title && link) {
                    results.push({
                        title,
                        link: link.startsWith('http') ? link : `https://www.who.int${link}`,
                        snippet: snippet || 'No description available in search result.'
                    });
                }
            }
        });

        // Fallback if specific selectors fail (often classes change)
        if (results.length === 0) {
            // Try a broader search for links containing the query
            $('a').each((i, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href');
                if (text.toLowerCase().includes(query.toLowerCase()) && href && results.length < 3) {
                    results.push({
                        title: text,
                        link: href.startsWith('http') ? href : `https://www.who.int${href}`,
                        snippet: 'Related link found on WHO website.'
                    });
                }
            });
        }

        // FINAL FALLBACK: If absolutely nothing found, provide a direct search link
        if (results.length === 0) {
            results.push({
                title: `Search WHO for "${query}"`,
                link: `https://www.who.int/home/search?indexCatalogue=genericsearchindex1&searchQuery=${encodeURIComponent(query)}&wordsMode=AllWords`,
                snippet: `We couldn't extract specific details, but you can view all results for ${query} directly on the World Health Organization website.`
            });
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('WHO Web Scraping Error:', error);
        return NextResponse.json({ error: 'Failed to fetch data from WHO', details: error.message }, { status: 500 });
    }
}
