import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  arrangeCatalog,
  catalogGenres,
  decadeOf,
  DEFAULT_FILTERS,
  filterCatalog,
  groupByGenre,
  normalizeSearch,
  sortCatalog,
  type CatalogItem,
} from './catalog';

function item(title: string, extra: Partial<CatalogItem> = {}): CatalogItem {
  return { type: 'movie', tmdbId: 1, title, year: 2020, posterPath: null, genres: [], seasons: null, imdbRating: null, tmdbRating: null, criticsScore: null, ...extra };
}

const titles = (items: readonly CatalogItem[]) => items.map((i) => i.title);

const dune = item('Duna: Parte 2', { year: 2024, genres: ['Ficção científica', 'Aventura'], imdbRating: 8.5 });
const lasso = item('Ted Lasso', { type: 'tv', year: 2020, genres: ['Comédia'], imdbRating: 8.8 });
const acao = item('Ação Mutante', { year: 1993, genres: ['Ação'] });
const casablanca = item('Casablanca', { year: 1942, genres: ['Drama'], imdbRating: 8.5 });
const all = [dune, lasso, acao, casablanca];

describe('decadeOf', () => {
  it('puts a year in its release period', () => {
    expect(decadeOf(1942)).toBe('old');
    expect(decadeOf(1979)).toBe('old');
    expect(decadeOf(1980)).toBe('1980');
    expect(decadeOf(2009)).toBe('2000');
    expect(decadeOf(2024)).toBe('2020');
    expect(decadeOf(2031)).toBe('2020');
    expect(decadeOf(null)).toBeNull();
  });
});

describe('filterCatalog', () => {
  it('searches the title ignoring case and accents', () => {
    expect(normalizeSearch('  AÇÃO ')).toBe('acao');
    expect(titles(filterCatalog(all, { ...DEFAULT_FILTERS, query: 'acao' }))).toEqual(['Ação Mutante']);
  });

  it('filters by type', () => {
    expect(titles(filterCatalog(all, { ...DEFAULT_FILTERS, type: 'tv' }))).toEqual(['Ted Lasso']);
  });

  it('keeps a title with any of the chosen genres and periods', () => {
    expect(titles(filterCatalog(all, { ...DEFAULT_FILTERS, genres: ['Drama', 'Comédia'] }))).toEqual(['Ted Lasso', 'Casablanca']);
    expect(titles(filterCatalog(all, { ...DEFAULT_FILTERS, decades: ['old', '1990'] }))).toEqual(['Ação Mutante', 'Casablanca']);
  });

  it('leaves out a title without a year when a period is chosen', () => {
    expect(filterCatalog([item('Sem ano', { year: null })], { ...DEFAULT_FILTERS, decades: ['2020'] })).toEqual([]);
  });
});

describe('sortCatalog', () => {
  it('sorts A–Z the Portuguese way', () => {
    expect(titles(sortCatalog(all, 'title'))).toEqual(['Ação Mutante', 'Casablanca', 'Duna: Parte 2', 'Ted Lasso']);
  });

  it('puts the best IMDb rating first, ties by title, unknown last', () => {
    expect(titles(sortCatalog(all, 'imdb'))).toEqual(['Ted Lasso', 'Casablanca', 'Duna: Parte 2', 'Ação Mutante']);
  });

  it('sorts by release, newest or oldest first, without a year last', () => {
    const noYear = item('Sem ano', { year: null });
    expect(titles(sortCatalog([...all, noYear], 'release', true))).toEqual(['Duna: Parte 2', 'Ted Lasso', 'Ação Mutante', 'Casablanca', 'Sem ano']);
    expect(titles(sortCatalog([...all, noYear], 'release', false))).toEqual(['Casablanca', 'Ação Mutante', 'Ted Lasso', 'Duna: Parte 2', 'Sem ano']);
  });
});

describe('groupByGenre', () => {
  it('makes one group per genre A–Z, a title in each of its genres, no genre last', () => {
    const groups = groupByGenre([...all, item('Sem gênero')]);
    expect(groups.map((g) => g.genre)).toEqual(['Ação', 'Aventura', 'Comédia', 'Drama', 'Ficção científica', null]);
    expect(titles(groups[1].items)).toEqual(['Duna: Parte 2']);
    expect(titles(groups[4].items)).toEqual(['Duna: Parte 2']);
  });
});

describe('arrangeCatalog', () => {
  it('filters, sorts and groups, counting each title once', () => {
    const result = arrangeCatalog(all, { ...DEFAULT_FILTERS, decades: ['2020'], groupByGenre: true });
    expect(result.count).toBe(2);
    expect(result.groups.map((g) => g.genre)).toEqual(['Aventura', 'Comédia', 'Ficção científica']);
  });

  it('gives one unnamed group when not grouping', () => {
    expect(arrangeCatalog(all, DEFAULT_FILTERS).groups).toHaveLength(1);
  });
});

describe('the filter sheet', () => {
  it('lists every genre A–Z and counts the choices', () => {
    expect(catalogGenres(all)).toEqual(['Ação', 'Aventura', 'Comédia', 'Drama', 'Ficção científica']);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, genres: ['Drama'], decades: ['2010'], query: 'x', type: 'tv' })).toBe(2);
  });
});
