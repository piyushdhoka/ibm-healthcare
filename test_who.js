
const axios = require('axios');
const cheerio = require('cheerio');

async function scrape(query) {
    console.log(`Testing query: ${query}`);
    try {
        let directUrl = `https://www.who.int/health-topics/${query.toLowerCase().replace(/ /g, '-')}`;
        console.log(`Trying Direct URL: ${directUrl}`);

        try {
            const directResponse = await axios.get(directUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                validateStatus: status => status === 200
            });
            console.log('Direct URL Success');
            return;
        } catch (e) {
            console.log('Direct URL Failed, trying search...');
        }

        const searchUrl = `https://www.who.int/home/search?indexCatalogue=genericsearchindex1&searchQuery=${encodeURIComponent(query)}&wordsMode=AllWords`;
        console.log(`Trying Search URL: ${searchUrl}`);
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(response.data);
        const count = $('.result-list-item, .sf-search-result-item').length;
        console.log(`Search Results Found: ${count}`);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

(async () => {
    await scrape('Dengue');
    await scrape('flu');
})();
