"""
Resolves an OpenStreetMap structure to the Wikipedia article that describes it.

Strategies are tried in descending order of trustworthiness, and the first one that
yields a real article wins:

  1. WIKIDATA QID  — from the OSM `wikidata` tag (e.g. "Q623558"). A stable, language
     independent identifier that maps straight to a sitelink. This is by far the most
     accurate signal and is therefore tried first.
  2. WIKIPEDIA TAG — from the OSM `wikipedia` tag (e.g. "nl:Oude Kerk (Amsterdam)").
     Exact, but a free-text title that goes stale when an article is renamed.
  3. GEOSEARCH     — entities with coordinates near the building, matched by name.
     Searched in widening rings, and against BOTH Wikidata and Wikipedia: some
     places carry coordinates on their Wikidata item but not on the article
     itself, so querying Wikipedia alone would miss them.
  4. NAME GUESSES  — the structure name permuted with its city.

English is always preferred: a Dutch article that has an English counterpart is
followed through its langlink, and only an article with no English edition is
returned as Dutch (the caller then machine-translates it).

Fetching is two-tier, because searching and displaying want different things:

  * WHILE SEARCHING, each candidate is checked with the REST summary endpoint —
    one small request that settles existence, disambiguation, the lead extract,
    the Wikidata description and the thumbnail.
  * ONCE A WINNER IS FOUND, `fetch_body` pulls the fuller article text (lead plus
    the sections after it) in a single extra request.

The point of the split is that a geosearch may test half a dozen candidates; only
the one the user actually sees is worth downloading in full.
"""

import asyncio
import difflib
import urllib.parse
from dataclasses import dataclass
from typing import List, Optional, Tuple

import httpx

USER_AGENT = 'Apparitions/1.0 (contact@apparitions.nl)'
HEADERS = {'User-Agent': USER_AGENT}

# Widening search rings, in metres.
GEOSEARCH_RADII_M = (100, 300, 1000)
GEOSEARCH_LIMIT = 5

# How alike a nearby article's title and the OSM name must be to count as the same place.
NAME_MATCH_THRESHOLD = 0.5

# A small courtesy pause between speculative lookups. The accurate strategies above
# rarely reach this far, so it costs nothing in the common case.
PROBE_DELAY_S = 0.3

LANGUAGES = ('en', 'nl')


@dataclass
class Article:
    """A resolved Wikipedia article, in whichever language we managed to find."""
    title: str
    summary: str
    url: str
    lang: str
    # Wikidata's one-line gloss, e.g. "Amsterdam's oldest building". Comes back
    # with the summary at no extra cost.
    description: Optional[str] = None
    thumbnail: Optional[str] = None


def _looks_like_disambiguation(article_title: str, extract: str) -> bool:
    """Backstop for the few disambiguation pages the REST API types as 'standard'."""
    title, summary = article_title.lower(), extract.lower()
    return (
        'may refer to:' in summary
        or 'kan verwijzen naar:' in summary
        or 'meerdere betekenissen' in summary
        or 'disambiguation' in title
        or 'doorverwijspagina' in title
    )


async def _fetch_summary(client: httpx.AsyncClient, lang: str, title: str) -> Optional[Article]:
    """
    Fetch one article through the REST summary endpoint.

    A single request settles everything we need: whether the page exists, whether
    it is a disambiguation page, the lead extract, the Wikidata description, the
    thumbnail and the canonical URL.

    The previous implementation used wikipediaapi, which downloads the article's
    ENTIRE plain text just to expose its lead — 91-96% of the bytes were thrown
    away, once per candidate tried — and then needed extra round-trips for the
    existence check and the thumbnail.
    """
    if lang not in LANGUAGES or not title:
        return None

    encoded = urllib.parse.quote(title.replace(' ', '_'), safe='')
    try:
        response = await client.get(
            f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/{encoded}',
            headers=HEADERS,
            follow_redirects=True,
        )
    except Exception as e:
        print(f"[WIKI] {lang}:{title} lookup failed: {e}")
        return None

    if response.status_code != 200:
        return None

    try:
        data = response.json()
    except ValueError:
        return None

    if data.get('type') == 'disambiguation':
        return None

    extract = (data.get('extract') or '').strip()
    resolved_title = (data.get('titles') or {}).get('normalized') or data.get('title') or title
    if not extract or _looks_like_disambiguation(resolved_title, extract):
        return None

    return Article(
        title=resolved_title,
        summary=extract,
        url=(data.get('content_urls') or {}).get('desktop', {}).get('page', ''),
        lang=lang,
        description=data.get('description'),
        thumbnail=(data.get('thumbnail') or {}).get('source'),
    )


