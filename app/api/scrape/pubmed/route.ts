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
        // PubMed Search URL
        const url = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results: any[] = [];

        // Scrape article list
        $('.docsum-content').each((i, el) => {
            if (i < 5) {
                const title = $(el).find('.docsum-title').text().trim();
                const linkPart = $(el).find('.docsum-title').attr('href');
                const author = $(el).find('.full-authors').text().trim();
                const fullLink = `https://pubmed.ncbi.nlm.nih.gov${linkPart}`;

                // PubMed search results often only show title/author.
                // The "snippet" class might be different or dynamic.
                // We'll try a few common ones or extract from snippet if available.
                let snippet = $(el).find('.full-view-snippet, .docsum-snippet').text().trim();

                // Make the snippet look like a description
                if (!snippet) {
                    snippet = "Click to view full abstract and details on PubMed.";
                }

                if (title) {
                    results.push({
                        title,
                        link: fullLink,
                        author: author || 'Various Authors',
                        snippet
                    });
                }
            }
        });

        // If we have very few results, or user queried a DRUG specifically,
        // we might want to hint at MedlinePlus in a constructed result if possible
        // (Optional enhancement: push a hardcoded result for MedlinePlus search)
        if (results.length > 0) {
            results.push({
                title: `MedlinePlus Info: ${query}`,
                link: `https://medlineplus.gov/druginfo/meds/index.html`, // General link or search
                author: 'National Library of Medicine',
                snippet: `Search MedlinePlus for plain-language information about ${query} usage, side effects, and more.`
            });
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('PubMed Scraping Error:', error);
        return NextResponse.json({ error: 'Failed to fetch data from PubMed', details: error.message }, { status: 500 });
    }
}