async def _english_title_for(client: httpx.AsyncClient, lang: str, title: str) -> Optional[str]:
    """The English counterpart of a non-English article, via its langlinks."""
    try:
        response = await client.get(
            f'https://{lang}.wikipedia.org/w/api.php',
            params={
                'action': 'query', 'prop': 'langlinks', 'lllang': 'en',
                'titles': title, 'format': 'json', 'redirects': 1,
            },
            headers=HEADERS,
        )
        pages = response.json().get('query', {}).get('pages', {})
        for page in pages.values():
            for link in page.get('langlinks') or []:
                return link.get('*')
    except Exception as e:
        print(f"[WIKI] langlink lookup for {lang}:{title} failed: {e}")
    return None


async def _load(client: httpx.AsyncClient, lang: str, title: str) -> Optional[Article]:
    """Load an article, preferring the English edition when one is linked."""
    article = await _fetch_summary(client, lang, title)
    if not article:
        return None

    if lang != 'en':
        english_title = await _english_title_for(client, lang, title)
        if english_title:
            english = await _fetch_summary(client, 'en', english_title)
            if english:
                return english

    return article


def _names_match(osm_name: str, article_title: str) -> bool:
    """Loose comparison — OSM names and article titles rarely match character for character."""
    a, b = osm_name.lower(), article_title.lower()
    if a in b or b in a:
        return True
    return difflib.SequenceMatcher(None, a, b).ratio() > NAME_MATCH_THRESHOLD


# ---------------------------------------------------------------- strategies --

async def _sitelink_titles(client: httpx.AsyncClient, qid: str) -> List[Tuple[str, str]]:
    """
    The Wikipedia articles a Wikidata entity links to, as (lang, title) pairs in
    our language preference order.
    """
    try:
        response = await client.get(
            'https://www.wikidata.org/w/api.php',
            params={'action': 'wbgetentities', 'ids': qid, 'props': 'sitelinks', 'format': 'json'},
            headers=HEADERS,
        )
        sitelinks = response.json().get('entities', {}).get(qid, {}).get('sitelinks', {})
    except Exception as e:
        print(f"[WIKI] Wikidata sitelinks for {qid} failed: {e}")
        return []

    pairs = []
    for lang in LANGUAGES:
        title = sitelinks.get(f'{lang}wiki', {}).get('title')
        if title:
            pairs.append((lang, title))
    return pairs


async def _from_wikidata(client: httpx.AsyncClient, qid: str) -> Optional[Article]:
    """Look the QID up on Wikidata and follow its English, then Dutch, sitelink."""
    for lang, title in await _sitelink_titles(client, qid):
        article = await _load(client, lang, title)
        if article:
            return article
        # Deliberately keep going: an English sitelink pointing at a disambiguation
        # page must not stop us from using the Dutch article for the same entity.
    return None


async def _from_wikipedia_tag(client: httpx.AsyncClient, tag: str) -> Optional[Article]:
    """OSM stores this as "<lang>:<Title>"; fall back to the other edition if needed."""
    lang, _, title = tag.partition(':')
    if not title or lang not in _WIKI:
        lang, title = 'en', tag

    article = await _load(client, lang, title)
    if article:
        return article

    other = 'nl' if lang == 'en' else 'en'
    return await _load(client, other, title)


async def _geosearch_titles(
    client: httpx.AsyncClient, lang: str, lat: float, lon: float, radius: int
) -> List[str]:
    try:
        response = await client.get(
            f'https://{lang}.wikipedia.org/w/api.php',
            params={
                'action': 'query', 'list': 'geosearch',
                'gscoord': f'{lat}|{lon}', 'gsradius': radius,
                'gslimit': GEOSEARCH_LIMIT, 'format': 'json',
            },
            headers=HEADERS,
        )
        return [hit['title'] for hit in response.json().get('query', {}).get('geosearch', [])]
    except Exception as e:
        print(f"[WIKI] Geosearch ({lang}, {radius}m) failed: {e}")
        return []


async def _wikidata_geosearch_qids(
    client: httpx.AsyncClient, lat: float, lon: float, radius: int
) -> List[str]:
    """
    Wikidata entities near a point.

    Worth querying alongside the Wikipedia geosearch below: a place often carries
    coordinates on its Wikidata item while its Wikipedia article has none, and
    such an article is invisible to Wikipedia's own geosearch.
    """
    try:
        response = await client.get(
            'https://www.wikidata.org/w/api.php',
            params={
                'action': 'query', 'list': 'geosearch',
                'gscoord': f'{lat}|{lon}', 'gsradius': radius,
                'gslimit': GEOSEARCH_LIMIT, 'format': 'json',
            },
            headers=HEADERS,
        )
        return [hit['title'] for hit in response.json().get('query', {}).get('geosearch', [])]
    except Exception as e:
        print(f"[WIKI] Wikidata geosearch ({radius}m) failed: {e}")
        return []


async def _from_geosearch(
    client: httpx.AsyncClient, name: str, lat: float, lon: float
) -> Optional[Article]:
    """
    Widen the search ring until something nearby carries a matching name.

    Each ring is checked against Wikidata first (richer coordinate coverage), then
    against the Wikipedia editions directly.
    """
    for radius in GEOSEARCH_RADII_M:
        for qid in await _wikidata_geosearch_qids(client, lat, lon, radius):
            for lang, title in await _sitelink_titles(client, qid):
                if not _names_match(name, title):
                    continue
                article = await _load(client, lang, title)
                if article:
                    return article

        for lang in LANGUAGES:
            for title in await _geosearch_titles(client, lang, lat, lon, radius):
                if not _names_match(name, title):
                    continue
                article = await _load(client, lang, title)
                if article:
                    return article

        await asyncio.sleep(PROBE_DELAY_S)
    return None


async def _from_name(client: httpx.AsyncClient, name: str, city: Optional[str]) -> Optional[Article]:
    """Last resort: guess the article title from the structure and city names."""
    candidates = []
    if city:
        city = city.title()
        candidates += [f'{name} ({city})', f'{name}, {city}', f'{name} {city}']
    candidates.append(name)

    for lang in LANGUAGES:
        for candidate in candidates:
            article = await _load(client, lang, candidate)
            if article and _plausible_for_city(article, city):
                return article
        await asyncio.sleep(PROBE_DELAY_S)
    return None


def _plausible_for_city(article: Article, city: Optional[str]) -> bool:
    """
    Guard against a name collision in another town — "Central Station" resolving to
    the wrong country's station, say. Checked against the summary rather than the
    full article text, which would mean downloading the whole page.
    """
    if not city:
        return True
    needle = city.lower()
    return needle in article.title.lower() or needle in article.summary.lower()


# -------------------------------------------------------------------- public --

UNNAMED_PLACEHOLDER = '-'


async def resolve_article(
    name: str,
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    wikidata: Optional[str] = None,
    wikipedia_tag: Optional[str] = None,
) -> Optional[Article]:
    """Run the strategies in order and return the first real article found."""
    name = (name or '').strip()
    if name == UNNAMED_PLACEHOLDER:
        name = ''

    async with httpx.AsyncClient(timeout=20.0) as client:
        if wikidata:
            article = await _from_wikidata(client, wikidata)
            if article:
                return article

        if wikipedia_tag:
            article = await _from_wikipedia_tag(client, wikipedia_tag)
            if article:
                return article

        if lat is not None and lon is not None and name:
            article = await _from_geosearch(client, name, lat, lon)
            if article:
                return article

        if name:
            return await _from_name(client, name, city)

    return None

# How much article text to hand the panel. Comfortably more than the lead, while
# still bounded so a long article can't dominate the response.
BODY_CHAR_BUDGET = 4000


async def fetch_body(lang: str, title: str, budget: int = BODY_CHAR_BUDGET) -> Optional[str]:
    """
    The article's text beyond the lead, trimmed to `budget` at a paragraph break.

    Called once, for the article that was actually chosen — never during the
    candidate search, where the small summary is enough to judge a match.
    """
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(
                f'https://{lang}.wikipedia.org/w/api.php',
                params={
                    'action': 'query', 'prop': 'extracts', 'explaintext': 1,
                    'exsectionformat': 'plain', 'exlimit': 1,
                    'titles': title, 'format': 'json', 'redirects': 1,
                },
                headers=HEADERS,
            )
            pages = response.json().get('query', {}).get('pages', {})
            extract = next((p.get('extract') for p in pages.values() if p.get('extract')), None)
    except Exception as e:
        print(f"[WIKI] Body fetch for {lang}:{title} failed: {e}")
        return None

    if not extract:
        return None
    return _trim_to_paragraph(extract, budget)


def _trim_to_paragraph(text: str, budget: int) -> str:
    """Cut to the budget without leaving a half-finished paragraph."""
    text = text.strip()
    if len(text) <= budget:
        return text

    cut = text.rfind('\n', 0, budget)
    if cut < budget // 2:            # no sensible paragraph break — fall back to a sentence
        cut = text.rfind('. ', 0, budget)
        cut = cut + 1 if cut > budget // 2 else budget
    return text[:cut].rstrip()
